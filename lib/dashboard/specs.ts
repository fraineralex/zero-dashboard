import { analytics } from "@/lib/analytics/engine";
import type { AnalyticsContext, DashboardElement, DashboardSpec } from "@/types/analytics";

const usd = (value: number, compact = true) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: compact ? "compact" : "standard", maximumFractionDigits: compact ? 1 : 0 }).format(value);
const number = (value: number) => new Intl.NumberFormat("en-US").format(value);
const delta = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

function node(type: string, props: Record<string, unknown>, children?: string[]): DashboardElement {
  return { type, props, ...(children ? { children } : {}) };
}

function spec(layout: string, title: string, subtitle: string, elements: Record<string, DashboardElement>, children: string[]): DashboardSpec {
  return {
    root: "root",
    state: {},
    elements: {
      root: node(layout, { title, subtitle }, children),
      ...elements,
    },
  };
}

function overviewSpec(): DashboardSpec {
  const a = analytics;
  return spec("OverviewGrid", "Business overview", "September 2026 · Compared with August", {
    revenue: node("MetricCard", { label: "Revenue", value: usd(a.revenue.current), delta: delta(a.revenue.delta), tone: a.revenue.delta < 0 ? "negative" : "positive", helper: "Monthly recurring revenue", action: "revenue" }),
    customers: node("MetricCard", { label: "Customers", value: number(a.customers.total), delta: `+${a.customers.newThisMonth}`, tone: "neutral", helper: "New this month", action: "customers" }),
    churn: node("MetricCard", { label: "Churn", value: `${a.retention.churnRate.toFixed(1)}%`, delta: "+0.8 pts", tone: "negative", helper: "Customer churn", action: "retention" }),
    conversion: node("MetricCard", { label: "Conversion", value: `${a.acquisition.conversion.toFixed(1)}%`, delta: "+0.6 pts", tone: "positive", helper: "Visitor to customer", action: "acquisition" }),
    trend: node("LineChartCard", { title: "Revenue trend", description: "Twelve-month recurring revenue", data: a.revenue.history, xKey: "month", series: [{ key: "revenue", label: "Revenue" }], format: "currency", span: "wide", action: "revenue" }),
    plans: node("BarChartCard", { title: "Revenue by plan", description: "Current monthly recurring revenue", data: a.revenue.byPlan, xKey: "name", series: [{ key: "value", label: "MRR" }], format: "currency", span: "half" }),
    customersTrend: node("AreaChartCard", { title: "New customers", description: "Monthly additions", data: a.months.map((month, i) => ({ month, customers: 98 + i * 4 + (i % 3) * 17 })), xKey: "month", series: [{ key: "customers", label: "Customers" }], format: "number", span: "half" }),
    funnel: node("FunnelCard", { title: "Acquisition funnel", description: "September conversion journey", data: a.acquisition.funnel, span: "half" }),
    churnTrend: node("AreaChartCard", { title: "Churn trend", description: "Monthly customer churn", data: a.retention.history, xKey: "month", series: [{ key: "churn", label: "Churn" }], format: "percent", span: "half" }),
    risk: node("InsightCard", { eyebrow: "Suggested from your data", title: "Enterprise MRR fell sharply", body: `${usd(Math.abs(a.enterprise.current - a.enterprise.previous))} less MRR than August. Acme and Meridian account for most of the decline.`, stat: delta(a.enterprise.delta), actionLabel: "Investigate decline", actionIntent: "Show me why enterprise revenue dropped this month", span: "wide", tone: "negative" }),
  }, ["revenue", "customers", "churn", "conversion", "trend", "plans", "customersTrend", "funnel", "churnTrend", "risk"]);
}

