import type { Experimental_CompositionCandidate } from "@json-render/core";
import { buildDefaultSpec, buildIntentSpec } from "@/lib/dashboard/specs";
import type { AnalyticsContext, DashboardElement } from "@/types/analytics";

const descriptions: Record<string, string> = {
  OverviewGrid: "Use for a company-wide overview with multiple KPIs and broad trends.",
  AnalysisGrid: "Use for a focused area such as revenue, retention, or customers.",
  ComparisonLayout: "Use when the intent explicitly compares Acme with similar customers.",
  EntityDetail: "Use when the intent opens a specific customer such as Acme.",
  TableFocus: "Use when the question asks which customers contributed most.",
  InvestigationLayout: "Use when the user asks why a measured change happened.",
  StoryLayout: "Use for acquisition funnel and sequential conversion analysis.",
  MetricCard: "Prepared KPI. Select only if it directly supports the requested context.",
  LineChartCard: "Prepared time-series evidence with application-owned values.",
  AreaChartCard: "Prepared volume trend with application-owned values.",
  BarChartCard: "Prepared categorical comparison with application-owned values.",
  PieChartCard: "Prepared part-to-whole chart when the user explicitly asks for a pie, tarta, or pastel. Uses application-owned values and a full labeled legend.",
  ComparisonChart: "Prepared two-series comparison with application-owned values.",
  DataTable: "Prepared ranked records with fixed columns and approved actions.",
  EntityTrendTable: "UI Memory recipe for identifiable customers with current billing, individual twelve-month trends, search, sorting, and multi-customer comparison.",
  CustomerRanking: "Prepared customer ranking; every row and summary uses the same requested month and cohort.",
  SegmentTable: "Prepared segment performance and deterministic drill-down.",
  InsightCard: "Prepared analytical conclusion already derived by the local engine.",
  FindingCard: "Prepared primary finding for the requested investigation.",
  CustomerHeader: "Prepared Acme customer identity and risk status.",
  MovementCard: "Prepared MRR movement ledger.",
  ContributionCard: "Prepared breakdown of drivers behind a measured change.",
  SignalList: "Prepared signals that support a finding.",
  TimelineCard: "Prepared customer event history.",
  FunnelCard: "Prepared acquisition funnel.",
  CohortCard: "Prepared retention cohort matrix.",
  ComparisonSummary: "Prepared comparison summary for Acme or its peer cohort.",
};

function candidateFromElement(id: string, element: DashboardElement, root = false): Experimental_CompositionCandidate {
  return {
    id,
    description: `${descriptions[element.type] ?? "Prepared analytics component."} Candidate: ${id.replaceAll("-", " ")}.`,
    root,
    element: { type: element.type, props: element.props },
  };
}

export function resolveCandidates(context: AnalyticsContext, intent: string) {
  const started = performance.now();
  const preferred = buildIntentSpec(intent, context);
  const rootElement = preferred.elements[preferred.root];
  const candidates: Experimental_CompositionCandidate[] = [candidateFromElement(`layout-${rootElement.type}`, { ...rootElement, children: undefined }, true)];
  for (const [id, element] of Object.entries(preferred.elements)) {
    if (id === preferred.root) continue;
    candidates.push(candidateFromElement(id, element));
  }

  // A small adjacent option set gives Jev meaningful discrete choices without
  // exposing the full component universe or raw customer records.
  const adjacentContexts: AnalyticsContext[] = [];
  if (context.area === "revenue" && context.segment === "Enterprise" && !context.investigation) {
    adjacentContexts.push({ ...context, investigation: "enterprise_decline" });
  }
  if (context.investigation === "enterprise_decline") {
    adjacentContexts.push({ ...context, investigation: "decline_customers" });
  }
  if (context.entityId === "acme" && context.investigation !== "cohort_comparison") {
    adjacentContexts.push({ ...context, investigation: "cohort_comparison", comparison: { type: "cohort", value: "enterprise-similar-mrr" } });
  }
  for (const adjacent of adjacentContexts) {
    const adjacentSpec = buildDefaultSpec(adjacent);
    for (const [id, element] of Object.entries(adjacentSpec.elements)) {
      if (id === adjacentSpec.root || candidates.some((candidate) => candidate.id === `alternative-${id}` || candidate.id === id)) continue;
      candidates.push({ ...candidateFromElement(`alternative-${id}`, element), resource: id });
    }
  }

  return {
    candidates: candidates.slice(0, 20),
    resolverMs: Math.round((performance.now() - started) * 10) / 10,
    preferred,
    context: {
      area: context.area,
      segment: context.segment,
      entity: context.entityId === "acme" ? "Acme Corp" : undefined,
      investigation: context.investigation,
      intent,
    },
  };
}
