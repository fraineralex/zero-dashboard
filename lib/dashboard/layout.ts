import type { DashboardElement } from "@/types/analytics";

/** Pack each run of compact cards into complete rows; full-width evidence starts a new row. */
export function balancedCanvasSpans(ids: string[], elements: Record<string, DashboardElement>): Record<string, number> {
  const spans: Record<string, number> = {};
  let pending: string[] = [];
  const flush = () => {
    if (!pending.length) return;
    const width = 12 / pending.length;
    pending.forEach((id) => { spans[id] = width; });
    pending = [];
  };
  for (const id of ids) {
    const element = elements[id];
    if (!element) continue;
    const compact = element.type === "MetricCard" || element.props.span === "half" || element.props.span === "hero" || element.type === "ComparisonSummary";
    if (!compact) {
      flush();
      spans[id] = 12;
      continue;
    }
    const isLargeCard = element.props.span === "half" && element.type !== "MetricCard";
    const pendingHasLargeCard = pending.some((pendingId) => elements[pendingId]?.props.span === "half" && elements[pendingId]?.type !== "MetricCard");
    if (pending.length >= 2 && (isLargeCard || pendingHasLargeCard)) flush();
    pending.push(id);
    if (pending.length === 4 || (pending.length === 2 && isLargeCard && pendingHasLargeCard)) flush();
  }
  flush();
  return spans;
}