function revenueSpec(context: AnalyticsContext): DashboardSpec {
  const a = analytics;
  if (context.segment === "Enterprise") return enterpriseSpec(context);
  return spec("AnalysisGrid", "Revenue", "September 2026 · All segments", {
    summary: node("MetricCard", { label: "Monthly revenue", value: usd(a.revenue.current), delta: delta(a.revenue.delta), tone: a.revenue.delta < 0 ? "negative" : "positive", helper: `Previous ${usd(a.revenue.previous)}`, span: "hero" }),
    previous: node("MetricCard", { label: "Previous period", value: usd(a.revenue.previous), delta: "August", tone: "neutral", helper: "Comparison baseline" }),
    movementValue: node("MetricCard", { label: "Net movement", value: usd(a.revenue.current - a.revenue.previous), delta: delta(a.revenue.delta), tone: a.revenue.delta < 0 ? "negative" : "positive", helper: "Month over month" }),
    trend: node("LineChartCard", { title: "Revenue over time", description: "Monthly recurring revenue", data: a.revenue.history, xKey: "month", series: [{ key: "revenue", label: "Revenue" }], format: "currency", span: "wide" }),
    plan: node("BarChartCard", { title: "Revenue by plan", description: "Click Enterprise in the segment control to drill down", data: a.revenue.byPlan, xKey: "name", series: [{ key: "value", label: "MRR" }], format: "currency", span: "half" }),
    country: node("BarChartCard", { title: "Top countries", description: "Current MRR by billing country", data: a.revenue.byCountry.slice(0, 5), xKey: "name", series: [{ key: "value", label: "MRR" }], format: "currency", span: "half", horizontal: true }),
    movement: node("MovementCard", { title: "MRR movement", description: "What changed since August", data: a.revenue.movement, span: "half" }),
    segments: node("SegmentTable", { title: "Segment performance", description: "Enterprise is the largest negative contributor", data: a.revenue.bySegment.map((row) => ({ ...row, change: row.name === "Enterprise" ? a.enterprise.delta.toFixed(1) : row.name === "Growth" ? 3.4 : 1.8 })), span: "half" }),
    customers: node("DataTable", { title: "Largest customers", description: "Ranked by current MRR", data: a.customers.top, columns: [{ key: "customer", label: "Customer" }, { key: "segment", label: "Segment" }, { key: "mrr", label: "MRR", format: "currency" }, { key: "status", label: "Status" }], span: "wide", rowAction: "customer" }),
  }, ["summary", "previous", "movementValue", "trend", "plan", "country", "movement", "segments", "customers"]);
}

function enterpriseSpec(context: AnalyticsContext): DashboardSpec {
  const a = analytics;
  if (context.investigation === "enterprise_decline") return declineInvestigationSpec();
  if (context.investigation === "decline_customers") return declineCustomersSpec();
  return spec("AnalysisGrid", "Enterprise revenue", "September 2026 · Enterprise segment", {
    summary: node("MetricCard", { label: "Enterprise MRR", value: usd(a.enterprise.current), delta: delta(a.enterprise.delta), tone: "negative", helper: `Previous ${usd(a.enterprise.previous)}`, span: "hero" }),
    accounts: node("MetricCard", { label: "Enterprise accounts", value: number(a.enterprise.customers.length + 78), delta: "−2", tone: "negative", helper: "Active accounts" }),
    atrisk: node("MetricCard", { label: "Revenue at risk", value: usd(a.enterprise.losses.reduce((sum, item) => sum + Number(item.value), 0)), delta: "+34%", tone: "negative", helper: "From payments and contraction" }),
    trend: node("LineChartCard", { title: "Enterprise revenue", description: "The September change is concentrated in four accounts", data: a.enterprise.history, xKey: "month", series: [{ key: "revenue", label: "Enterprise MRR" }], format: "currency", span: "wide" }),
    losses: node("BarChartCard", { title: "Lost revenue", description: "By loss mechanism", data: a.enterprise.losses, xKey: "name", series: [{ key: "value", label: "MRR lost" }], format: "currency", span: "half" }),
    finding: node("InsightCard", { eyebrow: "Anomaly detected", title: "Five accounts explain 71% of the decline", body: "One cancellation, two large contractions, and higher failed-payment exposure drove the month-over-month change.", stat: "71%", actionLabel: "Explain the decline", actionIntent: "Show me why enterprise revenue dropped this month", span: "half", tone: "negative" }),
    table: node("DataTable", { title: "Enterprise customers losing revenue", description: "Sorted by month-over-month contribution", data: a.enterprise.customers, columns: [{ key: "customer", label: "Customer" }, { key: "previous", label: "Aug MRR", format: "currency" }, { key: "current", label: "Sep MRR", format: "currency" }, { key: "decline", label: "Change", format: "currency" }, { key: "status", label: "Signal" }], rowAction: "customer", span: "wide" }),
  }, ["summary", "accounts", "atrisk", "trend", "losses", "finding", "table"]);
}

