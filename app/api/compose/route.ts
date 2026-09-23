import "server-only";

import { experimental_composeSpec, experimental_createEvaluator, type Spec } from "@json-render/core";
import { z } from "zod";
import { dashboardCatalog } from "@/lib/dashboard/catalog";
import { CANVAS_DESIGN_GUIDELINES, validateCanvasDesign } from "@/lib/dashboard/design-system";
import { requestFidelityIssue, unavailableSpec } from "@/lib/dashboard/fidelity";
import { composeWithLuna } from "@/lib/dashboard/luna-composer";
import { resolveCandidates } from "@/lib/dashboard/candidates";
import { buildIntentSpec } from "@/lib/dashboard/specs";
import { buildDynamicErpSpec, shouldPlanDynamicErp } from "@/lib/erp/query";
import { planErpWithLuna } from "@/lib/erp/luna-planner";
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

function logCompositionFailure(stage: string, error: unknown) {
  const detail = error && typeof error === "object" ? error as { name?: string; message?: string; statusCode?: number; code?: string } : null;
  const safeMessage = detail?.message?.replace(/Bearer\s+\S+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 240);
  console.warn("Canvas composition failure", {
    stage,
    name: detail?.name ?? "unknown",
    message: safeMessage ?? null,
    statusCode: detail?.statusCode ?? null,
    code: detail?.code ?? null,
  });
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
  const prepared = buildIntentSpec(payload.intent, context, payload.initialSpec);
  const preparedErp = Boolean(prepared.state?.erp);
  const dynamicErp = payload.source !== "navigation" && shouldPlanDynamicErp(payload.intent, prepared);
  const fidelityIssue = payload.source === "navigation" ? null : requestFidelityIssue(payload.intent, prepared);
  const fallback = fidelityIssue ? unavailableSpec(fidelityIssue) : prepared;
  const memoryRecipe = findUiRecipe(payload.intent);
  // Vercel injects runtime OIDC into the function Request, not process.env.
  // The Gateway validates this signed token; never forward it to the browser.
  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || request.headers.get("x-vercel-oidc-token");
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (value: unknown) => controller.enqueue(encoder.encode(ndjson(value)));
      const focusedBilling = memoryRecipe?.id === "customer-billing-ranking" || memoryRecipe?.id === "recent-customer-billing";
      const explicitPie = Object.values(fallback.elements).some((element) => element.type === "PieChartCard");
      if (dynamicErp) {
        if (!apiKey) {
          const unavailable = unavailableSpec("La planificación de esta consulta ERP requiere el modelo de composición, que no está configurado en este entorno.");
          send({ type: "step", spec: unavailable, diagnostics: { mode: "development-fallback", stopReason: "erp-planner-unavailable" } });
          send({ type: "complete", spec: unavailable });
          controller.close();
          return;
        }
        let uiMemory = deterministicCapabilityDecision(memoryRecipe);
        try {
          const evaluate = experimental_createEvaluator({ model: "typesafe-ai/jev", apiKey, timeoutMs: 10_000 });
          uiMemory = await evaluateCapabilityDecision(payload.intent, memoryRecipe, evaluate, AbortSignal.timeout(4_500));
        } catch (error) {
          logCompositionFailure("jev-erp-preflight", error);
        }
        try {
          const plan = await planErpWithLuna(payload.intent, AbortSignal.timeout(12_000));
          const generated = buildDynamicErpSpec(plan, payload.intent);
          const issue = validateCanvasDesign(generated) ?? requestFidelityIssue(payload.intent, generated);
          const catalogResult = dashboardCatalog.validate(generated);
          if (issue || !catalogResult.success) throw new Error(issue ?? "Generated ERP spec failed catalog validation.");
          send({ type: "step", spec: generated, diagnostics: { mode: "luna", stopReason: "validated-erp-query-plan", uiMemory } });
          send({ type: "complete", spec: generated });
        } catch (error) {
          logCompositionFailure("luna-erp-planning", error);
          const unavailable = unavailableSpec("No pude componer esta consulta con los modelos y campos de la muestra ERP. No se sustituyó por datos de otro módulo.");
          send({ type: "step", spec: unavailable, diagnostics: { mode: "deterministic", stopReason: "erp-query-plan-rejected", uiMemory } });
          send({ type: "complete", spec: unavailable });
        } finally {
          controller.close();
        }
        return;
      }
      if (fidelityIssue || focusedBilling || explicitPie || preparedErp || !apiKey) {
        // Explicit development path: all analysis and data are deterministic.
        // Production never silently claims an AI-selected composition here.
        send({
          type: "step",
          spec: fallback,
          diagnostics: {
            mode: fidelityIssue || focusedBilling || explicitPie || preparedErp ? "deterministic" : "development-fallback",
            candidateCount: resolved.candidates.length,
            resolverMs: resolved.resolverMs,
            stopReason: fidelityIssue ? "request-not-answerable" : preparedErp ? "erp-data-contract" : focusedBilling ? "focused-billing-recipe" : explicitPie ? "explicit-pie-request" : "no-ai-gateway-credentials",
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
        } catch (error) {
          logCompositionFailure("jev-preflight", error);
          // Composition remains available when the optional capability preflight times out.
        }
        if (uiMemory.decision === "reuse_recipe" && memoryRecipe) {
          send({ type: "step", spec: fallback, diagnostics: { mode: "deterministic", candidateCount: resolved.candidates.length, resolverMs: resolved.resolverMs, stopReason: "reused-prepared-recipe", uiMemory } });
          send({ type: "complete", spec: fallback });
          return;
        }
        try {
          const generated = await composeWithLuna(payload.intent, resolved.candidates, fallback, AbortSignal.timeout(10_000));
          const issue = requestFidelityIssue(payload.intent, generated);
          if (issue) throw new Error(`Generated composition failed request fidelity: ${issue}`);
          send({ type: "step", spec: generated, diagnostics: { mode: "luna", candidateCount: resolved.candidates.length, resolverMs: resolved.resolverMs, uiMemory } });
          send({ type: "complete", spec: generated, diagnostics: { mode: "luna", stopReason: "validated-luna-composition", uiMemory } });
          return;
        } catch (error) {
          logCompositionFailure("luna", error);
          // Jev can still assemble prepared candidates if generation is unavailable or invalid.
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
          signal: AbortSignal.timeout(12_000),
          instructions: {
            root: `Keep one continuous analytical canvas. Reconfigure the existing layout instead of modeling navigation to another page.\n${CANVAS_DESIGN_GUIDELINES}`,
            next: `Choose only configured evidence that answers the request. Preserve useful existing elements when the user asks to add, remove, compare, or restyle a measure.\n${CANVAS_DESIGN_GUIDELINES}`,
            parent: `Place evidence in the root layout default slot in analytical reading order. Multiple requested measures should share one chart when a prepared combined-series candidate exists.\n${CANVAS_DESIGN_GUIDELINES}`,
          },
        })) {
          const designIssue = validateCanvasDesign(event.spec as DashboardSpec);
          const answerIssue = requestFidelityIssue(payload.intent, event.spec as DashboardSpec);
          if (designIssue || answerIssue) {
            send({ type: event.type, spec: fallback, diagnostics: { mode: "deterministic", candidateCount: resolved.candidates.length, resolverMs: resolved.resolverMs, stopReason: designIssue ? `design-guardrail:${designIssue}` : "request-fidelity-guardrail", uiMemory } });
            continue;
          }
          if (event.type === "step") {
            send({ type: "step", spec: event.spec, diagnostics: { mode: "jev", candidateCount: resolved.candidates.length, resolverMs: resolved.resolverMs, uiMemory } });
          } else {
            send({ type: "complete", spec: event.spec, diagnostics: { mode: "jev", stopReason: event.stopReason, uiMemory } });
          }
        }
      } catch (error) {
        logCompositionFailure("jev-composition", error);
        send({ type: "step", spec: fallback, diagnostics: { mode: "deterministic", candidateCount: resolved.candidates.length, resolverMs: resolved.resolverMs, stopReason: "model-composition-unavailable", uiMemory: deterministicCapabilityDecision(memoryRecipe) } });
        send({ type: "complete", spec: fallback });
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
