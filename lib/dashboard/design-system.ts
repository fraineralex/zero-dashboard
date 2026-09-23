import type { DashboardSpec } from "@/types/analytics";

export const CANVAS_DESIGN_GUIDELINES = [
  "Compose one responsive analytical canvas, never a new page or sidebar.",
  "Use only catalog components. Their presentation is prepared with shadcn primitives, Tailwind theme utilities, and dashboard tokens; never invent JSX, HTML, CSS, className, style, or colors.",
  "Prioritize the user's requested entity, measure, time period, granularity, sort order, and limit. Every visible card must describe that same analytical scope unless comparison is explicitly requested.",
  "For named customer rankings use CustomerRanking in TableFocus, preserving exact names, requested row count, rank, and non-abbreviated monetary values. Do not substitute a generic chart.",
  "For named customer histories use EntityTrendTable. For multiple measures in one plot use a prepared multi-series chart with correctly labeled units.",
  "Keep the layout compact: no orphan cards, artificial empty columns, filler metrics, or redundant explanations. Put the primary answer first, then only useful supporting evidence.",
  "Use existing surface, text, border, accent, and semantic tokens so the composition works in light and dark themes and on mobile.",
].join("\n");

const approvedTypes = new Set([
  "OverviewGrid", "AnalysisGrid", "ComparisonLayout", "EntityDetail", "TableFocus", "InvestigationLayout", "StoryLayout",
  "MetricCard", "LineChartCard", "AreaChartCard", "BarChartCard", "ComparisonChart", "DataTable", "EntityTrendTable",
  "CustomerRanking", "SegmentTable", "InsightCard", "FindingCard", "CustomerHeader", "MovementCard", "ContributionCard",
  "SignalList", "TimelineCard", "FunnelCard", "CohortCard", "ComparisonSummary",
]);
const layoutTypes = new Set(["OverviewGrid", "AnalysisGrid", "ComparisonLayout", "EntityDetail", "TableFocus", "InvestigationLayout", "StoryLayout"]);
const presentationKeys = new Set(["class", "className", "style", "css", "html", "color", "background", "backgroundColor", "fontFamily"]);

export function validateCanvasDesign(spec: DashboardSpec): string | null {
  if (!spec || !spec.elements || !spec.root || !spec.elements[spec.root]) return "missing-root";
  if (!layoutTypes.has(spec.elements[spec.root].type)) return "unapproved-layout";
  if (Object.keys(spec.elements).length > 20) return "too-many-blocks";

  for (const [id, element] of Object.entries(spec.elements)) {
    if (!approvedTypes.has(element.type)) return `unapproved-component:${id}`;
    if (id !== spec.root && layoutTypes.has(element.type)) return `nested-layout:${id}`;
    if (Object.keys(element.props ?? {}).some((key) => presentationKeys.has(key))) return `unapproved-presentation:${id}`;
    if (element.children?.some((child) => !spec.elements[child])) return `missing-child:${id}`;
  }
  return null;
}
