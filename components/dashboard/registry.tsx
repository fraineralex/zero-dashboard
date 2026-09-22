"use client";

import { defineRegistry, JSONUIProvider, Renderer } from "@json-render/react";
import type { DashboardSpec } from "@/types/analytics";
import { dashboardCatalog } from "@/lib/dashboard/catalog";
import {
  AreaChartCard,
  BarChartCard,
  CohortCard,
  ComparisonChart,
  ComparisonSummary,
  ContributionCard,
  CustomerHeader,
  DataTable,
  FindingCard,
  FunnelCard,
  InsightCard,
  Layout,
  LineChartCard,
  MetricCard,
  MovementCard,
  SegmentTable,
  SignalList,
  TimelineCard,
} from "@/components/dashboard/primitives";

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
    ComparisonChart: ({ props }) => <ComparisonChart props={props} />,
    DataTable: ({ props }) => <DataTable props={props} />,
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
  return (
    <JSONUIProvider registry={registry} initialState={spec.state ?? {}}>
      <Renderer spec={spec} registry={registry} loading={loading} fallback={({ element }) => <div className="dashboard-card">Unknown component: {element.type}</div>} />
    </JSONUIProvider>
  );
}
