import { analytics } from "@/lib/analytics/engine";
import { BILLING_DEMO_AS_OF, billingLedgerForMonth } from "@/lib/analytics/billing-ledger";
import type { DashboardElement, DashboardSpec } from "@/types/analytics";

export type UiRecipeManifest = {
  id: string;
  version: number;
  name: string;
  origin: "learned" | "curated";
  capabilities: string[];
  intentExamples: string[];
  requiredData: string[];
};

export const UI_MEMORY_RECIPES: UiRecipeManifest[] = [
  {
    id: "recent-customer-billing",
    version: 1,
    name: "Recent Customer Billing",
    origin: "curated",
    capabilities: ["recent-billing-events", "customer-identification", "requested-row-limit", "exact-amounts", "date-order"],
    intentExamples: [
      "Muéstrame los 10 últimos usuarios que facturaron donde vea sus nombres y monto",
      "Show the last 5 customers billed with names and amounts",
    ],
    requiredData: ["billing-event.date", "customer.id", "customer.name", "billing-event.amount"],
  },
  {
    id: "customer-billing-ranking",
    version: 1,
    name: "Customer Billing Ranking",
    origin: "curated",
    capabilities: ["ranked-customers", "requested-row-limit", "monthly-billing", "cohort-only-summary"],
    intentExamples: [
      "Muéstrame los 10 clientes que más han facturado este mes",
      "Top 5 customers by billing last month",
    ],
    requiredData: ["customer.id", "customer.name", "billing.monthly"],
  },
  {
    id: "customer-billing-explorer",
    version: 1,
    name: "Customer Billing Explorer",
    origin: "learned",
    capabilities: ["customer-identification", "billing-history", "individual-trends", "multi-customer-comparison", "search-and-sort"],
    intentExamples: [
      "Muéstrame los usuarios, sus facturaciones y sus tendencias de facturación",
      "Quiero identificar clientes y comparar cómo cambia su facturación",
      "Show customer names, billing and individual revenue trends",
    ],
    requiredData: ["customer.id", "customer.name", "customer.segment", "customer.status", "billing.current", "billing.history"],
  },
];

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function parseRecentCustomerBilling(intent: string) {
  const value = normalize(intent);
  const people = /\b(clientes?|usuarios?|customers?|users?|accounts?)\b/.test(value);
  const billing = /factur|billing|billed|invoice|invoic/.test(value);
  const recent = /\b(?:ultimos?|latest|last|recent(?:es)?)\s+(?:\d{1,2}\s+)?(?:clientes?|usuarios?|customers?|users?|accounts?)\b/.test(value)
    || /\b\d{1,2}\s+ultimos?\s+(?:clientes?|usuarios?|customers?|users?|accounts?)\b/.test(value)
    || /\b(?:clientes?|usuarios?|customers?|users?|accounts?)\s+(?:que\s+)?(?:facturaron\s+)?(?:mas\s+)?recientes\b/.test(value);
  if (!people || !billing || !recent) return null;
  const countMatch = value.match(/\b(\d{1,2})\s+(?:ultimos?\s+)?(?:clientes?|usuarios?|customers?|users?|accounts?)\b/)
    ?? value.match(/\b(?:ultimos?|latest|last)\s+(\d{1,2})\b/);
  const count = Math.min(50, Math.max(1, Number(countMatch?.[1] ?? 10)));
  const monthIndex = /mes pasado|mes anterior|last month|previous month/.test(value) ? 10 : 11;
  return { count, monthIndex } as const;
}

