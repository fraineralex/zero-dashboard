"use client";

import { type ReactNode, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpDown, ArrowUpRight, Check, ChevronRight, CircleAlert, Minus, Search, X } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "@/store/dashboard-store";

type BaseCardProps = { title: string; description?: string; span?: string };
type Series = { key: string; label: string; format?: "currency" | "percent" | "number"; axis?: "left" | "right" };
type ChartRow = Record<string, string | number | boolean | null>;
type BillingProfile = { id: string; name: string; segment: string; status: string; current: number; previous: number; change: number; annualized: number; history: { month: string; value: number }[] };

const spanClass = (span?: string) => span ? `span-${span}` : undefined;

const formatValue = (value: string | number, format?: string) => {
  if (typeof value !== "number") return String(value);
  if (format === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
  if (format === "percent") return `${value.toFixed(1)}%`;
  return new Intl.NumberFormat("en-US", { notation: value > 9999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
};

function CardFrame({ title, description, span, children, className }: BaseCardProps & { children: ReactNode; className?: string }) {
  return (
    <section className={cn("dashboard-card", spanClass(span), className)}>
      <header className="card-heading">
        <div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
      </header>
      {children}
    </section>
  );
}

export function Layout({ props, children, variant }: { props: { title: string; subtitle: string }; children?: ReactNode; variant: string }) {
  return (
    <div className="canvas-document">
      <div className="canvas-title-row">
        <div><p className="canvas-kicker">{props.subtitle}</p><h1>{props.title}</h1></div>
        <div className="period-control"><span>Sep 1</span><span className="period-dash">—</span><span>Sep 30</span></div>
      </div>
      <div className={cn("dashboard-grid", `layout-${variant}`)}>{children}</div>
    </div>
  );
}

export function MetricCard({ props }: { props: { label: string; value: string; delta?: string; tone?: string; helper?: string; action?: string; span?: string } }) {
  const navigate = useDashboardStore((state) => state.navigate);
  const tone = props.tone ?? "neutral";
  const Icon = tone === "positive" ? ArrowUpRight : tone === "negative" ? ArrowDownRight : Minus;
  const content = (
    <>
      <div className="metric-topline"><span>{props.label}</span>{props.action ? <ChevronRight size={14} /> : null}</div>
      <strong className="metric-value">{props.value}</strong>
      <div className="metric-foot"><span className={cn("metric-delta", `tone-${tone}`)}><Icon size={13} />{props.delta}</span><span>{props.helper}</span></div>
    </>
  );
  if (props.action) return <button className={cn("metric-card dashboard-card", spanClass(props.span))} onClick={() => navigate(props.action as "revenue" | "customers" | "retention" | "acquisition")}>{content}</button>;
  return <section className={cn("metric-card dashboard-card", spanClass(props.span))}>{content}</section>;
}

function chartConfig(series: Series[]): ChartConfig {
  const colors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "#d07a42", "#3b8c88"];
  return Object.fromEntries(series.map((item, index) => [item.key, { label: item.label, color: colors[index] }]));
}

export function LineChartCard({ props }: { props: BaseCardProps & { data: ChartRow[]; xKey: string; series: Series[]; format?: string; action?: string } }) {
  const navigate = useDashboardStore((state) => state.navigate);
  const formats = new Set(props.series.map((item) => item.format ?? props.format ?? "number"));
  const normalized = formats.size > 1;
  const normalizedKeys = new Map(props.series.map((item) => [item.key, `${item.key}Normalized`]));
  const ranges = new Map(props.series.map((item) => {
    const values = props.data.map((row) => Number(row[item.key] ?? 0));
    return [item.key, { min: Math.min(...values), max: Math.max(...values) }];
  }));
  const chartData = normalized ? props.data.map((row) => ({
    ...row,
    ...Object.fromEntries(props.series.map((item) => {
      const current = Number(row[item.key] ?? 0);
      const range = ranges.get(item.key)!;
      const spread = range.max - range.min;
      return [normalizedKeys.get(item.key)!, spread ? Number((((current - range.min) / spread) * 100).toFixed(2)) : 50];
    })),
  })) : props.data;
  const displaySeries = props.series.map((item) => ({ ...item, displayKey: normalized ? normalizedKeys.get(item.key)! : item.key }));
  const displayConfig = Object.fromEntries(displaySeries.map((item, index) => [item.displayKey, { label: item.label, color: ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "#d07a42", "#3b8c88"][index] }]));
  const leftSeries = props.series.find((item) => item.axis !== "right") ?? props.series[0];
  const rightSeries = props.series.find((item) => item.axis === "right");
  return (
    <CardFrame {...props} description={normalized ? `${props.description ?? "Comparative movement"} · Normalized range 0–100` : props.description}>
      <button className="chart-action-layer" aria-label={props.action ? `Open ${props.action}` : undefined} onClick={props.action ? () => navigate(props.action as "revenue") : undefined} tabIndex={props.action ? 0 : -1}>
        <ChartContainer config={normalized ? displayConfig : chartConfig(props.series)} className="chart-standard" aria-label={`${props.title} chart`}>
          <LineChart data={chartData} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid-line)" />
            <XAxis dataKey={props.xKey} tickLine={false} axisLine={false} tickMargin={10} interval="preserveStartEnd" minTickGap={24} />
            <YAxis yAxisId="left" domain={normalized ? [0, 100] : undefined} tickLine={false} axisLine={false} width={54} tickFormatter={(value) => normalized ? `${Math.round(value)}` : formatValue(value, leftSeries?.format ?? props.format)} />
            {!normalized && rightSeries ? <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={48} tickFormatter={(value) => formatValue(value, rightSeries.format)} /> : null}
            <ChartTooltip cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }} content={<ChartTooltipContent formatter={(value, name, item) => { const source = props.series.find((series) => series.label === name); const actual = normalized && source ? item.payload?.[source.key] : value; return formatValue(actual as string | number, source?.format ?? props.format); }} />} />
            {displaySeries.map((series, index) => <Line key={series.key} name={series.label} yAxisId={normalized ? "left" : series.axis ?? "left"} dataKey={series.displayKey} type="monotone" stroke={`var(--color-${series.displayKey})`} strokeWidth={index === 0 ? 2.2 : 1.8} strokeDasharray={index > 2 ? "4 3" : undefined} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />)}
            {props.series.length > 1 ? <ChartLegend verticalAlign="top" height={24} /> : null}
          </LineChart>
        </ChartContainer>
      </button>
    </CardFrame>
  );
}

