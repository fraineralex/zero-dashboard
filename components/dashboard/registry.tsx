"use client";

import { defineRegistry, JSONUIProvider, Renderer } from "@json-render/react";
import { Copy, MoveHorizontal, X } from "lucide-react";
import type { DashboardElement, DashboardSpec } from "@/types/analytics";
import { dashboardCatalog } from "@/lib/dashboard/catalog";
import {
  AreaChartCard,
  BarChartCard,
  CohortCard,
  ComparisonChart,
  ComparisonSummary,
  ContributionCard,
  CustomerRanking,
  CustomerHeader,
  DataTable,
  EntityTrendTable,
  FindingCard,
  FunnelCard,
  InsightCard,
  Layout,
  LineChartCard,
  MetricCard,
  MovementCard,
  PieChartCard,
  SegmentTable,
  SignalList,
  TimelineCard,
} from "@/components/dashboard/primitives";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "@/store/dashboard-store";

const { registry } = defineRegistry(dashboardCatalog, {
  components: {
    OverviewGrid: ({ props, children }) => <Layout props={props} variant="overview">{children}</Layout>,
    AnalysisGrid: ({ props, children }) => <Layout props={props} variant="analysis">{children}</Layout>,
    ComparisonLayout: ({ props, children }) => <Layout props={props} variant="comparison">{children}</Layout>,
    EntityDetail: ({ props, children }) => <Layout props={props} variant="entity">{children}</Layout>,
    TableFocus: ({ props, children }) => <Layout props={props} variant="table">{children}</Layout>,
    InvestigationLayout: ({ props, children }) => <Layout props={props} variant="investigation">{children}</Layout>,
    StoryLayout: ({ props, children }) => <Layout props={props} variant="story">{children}</Layout>,
    MetricCard: ({ props }) => <MetricCard props={props} />,
    LineChartCard: ({ props }) => <LineChartCard props={props} />,
    AreaChartCard: ({ props }) => <AreaChartCard props={props} />,
    BarChartCard: ({ props }) => <BarChartCard props={props} />,
    PieChartCard: ({ props }) => <PieChartCard props={props} />,
    ComparisonChart: ({ props }) => <ComparisonChart props={props} />,
    DataTable: ({ props }) => <DataTable props={props} />,
    EntityTrendTable: ({ props }) => <EntityTrendTable props={props} />,
    CustomerRanking: ({ props }) => <CustomerRanking props={props} />,
    SegmentTable: ({ props }) => <SegmentTable props={props} />,
    InsightCard: ({ props }) => <InsightCard props={props} />,
    FindingCard: ({ props }) => <FindingCard props={props} />,
    CustomerHeader: ({ props }) => <CustomerHeader props={props} />,
    MovementCard: ({ props }) => <MovementCard props={props} />,
    ContributionCard: ({ props }) => <ContributionCard props={props} />,
    SignalList: ({ props }) => <SignalList props={props} />,
    TimelineCard: ({ props }) => <TimelineCard props={props} />,
    FunnelCard: ({ props }) => <FunnelCard props={props} />,
    CohortCard: ({ props }) => <CohortCard props={props} />,
    ComparisonSummary: ({ props }) => <ComparisonSummary props={props} />,
  },
});

export function DashboardRenderer({ spec, loading }: { spec: DashboardSpec; loading: boolean }) {
  const root = spec.elements[spec.root];
  const variant = layoutVariants[root?.type];
  if (!root || !variant) {
    return <JSONUIProvider registry={registry} initialState={spec.state ?? {}}><Renderer spec={spec} registry={registry} loading={loading} /></JSONUIProvider>;
  }
  return (
    <JSONUIProvider registry={registry} initialState={spec.state ?? {}}>
      <Layout props={root.props as { title: string; subtitle: string; periodLabel?: string }} variant={variant}>
        {root.children?.map((id) => {
          const element = spec.elements[id];
          if (!element) return null;
          return <CanvasBlock key={id} id={id} element={element}><Renderer spec={{ ...spec, root: id }} registry={registry} loading={loading} fallback={({ element: unknown }) => <div className="dashboard-card">Unknown component: {unknown.type}</div>} /></CanvasBlock>;
        })}
        {!root.children?.length ? <EmptyCanvas /> : null}
      </Layout>
    </JSONUIProvider>
  );
}

const layoutVariants: Record<string, string> = {
  OverviewGrid: "overview",
  AnalysisGrid: "analysis",
  ComparisonLayout: "comparison",
  EntityDetail: "entity",
  TableFocus: "table",
  InvestigationLayout: "investigation",
  StoryLayout: "story",
};

function CanvasBlock({ id, element, children }: { id: string; element: DashboardElement; children: React.ReactNode }) {
  const removeElement = useDashboardStore((state) => state.removeElement);
  const resizeElement = useDashboardStore((state) => state.resizeElement);
  const duplicateElement = useDashboardStore((state) => state.duplicateElement);
  const span = typeof element.props.span === "string" ? element.props.span : undefined;
  return <div className={cn("canvas-block", span && `span-${span}`, element.type === "MetricCard" && "metric-block", element.type === "ComparisonSummary" && "comparison-summary-block", ["FindingCard", "CustomerHeader"].includes(element.type) && "span-wide")}>
    <div className="block-controls" aria-label="Block controls">
      <button onClick={() => resizeElement(id)} title="Change block size" aria-label="Change block size"><MoveHorizontal size={13} /></button>
      <button onClick={() => duplicateElement(id)} title="Duplicate block" aria-label="Duplicate block"><Copy size={12} /></button>
      <button onClick={() => removeElement(id)} title="Remove block" aria-label="Remove block"><X size={13} /></button>
    </div>
    {children}
  </div>;
}

function EmptyCanvas() {
  const open = useDashboardStore((state) => state.setCommandOpen);
  return <div className="empty-canvas"><span>Blank canvas</span><h2>Build exactly the view you need.</h2><p>Open the view library or describe the numbers, comparisons, and level of detail you want.</p><button onClick={() => open(true)}>Add a view</button></div>;
}