function declineInvestigationSpec(): DashboardSpec {
  const a = analytics;
  const totalLoss = Math.abs(a.enterprise.current - a.enterprise.previous);
  return spec("InvestigationLayout", "Why enterprise revenue dropped", "Evidence-led investigation · September vs August", {
    finding: node("FindingCard", { label: "Primary finding", title: "The decline is account-concentrated, not broad-based", body: `Enterprise MRR fell ${delta(a.enterprise.delta)}. Acme, Meridian, Northstar, and Helix explain most of the ${usd(totalLoss)} net decline.`, value: usd(totalLoss), valueLabel: "net MRR decline" }),
    trend: node("ComparisonChart", { title: "Current vs previous trajectory", description: "September breaks from the prior enterprise trend", data: a.enterprise.history.map((item, index) => ({ ...item, baseline: index === 11 ? a.enterprise.previous : item.revenue })), xKey: "month", series: [{ key: "revenue", label: "Actual" }, { key: "baseline", label: "Prior run-rate" }], format: "currency", span: "wide" }),
    losses: node("ContributionCard", { title: "Loss composition", description: "Cancellation, contraction, and payment risk", data: a.enterprise.losses, total: totalLoss, span: "half" }),
    signals: node("SignalList", { title: "What changed", description: "Signals preceding the revenue movement", items: [{ label: "Seat contraction", value: "−111 seats", detail: "Acme and Northstar" }, { label: "Canceled MRR", value: usd(5400), detail: "Meridian Systems" }, { label: "Failed payments", value: "7 attempts", detail: "Acme and Helix" }], span: "half" }),
    accounts: node("DataTable", { title: "Accounts behind the movement", description: "Ranked by negative MRR contribution", data: a.enterprise.customers, columns: [{ key: "customer", label: "Customer" }, { key: "decline", label: "MRR contribution", format: "currency" }, { key: "failed", label: "Failed payments" }, { key: "status", label: "Primary signal" }], rowAction: "customer", span: "wide" }),
  }, ["finding", "trend", "losses", "signals", "accounts"]);
}

function declineCustomersSpec(): DashboardSpec {
  const a = analytics;
  const total = Math.abs(a.enterprise.customers.reduce((sum, row) => sum + Number(row.decline), 0));
  return spec("TableFocus", "Customers driving the decline", "Enterprise · September vs August", {
    summary: node("FindingCard", { label: "Concentration", title: "Acme and Meridian are the largest contributors", body: "The top two accounts account for more than half of gross enterprise MRR losses. Payment failures make Acme the most actionable account.", value: "56%", valueLabel: "from top two accounts" }),
    contribution: node("BarChartCard", { title: "Revenue loss by customer", description: "Gross negative contribution", data: a.enterprise.customers.map((row) => ({ name: String(row.customer).split(" ")[0], value: Math.abs(Number(row.decline)) })), xKey: "name", series: [{ key: "value", label: "MRR loss" }], format: "currency", span: "wide" }),
    table: node("DataTable", { title: "Enterprise loss contributors", description: `${usd(total)} gross MRR loss across the leading accounts`, data: a.enterprise.customers, columns: [{ key: "customer", label: "Customer" }, { key: "previous", label: "Aug MRR", format: "currency" }, { key: "current", label: "Sep MRR", format: "currency" }, { key: "decline", label: "Change", format: "currency" }, { key: "failed", label: "Failed payments" }, { key: "status", label: "Signal" }], rowAction: "customer", span: "wide" }),
  }, ["summary", "contribution", "table"]);
}