export function ComparisonChart(props: Parameters<typeof LineChartCard>[0]) {
  return <LineChartCard {...props} />;
}

export function AreaChartCard({ props }: { props: BaseCardProps & { data: ChartRow[]; xKey: string; series: Series[]; format?: string } }) {
  const firstSeries = props.series[0];
  return (
    <CardFrame {...props}>
      <ChartContainer config={chartConfig(props.series)} className="chart-standard" aria-label={`${props.title} chart`}>
        <AreaChart data={props.data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <defs>{props.series.map((series) => <linearGradient key={series.key} id={`fill-${series.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={`var(--color-${series.key})`} stopOpacity={0.18} /><stop offset="95%" stopColor={`var(--color-${series.key})`} stopOpacity={0} /></linearGradient>)}</defs>
          <CartesianGrid vertical={false} stroke="var(--grid-line)" />
          <XAxis dataKey={props.xKey} tickLine={false} axisLine={false} tickMargin={10} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(value) => formatValue(value, firstSeries?.format ?? props.format)} />
          <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => formatValue(value, props.series.find((item) => item.label === name)?.format ?? props.format)} />} />
          {props.series.map((series) => <Area key={series.key} name={series.label} dataKey={series.key} type="monotone" stroke={`var(--color-${series.key})`} fill={`url(#fill-${series.key})`} strokeWidth={2} isAnimationActive={false} />)}
          {props.series.length > 1 ? <ChartLegend verticalAlign="top" height={24} /> : null}
        </AreaChart>
      </ChartContainer>
    </CardFrame>
  );
}

export function BarChartCard({ props }: { props: BaseCardProps & { data: ChartRow[]; xKey: string; series: Series[]; format?: string; horizontal?: boolean } }) {
  const firstSeries = props.series[0];
  return (
    <CardFrame {...props}>
      <ChartContainer config={chartConfig(props.series)} className="chart-standard" aria-label={`${props.title} chart`}>
        <BarChart data={props.data} layout={props.horizontal ? "vertical" : "horizontal"} margin={{ top: 12, right: 10, bottom: 0, left: props.horizontal ? 8 : 0 }}>
          <CartesianGrid vertical={!props.horizontal} horizontal={props.horizontal} stroke="var(--grid-line)" />
          {props.horizontal ? <YAxis dataKey={props.xKey} type="category" tickLine={false} axisLine={false} width={96} /> : <XAxis dataKey={props.xKey} tickLine={false} axisLine={false} tickMargin={10} />}
          {props.horizontal ? <XAxis type="number" hide /> : <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(value) => formatValue(value, firstSeries?.format ?? props.format)} />}
          <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent formatter={(value, name) => formatValue(value, props.series.find((item) => item.label === name)?.format ?? props.format)} />} />
          {props.series.map((series) => <Bar key={series.key} name={series.label} dataKey={series.key} fill={`var(--color-${series.key})`} radius={props.horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]} maxBarSize={34} isAnimationActive={false} />)}
          {props.series.length > 1 ? <ChartLegend verticalAlign="top" height={24} /> : null}
        </BarChart>
      </ChartContainer>
    </CardFrame>
  );
}

export function InsightCard({ props }: { props: { eyebrow: string; title: string; body: string; stat: string; actionLabel?: string; actionIntent?: string; span?: string; tone?: string } }) {
  const submit = useDashboardStore((state) => state.submitIntent);
  return (
    <section className={cn("dashboard-card insight-card", spanClass(props.span))}>
      <div className="insight-icon"><CircleAlert size={16} /></div>
      <p className="eyebrow">{props.eyebrow}</p>
      <strong className={cn("insight-stat", props.tone === "negative" && "negative")}>{props.stat}</strong>
      <h2>{props.title}</h2>
      <p className="insight-body">{props.body}</p>
      {props.actionLabel && props.actionIntent ? <button className="text-action" onClick={() => submit(props.actionIntent!, "suggestion")}>{props.actionLabel}<ChevronRight size={14} /></button> : null}
    </section>
  );
}

export function FindingCard({ props }: { props: { label: string; title: string; body: string; value: string; valueLabel: string } }) {
  return <section className="dashboard-card finding-card span-wide"><div><p className="eyebrow">{props.label}</p><h2>{props.title}</h2><p>{props.body}</p></div><div className="finding-value"><strong>{props.value}</strong><span>{props.valueLabel}</span></div></section>;
}

export function CustomerHeader({ props }: { props: { name: string; segment: string; status: string; detail: string } }) {
  return <section className="entity-header span-wide"><div className="entity-monogram">AC</div><div className="entity-copy"><p>{props.segment}</p><h2>{props.name}</h2><span>{props.detail}</span></div><span className="risk-badge">{props.status}</span></section>;
}

export function DataTable({ props }: { props: BaseCardProps & { data: Record<string, unknown>[]; columns: { key: string; label: string; format?: string }[]; rowAction?: string } }) {
  const openCustomer = useDashboardStore((state) => state.openCustomer);
  return (
    <CardFrame {...props} className="table-card">
      <div className="table-scroll"><table><thead><tr>{props.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{props.data.map((row, index) => <tr key={String(row.id ?? row.customer ?? index)} className={props.rowAction ? "clickable-row" : undefined} onClick={props.rowAction && String(row.id ?? "").includes("acme") ? () => openCustomer("acme") : undefined}>{props.columns.map((column) => <td key={column.key}>{formatValue(row[column.key] as string | number, column.format)}{column.key === "customer" && String(row.id ?? "").includes("acme") ? <ChevronRight size={13} /> : null}</td>)}</tr>)}</tbody></table></div>
    </CardFrame>
  );
}

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const width = 104;
  const height = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * width},${height - ((value - min) / spread) * (height - 4) - 2}`).join(" ");
  return <svg className={cn("billing-sparkline", positive ? "positive" : "negative")} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Billing trend ${positive ? "up" : "down"}`}><polyline points={points} fill="none" vectorEffect="non-scaling-stroke" /></svg>;
}