export function parseCustomerBillingRanking(intent: string) {
  const value = normalize(intent);
  const asksForCustomers = /\b(cliente|clientes|usuario|usuarios|customer|customers|account|accounts)\b/.test(value);
  const asksForBilling = /factur|billing|revenue|ingreso|mrr/.test(value);
  const asksForRanking = /\btop\b|\bprimeros?\b|\bmayor(?:es)?\b|\bmas\b|\bhighest\b|\bmost\b|\bmenor(?:es)?\b|\bmenos\b|\blowest\b/.test(value);
  if (!asksForCustomers || !asksForBilling || !asksForRanking) return null;
  const countMatch = value.match(/\b(?:top|primeros?|first)?\s*(\d{1,2})\s+(?:clientes?|usuarios?|customers?|accounts?)\b/)
    ?? value.match(/\b(?:top|primeros?|first)\s*(\d{1,2})\b/);
  const count = Math.min(50, Math.max(1, Number(countMatch?.[1] ?? 10)));
  const monthIndex = /mes pasado|mes anterior|last month|previous month/.test(value) ? 10 : 11;
  const direction = /\b(menos|menor(?:es)?|lowest|least)\b/.test(value) ? "asc" : "desc";
  return { count, monthIndex, direction } as const;
}

export function findUiRecipe(intent: string) {
  if (parseRecentCustomerBilling(intent)) return UI_MEMORY_RECIPES[0];
  if (parseCustomerBillingRanking(intent)) return UI_MEMORY_RECIPES[1];
  const value = normalize(intent);
  const asksForPeople = /usuario|cliente|customer|account|cuenta/.test(value);
  const asksForBilling = /factura|facturacion|billing|revenue|ingreso|mrr/.test(value);
  const asksForIndividualBilling = /nombre|identific|quien|who|por cliente|por usuario|sus factur|their bill|individual|(?:clientes?|usuarios?) (?:con|y) (?:sus )?factur/.test(value);
  const asksForBillingHistory = /tendencia|trend|evolucion|historial|history|comportamiento/.test(value) && /factur|billing/.test(value);
  return asksForPeople && asksForBilling && (asksForIndividualBilling || asksForBillingHistory) ? UI_MEMORY_RECIPES[2] : null;
}

const node = (type: string, props: Record<string, unknown>): DashboardElement => ({ type, props, children: [] });
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);

function buildCustomerRankingSpec(intent: string): DashboardSpec | null {
  const ranking = parseCustomerBillingRanking(intent);
  if (!ranking) return null;
  const recipe = UI_MEMORY_RECIPES[1];
  const period = ranking.monthIndex === 11 ? "Septiembre 2026" : "Agosto 2026";
  const rows = [...analytics.customers.billingProfiles]
    .sort((a, b) => ranking.direction === "desc"
      ? b.history[ranking.monthIndex].value - a.history[ranking.monthIndex].value
      : a.history[ranking.monthIndex].value - b.history[ranking.monthIndex].value)
    .slice(0, ranking.count)
    .map((profile, index) => ({
      rank: index + 1,
      id: profile.id,
      name: profile.name,
      segment: profile.segment,
      value: profile.history[ranking.monthIndex].value,
    }));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const directionLabel = ranking.direction === "desc" ? "mayor" : "menor";
  return {
    root: "root",
    state: { uiMemory: { recipeId: recipe.id, recipeVersion: recipe.version, recipeName: recipe.name, origin: recipe.origin } },
    elements: {
      root: { type: "TableFocus", props: { title: `${ranking.count} clientes con ${directionLabel} facturación`, subtitle: `${period} · Facturación recurrente mensual`, periodLabel: period }, children: ["cohortTotal", "cohortAverage", "leader", "ranking"] },
      cohortTotal: node("MetricCard", { label: `Total de los ${rows.length} clientes`, value: money(total), delta: "MRR", tone: "neutral", helper: period }),
      cohortAverage: node("MetricCard", { label: "Promedio de este grupo", value: money(total / rows.length), delta: "MRR", tone: "neutral", helper: `${rows.length} clientes del ranking` }),
      leader: node("MetricCard", { label: `Puesto #1 · ${rows[0]?.name ?? "—"}`, value: money(rows[0]?.value ?? 0), delta: "MRR", tone: "neutral", helper: period }),
      ranking: node("CustomerRanking", { title: "Ranking de clientes", description: `${rows.length} clientes ordenados por facturación recurrente de ${period.toLowerCase()}. Los importes proceden de datos demo de MRR.`, data: rows, span: "wide" }),
    },
  };
}

