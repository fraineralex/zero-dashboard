export type AnalyticsArea =
  | "overview"
  | "revenue"
  | "customers"
  | "retention"
  | "acquisition"
  | "payments";

export type AnalyticsContext = {
  area: AnalyticsArea;
  segment?: "Enterprise" | "Growth" | "Pro" | "Starter";
  entityType?: "customer" | "plan" | "country";
  entityId?: string;
  period: { from: string; to: string; label: string };
  comparison?: {
    type: "previous_period" | "previous_year" | "segment" | "cohort";
    value?: string;
  };
  investigation?:
    | "enterprise_decline"
    | "decline_customers"
    | "customer_risk"
    | "cohort_comparison";
};

export type Customer = {
  id: string;
  name: string;
  segment: "Enterprise" | "Growth" | "Pro" | "Starter";
  plan: "Scale" | "Growth" | "Pro" | "Starter";
  country: string;
  source: string;
  status: "active" | "past_due" | "canceled";
  joinedMonth: number;
  seats: number;
  previousSeats: number;
  failedPayments: number;
  mrrHistory: number[];
  usageHistory: number[];
  supportTickets: number;
};

export type MetricDatum = {
  label: string;
  value: string;
  delta?: string;
  direction?: "up" | "down" | "flat";
  helper?: string;
  action?: string;
};

export type ChartDatum = Record<string, string | number>;

export type AnalyticsSnapshot = {
  months: string[];
  accounting: {
    monthly: ChartDatum[];
    expenses: ChartDatum[];
    receivablesAging: ChartDatum[];
    payablesAging: ChartDatum[];
    invoices: ChartDatum[];
    cashBalance: number;
    grossProfit: number;
    netProfit: number;
    receivables: number;
    payables: number;
    taxesDue: number;
  };
  cashflow: {
    daily: ChartDatum[];
    totalIn: number;
    totalOut: number;
    net: number;
    averageDaily: number;
  };
  revenue: {
    current: number;
    previous: number;
    delta: number;
    history: ChartDatum[];
    byPlan: ChartDatum[];
    byCountry: ChartDatum[];
    bySegment: ChartDatum[];
    movement: ChartDatum[];
  };
  customers: {
    total: number;
    active: number;
    newThisMonth: number;
    atRisk: number;
    top: ChartDatum[];
    decliners: ChartDatum[];
  };
  retention: {
    churnRate: number;
    netRetention: number;
    history: ChartDatum[];
    cohorts: ChartDatum[];
  };
  acquisition: {
    conversion: number;
    funnel: ChartDatum[];
    bySource: ChartDatum[];
  };
  enterprise: {
    current: number;
    previous: number;
    delta: number;
    history: ChartDatum[];
    losses: ChartDatum[];
    customers: ChartDatum[];
  };
  acme: {
    id: string;
    name: string;
    mrr: number;
    previousMrr: number;
    arr: number;
    usageDelta: number;
    failedPayments: number;
    seats: number;
    previousSeats: number;
    risk: string;
    revenueHistory: ChartDatum[];
    usageHistory: ChartDatum[];
    payments: ChartDatum[];
    timeline: ChartDatum[];
    comparison: ChartDatum[];
  };
};

export type DashboardElement = {
  type: string;
  props: Record<string, unknown>;
  children?: string[];
};

export type DashboardSpec = {
  root: string;
  elements: Record<string, DashboardElement>;
  state?: Record<string, unknown>;
};

export type CompositionDiagnostics = {
  source: "navigation" | "suggestion" | "text" | "voice";
  mode: "deterministic" | "jev" | "development-fallback";
  candidateCount: number;
  selectedComponents: string[];
  layout: string;
  resolverMs: number;
  firstSpecMs: number;
  totalMs: number;
  stopReason?: string;
};
