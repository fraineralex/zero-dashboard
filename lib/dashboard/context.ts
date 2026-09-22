import type { AnalyticsArea, AnalyticsContext } from "@/types/analytics";

export const DEFAULT_PERIOD = {
  from: "2026-09-01",
  to: "2026-09-30",
  label: "September 2026",
};

export function createContext(area: AnalyticsArea): AnalyticsContext {
  return {
    area,
    period: DEFAULT_PERIOD,
    comparison: { type: "previous_period" },
  };
}

export const DEFAULT_CONTEXTS: Record<AnalyticsArea, AnalyticsContext> = {
  overview: createContext("overview"),
  revenue: createContext("revenue"),
  customers: createContext("customers"),
  retention: createContext("retention"),
  acquisition: createContext("acquisition"),
  payments: createContext("payments"),
};

export function breadcrumbFor(context: AnalyticsContext) {
  const parts = ["Company"];
  if (context.area !== "overview") parts.push(context.area[0].toUpperCase() + context.area.slice(1));
  if (context.segment) parts.push(context.segment);
  if (context.entityId === "acme") parts.push("Acme Corp");
  if (context.investigation === "enterprise_decline") parts.push("Revenue decline");
  if (context.investigation === "decline_customers") parts.push("Contributors");
  if (context.investigation === "cohort_comparison") parts.push("Peer comparison");
  return parts;
}

export function suggestionsFor(context: AnalyticsContext): string[] {
  if (context.entityId === "acme") {
    return [
      "Compare Acme with similar customers",
      "Show payment history",
      "Show usage decline",
      "What changed recently?",
    ];
  }
  if (context.investigation === "decline_customers") {
    return ["Open Acme", "Compare the top three losses", "Show failed payments", "Group by loss type"];
  }
  if (context.segment === "Enterprise") {
    return [
      "Show me why enterprise revenue dropped this month",
      "Which customers are responsible for most of that decline?",
      "Compare with last month",
      "Show failed payments",
    ];
  }
  if (context.area === "revenue") {
    return [
      "Why did revenue drop?",
      "Show Enterprise only",
      "Compare with last month",
      "Break down by plan",
      "Which customers drive the most revenue?",
    ];
  }
  if (context.area === "customers") {
    return ["Which customers are at risk?", "Show highest value customers", "Open Acme", "Group by plan"];
  }
  if (context.area === "retention") {
    return ["What is driving churn?", "Show retention by cohort", "Which accounts canceled?", "Compare with last month"];
  }
  if (context.area === "acquisition") {
    return ["Which source converts best?", "Show the acquisition funnel", "Compare paid and organic", "Where do trials drop?"];
  }
  return [
    "Why did revenue change?",
    "Which customers are at risk?",
    "Show enterprise performance",
    "What's driving churn?",
    "Compare this month with last month",
  ];
}

export function contextFromIntent(intent: string, current: AnalyticsContext): AnalyticsContext {
  const normalized = intent.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (/compare acme|similar customers|peers/.test(normalized)) {
    return { ...createContext("customers"), entityType: "customer", entityId: "acme", investigation: "cohort_comparison", comparison: { type: "cohort", value: "enterprise-similar-mrr" } };
  }
  if (/open acme|show acme|acme corp/.test(normalized)) {
    return { ...createContext("customers"), entityType: "customer", entityId: "acme", investigation: "customer_risk" };
  }
  if (/which customers|responsible|contributors|most of that decline/.test(normalized)) {
    return { ...createContext("revenue"), segment: "Enterprise", investigation: "decline_customers" };
  }
  if (/why.*enterprise|enterprise.*drop|enterprise.*decline/.test(normalized)) {
    return { ...createContext("revenue"), segment: "Enterprise", investigation: "enterprise_decline" };
  }
  if (/enterprise/.test(normalized)) return { ...createContext("revenue"), segment: "Enterprise" };
  if (/acquisition|adquisicion|conversion|funnel|embudo|source|fuente/.test(normalized)) return createContext("acquisition");
  if (/retention|retencion|churn|abandono|cohort|cohorte/.test(normalized)) return createContext("retention");
  if (/customer|cliente|account|cuenta/.test(normalized)) return createContext("customers");
  if (/revenue|ingreso|entrada de dinero|cash|cobro|mrr|arr|plan|factur/.test(normalized)) return createContext("revenue");
  return { ...current, investigation: current.investigation };
}