export function EntityTrendTable({ props }: { props: BaseCardProps & { data: BillingProfile[] } }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"current" | "change">("current");
  const [selected, setSelected] = useState<string[]>([]);
  const rows = useMemo(() => props.data
    .filter((profile) => `${profile.name} ${profile.segment} ${profile.status}`.toLowerCase().includes(query.toLowerCase()))
    .toSorted((a, b) => sort === "current" ? b.current - a.current : b.change - a.change), [props.data, query, sort]);
  const selectedProfiles = props.data.filter((profile) => selected.includes(profile.id));
  const compareData = selectedProfiles[0]?.history.map((point, index) => ({ month: point.month, ...Object.fromEntries(selectedProfiles.map((profile) => [profile.id, profile.history[index]?.value ?? 0])) })) ?? [];
  const compareConfig = Object.fromEntries(selectedProfiles.map((profile, index) => [profile.id, { label: profile.name, color: ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "#d07a42"][index] }]));
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current);
  return <CardFrame {...props} className="entity-trend-card">
    <div className="entity-explorer-toolbar"><label><Search size={14} /><span className="sr-only">Search customers</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, segment or status…" /></label><div><span>{rows.length} identified</span><button onClick={() => setSort((current) => current === "current" ? "change" : "current")}><ArrowUpDown size={13} />Sort by {sort === "current" ? "billing" : "change"}</button></div></div>
    {selectedProfiles.length ? <div className="comparison-tray"><div className="comparison-tray-heading"><div><span>Live comparison</span><strong>{selectedProfiles.length === 1 ? "Select another customer" : `${selectedProfiles.length} billing trajectories`}</strong></div><div>{selectedProfiles.map((profile) => <button key={profile.id} onClick={() => toggle(profile.id)}>{profile.name}<X size={11} /></button>)}</div></div>{selectedProfiles.length > 1 ? <ChartContainer config={compareConfig} className="comparison-mini-chart" aria-label="Selected customer billing comparison"><LineChart data={compareData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}><CartesianGrid vertical={false} stroke="var(--grid-line)" /><XAxis dataKey="month" tickLine={false} axisLine={false} interval="preserveStartEnd" /><YAxis tickLine={false} axisLine={false} width={50} tickFormatter={(value) => formatValue(value, "currency")} /><ChartTooltip content={<ChartTooltipContent formatter={(value) => formatValue(value, "currency")} />} />{selectedProfiles.map((profile) => <Line key={profile.id} name={profile.name} dataKey={profile.id} type="monotone" stroke={`var(--color-${profile.id})`} strokeWidth={2} dot={false} isAnimationActive={false} />)}<ChartLegend verticalAlign="top" height={24} /></LineChart></ChartContainer> : <p className="comparison-hint">Select up to four customers to compare them without leaving this view.</p>}</div> : null}
    <div className="entity-trend-scroll"><table className="entity-trend-table"><thead><tr><th aria-label="Compare" /><th>Customer</th><th>Monthly billing</th><th>Change</th><th>12-month trend</th><th>Status</th></tr></thead><tbody>{rows.map((profile) => { const active = selected.includes(profile.id); return <tr key={profile.id} className={active ? "selected" : undefined}><td><button className="entity-select" aria-label={`${active ? "Remove" : "Add"} ${profile.name} ${active ? "from" : "to"} comparison`} aria-pressed={active} onClick={() => toggle(profile.id)}>{active ? <Check size={12} /> : null}</button></td><td><div className="entity-identity"><span>{profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div><strong>{profile.name}</strong><em>{profile.segment} · {profile.id}</em></div></div></td><td><strong>{formatValue(profile.current, "currency")}</strong><small>{formatValue(profile.annualized, "currency")} annualized</small></td><td><span className={profile.change >= 0 ? "positive" : "negative"}>{profile.change >= 0 ? "+" : ""}{profile.change.toFixed(1)}%</span><small>vs previous month</small></td><td><Sparkline values={profile.history.map((point) => point.value)} positive={profile.change >= 0} /></td><td><span className={cn("entity-status", `status-${profile.status}`)}>{profile.status.replace("_", " ")}</span></td></tr>; })}</tbody></table></div>
  </CardFrame>;
}

