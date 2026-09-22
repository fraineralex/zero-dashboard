import "server-only";

import { experimental_composeSpec, experimental_createEvaluator, type Spec } from "@json-render/core";
import { z } from "zod";
import { dashboardCatalog } from "@/lib/dashboard/catalog";
import { resolveCandidates } from "@/lib/dashboard/candidates";
import { buildIntentSpec } from "@/lib/dashboard/specs";
import { deterministicCapabilityDecision, evaluateCapabilityDecision } from "@/lib/ui-memory/decision";
import { findUiRecipe } from "@/lib/ui-memory/registry";
import type { AnalyticsContext, DashboardSpec } from "@/types/analytics";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  intent: z.string().trim().min(1).max(500),
  source: z.enum(["navigation", "suggestion", "text", "voice"]),
  context: z.object({
    area: z.enum(["overview", "revenue", "customers", "retention", "acquisition", "payments"]),
    segment: z.enum(["Enterprise", "Growth", "Pro", "Starter"]).optional(),
    entityType: z.enum(["customer", "plan", "country"]).optional(),
    entityId: z.string().max(80).optional(),
    period: z.object({ from: z.string(), to: z.string(), label: z.string() }),
    comparison: z.object({ type: z.enum(["previous_period", "previous_year", "segment", "cohort"]), value: z.string().optional() }).optional(),
    investigation: z.enum(["enterprise_decline", "decline_customers", "customer_risk", "cohort_comparison"]).optional(),
  }),
  initialSpec: z.custom<DashboardSpec>().optional(),
});

const windows = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string) {
  const now = Date.now();
  const existing = windows.get(key);
  if (!existing || existing.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  existing.count += 1;
  return existing.count > 20;
}

function ndjson(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

export async function POST(request: Request) {
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(clientKey)) return Response.json({ error: "Too many composition requests. Try again shortly." }, { status: 429 });

  let payload: z.infer<typeof requestSchema>;
  try {
    payload = requestSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid composition request." }, { status: 400 });
  }

  const context = payload.context as AnalyticsContext;
  const resolved = resolveCandidates(context, payload.intent);
  const fallback = buildIntentSpec(payload.intent, context, payload.initialSpec);
  const memoryRecipe = findUiRecipe(payload.intent);
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (value: unknown) => controller.enqueue(encoder.encode(ndjson(value)));
      if (!apiKey) {
        // Explicit development path: all analysis and data are deterministic.
        // Production never silently claims an AI-selected composition here.
        send({
          type: "step",
          spec: fallback,
          diagnostics: {
            mode: "development-fallback",
            candidateCount: resolved.candidates.length,
            resolverMs: resolved.resolverMs,
            stopReason: "no-ai-gateway-key",
            uiMemory: deterministicCapabilityDecision(memoryRecipe),
          },
        });
        send({ type: "complete", spec: fallback });
        controller.close();
        return;
      }

      try {
        const evaluate = experimental_createEvaluator({ model: "typesafe-ai/jev", apiKey, timeoutMs: 10_000 });
        let uiMemory = deterministicCapabilityDecision(memoryRecipe);
        try {
          uiMemory = await evaluateCapabilityDecision(payload.intent, memoryRecipe, evaluate, AbortSignal.timeout(4_500));
        } catch {
          // Composition remains available when the optional capability preflight times out.
        }
        for await (const event of experimental_composeSpec({
          catalog: dashboardCatalog,
          candidates: resolved.candidates,
          prompt: payload.intent,
          context: resolved.context,
          initialSpec: payload.initialSpec as Spec | undefined,
          initialState: {},
          evaluate,
          strategy: "batch",
          maxSteps: 12,
          maxElements: 20,
          maxDepth: 4,
          signal: AbortSignal.timeout(22_000),
          instructions: {
            root: "Keep one continuous analytical canvas. Reconfigure the existing layout instead of modeling navigation to another page.",
            next: "Choose only configured evidence that answers the request. Preserve useful existing elements when the user asks to add, remove, compare, or restyle a measure.",
            parent: "Place evidence in the root layout default slot in analytical reading order. Multiple requested measures should share one chart when a prepared combined-series candidate exists.",
          },
        })) {
          if (event.type === "step") {
            send({ type: "step", spec: event.spec, diagnostics: { mode: "jev", candidateCount: resolved.candidates.length, resolverMs: resolved.resolverMs, uiMemory } });
          } else {
            send({ type: "complete", spec: event.spec, diagnostics: { mode: "jev", stopReason: event.stopReason, uiMemory } });
          }
        }
      } catch {
        send({ type: "error", message: "Jev could not compose this view. Your current dashboard has been preserved." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