function buildRecentBillingSpec(intent: string): DashboardSpec | null {
  const request = parseRecentCustomerBilling(intent);
  if (!request) return null;
  const recipe = UI_MEMORY_RECIPES[0];
  const period = request.monthIndex === 11 ? "Septiembre 2026" : "Agosto 2026";
  const rows = billingLedgerForMonth(request.monthIndex).slice(0, request.count);
  return {
    root: "root",
    state: { uiMemory: { recipeId: recipe.id, recipeVersion: recipe.version, recipeName: recipe.name, origin: recipe.origin } },
    elements: {
      root: { type: "TableFocus", props: { title: `${rows.length} clientes con facturación más reciente`, subtitle: `${period} · Registros demo hasta ${BILLING_DEMO_AS_OF} · Fecha descendente`, periodLabel: period }, children: ["ledger"] },
      ledger: node("BillingLedger", {
        title: "Últimas facturaciones por cliente",
        description: "Nombre, fecha e importe exacto del registro demo. Fechas e importes simulados a partir del MRR; no son facturas reales.",
        data: rows,
        span: "wide",
      }),
    },
  };
}

export function buildUiMemorySpec(intent: string): DashboardSpec | null {
  const recentSpec = buildRecentBillingSpec(intent);
  if (recentSpec) return recentSpec;
  const rankingSpec = buildCustomerRankingSpec(intent);
  if (rankingSpec) return rankingSpec;
  const recipe = findUiRecipe(intent);
  if (!recipe) return null;
  const normalized = normalize(intent);
  const requestedCount = normalized.match(/\b(\d{1,2})\s+(?:clientes?|usuarios?|customers?|users?)\b/)?.[1];
  const profiles = analytics.customers.billingProfiles.slice(0, requestedCount ? Math.min(50, Math.max(1, Number(requestedCount))) : 14);
  const declining = profiles.filter((profile) => profile.change < 0);
  const growing = profiles.filter((profile) => profile.change > 0);
  const visibleMrr = profiles.reduce((sum, profile) => sum + profile.current, 0);
  return {
    root: "root",
    state: { uiMemory: { recipeId: recipe.id, recipeVersion: recipe.version, recipeName: recipe.name, origin: recipe.origin } },
    elements: {
      root: { type: "OverviewGrid", props: { title: "Customer billing intelligence", subtitle: `UI Memory · ${recipe.name} v${recipe.version}` }, children: ["identified", "billed", "declining", "growing", "explorer"] },
      identified: node("MetricCard", { label: "Identifiable customers", value: String(profiles.length), delta: `${analytics.customers.total.toLocaleString("en-US")} total`, tone: "neutral", helper: "Highest billing accounts" }),
      billed: node("MetricCard", { label: "Visible monthly billing", value: money(visibleMrr), delta: "+2.4%", tone: "positive", helper: "Across listed customers" }),
      declining: node("MetricCard", { label: "Declining accounts", value: String(declining.length), delta: `${declining.length ? Math.min(...declining.map((profile) => profile.change)).toFixed(1) : "0.0"}% low`, tone: declining.length ? "negative" : "neutral", helper: "Versus previous month" }),
      growing: node("MetricCard", { label: "Growing accounts", value: String(growing.length), delta: `${profiles.length ? Math.round((growing.length / profiles.length) * 100) : 0}%`, tone: "positive", helper: "Of visible portfolio" }),
      explorer: node("EntityTrendTable", { title: "Customers, billing and individual trends", description: "Search, sort, identify and select accounts to compare their twelve-month billing trajectories.", data: profiles, span: "wide" }),
    },
  };
}