export function SegmentTable({ props }: { props: BaseCardProps & { data: Record<string, unknown>[] } }) {
  const navigate = useDashboardStore((state) => state.navigate);
  return <CardFrame {...props}><div className="segment-list">{props.data.map((item) => <button key={String(item.name)} onClick={() => item.name === "Enterprise" && navigate("revenue", "Enterprise")}><span>{String(item.name)}</span><strong>{formatValue(item.value as number, "currency")}</strong><em className={Number(item.change) < 0 ? "negative" : "positive"}>{Number(item.change) > 0 ? "+" : ""}{String(item.change)}%</em><ChevronRight size={14} /></button>)}</div></CardFrame>;
}

export function MovementCard({ props }: { props: BaseCardProps & { data: Record<string, unknown>[] } }) {
  return <CardFrame {...props}><div className="movement-list">{props.data.map((item, index) => <div key={String(item.name)}><span className="movement-index">0{index + 1}</span><span>{String(item.name)}</span><strong className={Number(item.value) < 0 ? "negative" : ""}>{formatValue(item.value as number, "currency")}</strong></div>)}</div></CardFrame>;
}

export function ContributionCard({ props }: { props: BaseCardProps & { data: Record<string, unknown>[]; total: number } }) {
  return <CardFrame {...props}><div className="contribution-list">{props.data.map((item) => { const value = Number(item.value); return <div key={String(item.name)}><div><span>{String(item.name)}</span><strong>{formatValue(value, "currency")}</strong></div><div className="contribution-track"><span style={{ width: `${Math.min(100, (value / props.total) * 100)}%` }} /></div></div>; })}</div></CardFrame>;
}