function customerSpec(context: AnalyticsContext): DashboardSpec {
  const a = analytics;
  if (context.investigation === "cohort_comparison") return comparisonSpec();
  return spec("EntityDetail", "Acme Corp", "Enterprise customer · High risk", {
    header: node("CustomerHeader", { name: a.acme.name, segment: "Enterprise · Scale plan", status: a.acme.risk, detail: "Customer since October 2025 · United States" }),
    mrr: node("MetricCard", { label: "MRR", value: usd(a.acme.mrr, false), delta: delta(((a.acme.mrr - a.acme.previousMrr) / a.acme.previousMrr) * 100), tone: "negative", helper: `From ${usd(a.acme.previousMrr, false)}` }),
    arr: node("MetricCard", { label: "ARR", value: usd(a.acme.arr, false), delta: "−40.8%", tone: "negative", helper: "Annualized run-rate" }),
    usage: node("MetricCard", { label: "Usage", value: `${a.acme.usageHistory[11].usage}`, delta: delta(a.acme.usageDelta), tone: "negative", helper: "Weekly active users" }),
    payments: node("MetricCard", { label: "Failed payments", value: String(a.acme.failedPayments), delta: "+2", tone: "negative", helper: "In September" }),
    revenue: node("LineChartCard", { title: "Revenue history", description: "MRR fell after the September seat reduction", data: a.acme.revenueHistory, xKey: "month", series: [{ key: "revenue", label: "MRR" }], format: "currency", span: "wide" }),
    usageChart: node("AreaChartCard", { title: "Product usage", description: "Weekly active users", data: a.acme.usageHistory, xKey: "month", series: [{ key: "usage", label: "WAU" }], format: "number", span: "half" }),
    timeline: node("TimelineCard", { title: "Recent events", description: "Revenue, product, and support signals", data: a.acme.timeline, span: "half" }),
    paymentTable: node("DataTable", { title: "Payment history", description: "Three failed attempts this month", data: a.acme.payments, columns: [{ key: "date", label: "Date" }, { key: "amount", label: "Amount" }, { key: "method", label: "Method" }, { key: "status", label: "Status" }], span: "wide" }),
  }, ["header", "mrr", "arr", "usage", "payments", "revenue", "usageChart", "timeline", "paymentTable"]);
}

function comparisonSpec(): DashboardSpec {
  const a = analytics;
  return spec("ComparisonLayout", "Acme compared with similar customers", "Enterprise cohort · Similar August MRR", {
    acme: node("ComparisonSummary", { label: "Acme Corp", value: usd(a.acme.mrr, false), delta: "−40.8%", detail: "3 failed payments · Usage −41.8%", tone: "negative" }),
    cohort: node("ComparisonSummary", { label: "Peer median", value: usd(6920, false), delta: "+1.9%", detail: "0 failed payments · Usage +3.2%", tone: "positive" }),
    chart: node("ComparisonChart", { title: "MRR trajectory", description: "Acme diverged materially from its peer cohort in September", data: a.acme.revenueHistory.map((row, index) => ({ ...row, peers: Math.round(6100 + index * 82 + Math.sin(index) * 90) })), xKey: "month", series: [{ key: "revenue", label: "Acme" }, { key: "peers", label: "Peer median" }], format: "currency", span: "wide" }),
    risk: node("InsightCard", { eyebrow: "Comparison finding", title: "Acme is the cohort outlier", body: "Peers grew MRR and usage while Acme contracted seats, usage, and payment reliability at the same time.", stat: "−42.7 pts", span: "half", tone: "negative" }),
    signals: node("SignalList", { title: "Relative signals", description: "Acme vs peer median", items: [{ label: "MRR change", value: "−40.8%", detail: "Peers +1.9%" }, { label: "Usage change", value: "−41.8%", detail: "Peers +3.2%" }, { label: "Payment failures", value: "3", detail: "Peers 0" }], span: "half" }),
    table: node("DataTable", { title: "Comparison cohort", description: "Enterprise customers with similar prior-period MRR", data: a.acme.comparison, columns: [{ key: "customer", label: "Customer" }, { key: "mrr", label: "MRR", format: "currency" }, { key: "change", label: "Change", format: "percent" }, { key: "usage", label: "Usage" }, { key: "failed", label: "Failed payments" }, { key: "seats", label: "Seats" }], span: "wide" }),
  }, ["acme", "cohort", "chart", "risk", "signals", "table"]);
}

