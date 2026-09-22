import "server-only";

import type { Experimental_CompositionEvaluator } from "@json-render/core";
import type { UiRecipeManifest } from "@/lib/ui-memory/registry";
import type { CompositionDiagnostics } from "@/types/analytics";

type MemoryDecision = NonNullable<CompositionDiagnostics["uiMemory"]>;

export function deterministicCapabilityDecision(recipe: UiRecipeManifest | null): MemoryDecision {
  return recipe
    ? { decision: "reuse_recipe", source: "deterministic", recipeId: recipe.id, recipeVersion: recipe.version }
    : { decision: "compose_existing", source: "deterministic" };
}

export async function evaluateCapabilityDecision(intent: string, recipe: UiRecipeManifest | null, evaluate: Experimental_CompositionEvaluator, signal: AbortSignal): Promise<MemoryDecision> {
  const criteria: Record<string, string> = {
    compose_existing: "The request can be fully expressed by rearranging ordinary metrics, charts, tables, and insights already available.",
    generate_recipe: "The request requires a reusable interaction or information architecture that the available components and retrieved recipes do not fully express.",
  };
  if (recipe) criteria.reuse_recipe = `Reuse ${recipe.name} v${recipe.version}. It provides: ${recipe.capabilities.join(", ")}. Required data: ${recipe.requiredData.join(", ")}.`;
  const result = await evaluate({
    state: {},
    questions: {
      capability: {
        type: "choice",
        instructions: `Decide how to satisfy this analytics request: “${intent}”. Prefer a retrieved recipe when it covers identity, measures, detail, trends, and requested interactions. Choose generate_recipe only for a genuine capability gap, not merely a different title or filter.`,
        criteria,
      },
    },
    signal,
  });
  const choice = result.answers.capability?.choice;
  const decision = choice === "reuse_recipe" || choice === "generate_recipe" ? choice : "compose_existing";
  return { decision, source: "jev", ...(decision === "reuse_recipe" && recipe ? { recipeId: recipe.id, recipeVersion: recipe.version } : {}) };
}

