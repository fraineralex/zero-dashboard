import { analytics } from "@/lib/analytics/engine";
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

export function findUiRecipe(intent: string) {
  const value = normalize(intent);
  const asksForPeople = /usuario|cliente|customer|account|cuenta/.test(value);
  const asksForBilling = /factura|facturacion|billing|revenue|ingreso|mrr/.test(value);
  const asksForTrend = /tendencia|trend|evolucion|historial|history|comportamiento/.test(value);
  const asksForIdentity = /nombre|identific|quien|who|usuario|cliente/.test(value);
  return asksForPeople && asksForBilling && asksForTrend && asksForIdentity ? UI_MEMORY_RECIPES[0] : null;
}

const node = (type: string, props: Record<string, unknown>): DashboardElement => ({ type, props });
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);

export function buildUiMemorySpec(intent: string): DashboardSpec | null {
  const recipe = findUiRecipe(intent);
  if (!recipe) return null;
  const profiles = analytics.customers.billingProfiles;
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