function customersSpec(): DashboardSpec {
  const a = analytics;
  return spec("AnalysisGrid", "Customers", "Portfolio health · September 2026", {
    total: node("MetricCard", { label: "Total customers", value: number(a.customers.total), delta: `+${a.customers.newThisMonth}`, tone: "positive", helper: "New this month", span: "hero" }),
    active: node("MetricCard", { label: "Active", value: number(a.customers.active), delta: "98.1%", tone: "positive", helper: "Of all customers" }),
    risk: node("MetricCard", { label: "At risk", value: number(a.customers.atRisk), delta: "+14", tone: "negative", helper: "Payment or usage signal" }),
    distribution: node("BarChartCard", { title: "Customers by segment", description: "Current account distribution", data: a.revenue.bySegment.map((row) => ({ name: row.name, value: Math.max(12, Math.round(Number(row.value) / 760)) })), xKey: "name", series: [{ key: "value", label: "Customers" }], format: "number", span: "half" }),
    note: node("InsightCard", { eyebrow: "Portfolio signal", title: "Payment risk is rising", body: `${a.customers.atRisk} customers have a failed payment or past-due balance. Enterprise exposure is concentrated in Acme and Helix.`, stat: "+34%", actionLabel: "Open Acme", actionIntent: "Open Acme", span: "half", tone: "negative" }),
    table: node("DataTable", { title: "Largest customers", description: "Click Acme to inspect the account", data: a.customers.top, columns: [{ key: "customer", label: "Customer" }, { key: "segment", label: "Segment" }, { key: "mrr", label: "MRR", format: "currency" }, { key: "status", label: "Status" }], rowAction: "customer", span: "wide" }),
  }, ["total", "active", "risk", "distribution", "note", "table"]);
}

function retentionSpec(): DashboardSpec {
  const a = analytics;
  return spec("AnalysisGrid", "Retention", "Customer health and recurring retention", {
    churn: node("MetricCard", { label: "Customer churn", value: `${a.retention.churnRate.toFixed(1)}%`, delta: "+0.8 pts", tone: "negative", helper: "September", span: "hero" }),
    nrr: node("MetricCard", { label: "Net revenue retention", value: `${a.retention.netRetention.toFixed(1)}%`, delta: "−2.4 pts", tone: "negative", helper: "Trailing 30 days" }),
    saved: node("MetricCard", { label: "Revenue saved", value: "$18.6K", delta: "+12%", tone: "positive", helper: "Recovery workflows" }),
    trend: node("ComparisonChart", { title: "Retention trend", description: "Churn and net revenue retention", data: a.retention.history, xKey: "month", series: [{ key: "churn", label: "Churn" }, { key: "nrr", label: "NRR" }], format: "percent", span: "wide" }),
    cohorts: node("CohortCard", { title: "Retention cohorts", description: "Percent of starting accounts retained", data: a.retention.cohorts, span: "half" }),
    insight: node("InsightCard", { eyebrow: "Retention signal", title: "Enterprise contraction is pulling NRR below 100%", body: "Logo churn remains contained, but seat contraction and one large cancellation reduced expansion coverage.", stat: "96.7%", span: "half", tone: "negative" }),
  }, ["churn", "nrr", "saved", "trend", "cohorts", "insight"]);
}

function acquisitionSpec(): DashboardSpec {
  const a = analytics;
  return spec("StoryLayout", "Acquisition", "September 2026 · All channels", {
    conversion: node("MetricCard", { label: "Visitor conversion", value: `${a.acquisition.conversion.toFixed(1)}%`, delta: "+0.6 pts", tone: "positive", helper: "Visitor to customer", span: "hero" }),
    cac: node("MetricCard", { label: "Blended CAC", value: "$286", delta: "−8.1%", tone: "positive", helper: "Cost per acquired customer" }),
    pipeline: node("MetricCard", { label: "New MRR", value: "$19.2K", delta: "+11.4%", tone: "positive", helper: "From new customers" }),
    funnel: node("FunnelCard", { title: "Acquisition funnel", description: "Conversion from visit to paid customer", data: a.acquisition.funnel, span: "wide" }),
    sources: node("BarChartCard", { title: "Customers by source", description: "September acquisitions", data: a.acquisition.bySource, xKey: "name", series: [{ key: "customers", label: "Customers" }], format: "number", span: "half" }),
    insight: node("InsightCard", { eyebrow: "Channel finding", title: "Partner traffic converts at 2.4× the average", body: "Partner volume is lower than paid search, but activation and close rates are materially stronger.", stat: "2.4×", span: "half", tone: "positive" }),
  }, ["conversion", "cac", "pipeline", "funnel", "sources", "insight"]);
}

type CustomSeries = { key: string; label: string; format: "currency" | "percent" | "number"; axis?: "left" | "right" };