export function SignalList({ props }: { props: BaseCardProps & { items: { label: string; value: string; detail: string }[] } }) {
  return <CardFrame {...props}><div className="signal-list">{props.items.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong><em>{item.detail}</em></div>)}</div></CardFrame>;
}

export function TimelineCard({ props }: { props: BaseCardProps & { data: Record<string, unknown>[] } }) {
  return <CardFrame {...props}><ol className="timeline-list">{props.data.map((item) => <li key={String(item.date) + String(item.title)}><span className="timeline-dot" /><time>{String(item.date)}</time><div><strong>{String(item.title)}</strong><p>{String(item.detail)}</p></div></li>)}</ol></CardFrame>;
}

export function FunnelCard({ props }: { props: BaseCardProps & { data: Record<string, unknown>[] } }) {
  const max = Number(props.data[0]?.value ?? 1);
  return <CardFrame {...props}><div className="funnel-list">{props.data.map((item, index) => <div key={String(item.stage)}><span>{String(item.stage)}</span><div className="funnel-track"><span style={{ width: `${Math.max(9, Number(item.value) / max * 100)}%` }} /></div><strong>{formatValue(item.value as number)}</strong>{index > 0 ? <em>{((Number(item.value) / Number(props.data[index - 1].value)) * 100).toFixed(1)}%</em> : <em>100%</em>}</div>)}</div></CardFrame>;
}

export function CohortCard({ props }: { props: BaseCardProps & { data: Record<string, unknown>[] } }) {
  return <CardFrame {...props}><div className="cohort-grid"><span>Cohort</span><span>M1</span><span>M3</span><span>M6</span>{props.data.flatMap((row) => [<strong key={`${row.cohort}-c`}>{String(row.cohort)}</strong>, ...["m1", "m3", "m6"].map((key) => <em key={`${row.cohort}-${key}`} style={{ opacity: Number(row[key]) ? 0.35 + Number(row[key]) / 155 : 0.08 }}>{Number(row[key]) ? `${row[key]}%` : "—"}</em>)])}</div></CardFrame>;
}

export function ComparisonSummary({ props }: { props: { label: string; value: string; delta: string; detail: string; tone: string } }) {
  return <section className="dashboard-card comparison-summary"><p>{props.label}</p><strong>{props.value}</strong><span className={props.tone === "negative" ? "negative" : "positive"}>{props.delta}</span><small>{props.detail}</small></section>;
}
