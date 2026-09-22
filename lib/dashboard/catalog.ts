import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

const span = z.enum(["hero", "half", "wide"]).optional();
const base = { title: z.string(), description: z.string().optional(), span };
const datum = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));
const series = z.array(z.object({ key: z.string(), label: z.string() }));

export const dashboardCatalog = defineCatalog(schema, {
  components: {
    OverviewGrid: { props: z.object({ title: z.string(), subtitle: z.string() }), slots: ["default"], description: "Balanced overview layout with four KPI positions and a dominant chart." },
    AnalysisGrid: { props: z.object({ title: z.string(), subtitle: z.string() }), slots: ["default"], description: "Analytical layout for a metric, evidence charts, and supporting tables." },
    ComparisonLayout: { props: z.object({ title: z.string(), subtitle: z.string() }), slots: ["default"], description: "Side-by-side comparison layout with a shared trend and detailed table." },
    EntityDetail: { props: z.object({ title: z.string(), subtitle: z.string() }), slots: ["default"], description: "Customer or entity detail layout with identity, KPIs, timelines, and records." },
    TableFocus: { props: z.object({ title: z.string(), subtitle: z.string() }), slots: ["default"], description: "Investigation layout centered on a large ranked table." },
    InvestigationLayout: { props: z.object({ title: z.string(), subtitle: z.string() }), slots: ["default"], description: "Evidence-led investigation with a primary finding and supporting proof." },
    StoryLayout: { props: z.object({ title: z.string(), subtitle: z.string() }), slots: ["default"], description: "Narrative analytical layout for a funnel or sequential story." },
    MetricCard: { props: z.object({ label: z.string(), value: z.string(), delta: z.string().optional(), tone: z.enum(["positive", "negative", "neutral"]).optional(), helper: z.string().optional(), action: z.string().optional(), span }), description: "A configured metric with a value, comparison, and optional approved drill-down." },
    LineChartCard: { props: z.object({ ...base, data: z.array(datum), xKey: z.string(), series, format: z.string().optional(), action: z.string().optional() }), description: "A responsive shadcn line chart for time-series evidence." },
    AreaChartCard: { props: z.object({ ...base, data: z.array(datum), xKey: z.string(), series, format: z.string().optional() }), description: "A responsive shadcn area chart for volume or usage trends." },
    BarChartCard: { props: z.object({ ...base, data: z.array(datum), xKey: z.string(), series, format: z.string().optional(), horizontal: z.boolean().optional() }), description: "A responsive shadcn bar chart for discrete contribution comparisons." },
    ComparisonChart: { props: z.object({ ...base, data: z.array(datum), xKey: z.string(), series, format: z.string().optional() }), description: "A two-series shadcn chart for explicit comparisons." },
    DataTable: { props: z.object({ ...base, data: z.array(datum), columns: z.array(z.object({ key: z.string(), label: z.string(), format: z.string().optional() })), rowAction: z.string().optional() }), description: "A configured data table with fixed columns and validated row actions." },
    SegmentTable: { props: z.object({ ...base, data: z.array(datum) }), description: "Segment performance list with approved Enterprise drill-down." },
    InsightCard: { props: z.object({ eyebrow: z.string(), title: z.string(), body: z.string(), stat: z.string(), actionLabel: z.string().optional(), actionIntent: z.string().optional(), span, tone: z.string().optional() }), description: "A concise deterministic insight backed by prepared analytics." },
    FindingCard: { props: z.object({ label: z.string(), title: z.string(), body: z.string(), value: z.string(), valueLabel: z.string() }), description: "Primary finding for an analytical investigation." },
    CustomerHeader: { props: z.object({ name: z.string(), segment: z.string(), status: z.string(), detail: z.string() }), description: "Identity and risk header for a configured customer." },
    MovementCard: { props: z.object({ ...base, data: z.array(datum) }), description: "MRR movement ledger for start, expansion, new, contraction, and churn." },
    ContributionCard: { props: z.object({ ...base, data: z.array(datum), total: z.number() }), description: "Contribution breakdown showing each prepared factor's share of a total." },
    SignalList: { props: z.object({ ...base, items: z.array(z.object({ label: z.string(), value: z.string(), detail: z.string() })) }), description: "Compact evidence list for product, payment, and contract signals." },
    TimelineCard: { props: z.object({ ...base, data: z.array(datum) }), description: "Chronological account event timeline." },
    FunnelCard: { props: z.object({ ...base, data: z.array(datum) }), description: "Acquisition funnel with absolute and step-conversion values." },
    CohortCard: { props: z.object({ ...base, data: z.array(datum) }), description: "Retention cohort matrix with month-one, month-three, and month-six values." },
    ComparisonSummary: { props: z.object({ label: z.string(), value: z.string(), delta: z.string(), detail: z.string(), tone: z.string() }), description: "One side of an entity versus cohort comparison." },
  },
  actions: {},
});