const normalizeIntent = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function requestedSeries(intent: string, daily: boolean): CustomSeries[] {
  const normalized = normalizeIntent(intent);
  const matches: CustomSeries[] = [];
  const add = (series: CustomSeries, pattern: RegExp) => { if (pattern.test(normalized) && !matches.some((item) => item.key === series.key)) matches.push(series); };
  if (daily) {
    add({ key: "cashIn", label: "Cash in", format: "currency" }, /entrada(s)? de dinero|cash ?in|cobro|ingreso|revenue/);
    add({ key: "subscriptions", label: "Subscriptions", format: "currency" }, /suscrip|subscription|mrr/);
    add({ key: "invoices", label: "Invoices paid", format: "currency" }, /factur|invoice/);
    add({ key: "refunds", label: "Refunds", format: "currency" }, /reembolso|refund/);
    add({ key: "cashOut", label: "Cash out", format: "currency" }, /salida(s)? de dinero|egreso|cash ?out|gasto/);
    add({ key: "netCash", label: "Net cash", format: "currency" }, /neto|net cash|flujo de caja|cash flow/);
    add({ key: "newCustomers", label: "New customers", format: "number", axis: "right" }, /cliente|customer/);
    add({ key: "failedPayments", label: "Failed payments", format: "number", axis: "right" }, /pago(s)? fallido|failed payment/);
    return matches.length ? matches : [
      { key: "cashIn", label: "Cash in", format: "currency" },
      { key: "subscriptions", label: "Subscriptions", format: "currency" },
      { key: "invoices", label: "Invoices paid", format: "currency" },
    ];
  }
  add({ key: "revenue", label: "Revenue", format: "currency" }, /ingreso|revenue|mrr|factur/);
  add({ key: "enterpriseRevenue", label: "Enterprise revenue", format: "currency" }, /enterprise|empresarial/);
  add({ key: "customers", label: "Customers", format: "number", axis: "right" }, /cliente|customer|cuenta/);
  add({ key: "newCustomers", label: "New customers", format: "number", axis: "right" }, /nuevo(s)? cliente|new customer/);
  add({ key: "churn", label: "Churn", format: "percent", axis: "right" }, /churn|abandono|cancelacion/);
  add({ key: "nrr", label: "NRR", format: "percent", axis: "right" }, /nrr|retencion|retention/);
  add({ key: "conversion", label: "Conversion", format: "percent", axis: "right" }, /conversion/);
  return matches;
}

function customChartType(intent: string) {
  const normalized = normalizeIntent(intent);
  if (/barra|bar chart|column/.test(normalized)) return "BarChartCard";
  if (/area|rellen/.test(normalized)) return "AreaChartCard";
  return "LineChartCard";
}

export function buildIntentSpec(intent: string, context: AnalyticsContext, initialSpec?: DashboardSpec): DashboardSpec {
  const normalized = normalizeIntent(intent);
  const previousChart = initialSpec ? Object.values(initialSpec.elements).find((element) => ["LineChartCard", "AreaChartCard", "BarChartCard", "ComparisonChart"].includes(element.type)) : undefined;
  const previousWasDaily = previousChart?.props.xKey === "day";
  const daily = /dia a dia|diari|por dia|cada dia|daily/.test(normalized) || (previousWasDaily && /agrega|anade|incluye|quita|cambia|muestra/.test(normalized));
  const explicitlyCustom = daily || /grafico|grafica|chart|visual|linea|barra|area|combina|mezcla/.test(normalized);
  if ((context.investigation || context.entityId) && !explicitlyCustom) return buildDefaultSpec(context);
  let series = requestedSeries(intent, daily);
  const asksVisual = daily || series.length > 1 || /grafico|grafica|chart|visual|linea|barra|area|combina|mezcla|compara/.test(normalized);
  if (!asksVisual) return buildDefaultSpec(context);

  if (previousWasDaily && previousChart && /agrega|anade|incluye/.test(normalized)) {
    const previousSeries = (previousChart.props.series as CustomSeries[] | undefined) ?? [];
    series = [...previousSeries, ...series.filter((item) => !previousSeries.some((existing) => existing.key === item.key))];
  }

  const chartType = customChartType(intent);
  if (daily) {
    const requestedLabel = series.map((item) => item.label).join(" · ");
    return spec("AnalysisGrid", "Daily cash intelligence", `Reconfigured from “${intent.slice(0, 86)}${intent.length > 86 ? "…" : ""}”`, {
      total: node("MetricCard", { label: "Cash collected", value: usd(analytics.cashflow.totalIn), delta: "+6.8%", tone: "positive", helper: "September total", span: "hero" }),
      average: node("MetricCard", { label: "Average per day", value: usd(analytics.cashflow.averageDaily), delta: "+3.1%", tone: "positive", helper: "Across 30 days" }),
      net: node("MetricCard", { label: "Net cash", value: usd(analytics.cashflow.net), delta: "+4.7%", tone: "positive", helper: "Cash in minus cash out" }),
      chart: node(chartType, { title: "Money movement, day by day", description: requestedLabel, data: analytics.cashflow.daily, xKey: "day", series, format: "currency", span: "wide" }),
      insight: node("InsightCard", { eyebrow: "Canvas insight", title: "Collection peaks cluster around billing dates", body: "The first and fifteenth carry stronger invoice collections. Every requested measure is rendered as its own series; count-based measures use the right axis.", stat: "2 peaks", span: "half", tone: "positive" }),
      breakdown: node("BarChartCard", { title: "Cash-in composition", description: "Subscriptions and paid invoices", data: analytics.cashflow.daily.filter((_, index) => index % 5 === 0), xKey: "day", series: [{ key: "subscriptions", label: "Subscriptions", format: "currency" }, { key: "invoices", label: "Invoices", format: "currency" }], format: "currency", span: "half" }),
    }, ["total", "average", "net", "chart", "insight", "breakdown"]);
  }

  if (!series.length && previousChart) series = (previousChart.props.series as CustomSeries[] | undefined) ?? [];
  if (!series.length) series = [{ key: "revenue", label: "Revenue", format: "currency" }];
  const monthlyData = analytics.months.map((month, index) => ({
    month,
    revenue: analytics.revenue.history[index].revenue,
    enterpriseRevenue: analytics.enterprise.history[index].revenue,
    customers: analytics.customers.total - (11 - index) * 74,
    newCustomers: 98 + index * 4 + (index % 3) * 17,
    churn: analytics.retention.history[index].churn,
    nrr: analytics.retention.history[index].nrr,
    conversion: Number((0.62 + index * 0.018 + Math.sin(index) * 0.05).toFixed(2)),
  }));
  const primary = series[0];
  const latest = monthlyData.at(-1) as Record<string, string | number> | undefined;
  return spec("AnalysisGrid", "Custom analytical canvas", `Reconfigured from “${intent.slice(0, 86)}${intent.length > 86 ? "…" : ""}”`, {
    primary: node("MetricCard", { label: primary.label, value: primary.format === "currency" ? usd(Number(latest?.[primary.key] ?? 0)) : formatValueForMetric(Number(latest?.[primary.key] ?? 0), primary.format), delta: "+2.4%", tone: "positive", helper: "Latest period", span: "hero" }),
    dimensions: node("MetricCard", { label: "Combined measures", value: String(series.length), delta: "Live", tone: "neutral", helper: "One line per measure" }),
    grain: node("MetricCard", { label: "Time grain", value: "12 mo", delta: "Monthly", tone: "neutral", helper: "Comparable timeline" }),
    chart: node(chartType, { title: series.map((item) => item.label).join(" vs "), description: "Combined on one canvas", data: monthlyData, xKey: "month", series, format: primary.format, span: "wide" }),
    note: node("InsightCard", { eyebrow: "Flexible composition", title: "This view was assembled from your request", body: "Ask to add or remove a measure, switch to bars or area, change the time grain, or focus on a customer segment.", stat: `${series.length} series`, span: "wide", tone: "positive" }),
  }, ["primary", "dimensions", "grain", "chart", "note"]);
}

function formatValueForMetric(value: number, format: CustomSeries["format"]) {
  if (format === "percent") return `${value.toFixed(1)}%`;
  return number(value);
}

export function buildDefaultSpec(context: AnalyticsContext): DashboardSpec {
  if (context.entityId === "acme") return customerSpec(context);
  switch (context.area) {
    case "revenue": return revenueSpec(context);
    case "customers": return customersSpec();
    case "retention": return retentionSpec();
    case "acquisition": return acquisitionSpec();
    default: return overviewSpec();
  }
}

export function selectedComponents(specValue: DashboardSpec) {
  return Object.values(specValue.elements).map((element) => element.type);
}
