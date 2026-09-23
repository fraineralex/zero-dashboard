import { describe, expect, it } from "vitest";
import { billingLedgerForMonth } from "@/lib/analytics/billing-ledger";
import { dashboardCatalog } from "@/lib/dashboard/catalog";
import { createContext } from "@/lib/dashboard/context";
import { requestFidelityIssue, unavailableSpec } from "@/lib/dashboard/fidelity";
import { buildIntentSpec } from "@/lib/dashboard/specs";
import { findUiRecipe, parseRecentCustomerBilling } from "@/lib/ui-memory/registry";

const compose = (intent: string) => buildIntentSpec(intent, createContext("overview"));
const block = (intent: string, type: string) => Object.values(compose(intent).elements).find((element) => element.type === type);

describe("request fidelity", () => {
  it("answers the reported request with ten named, dated, exact-amount records", () => {
    const intent = "Muestrame los 10 ultimos usuarios que facturaron donde vea sus nombres y monto";
    const spec = compose(intent);
    const data = block(intent, "BillingLedger")?.props.data as ReturnType<typeof billingLedgerForMonth>;
    expect(findUiRecipe(intent)?.id).toBe("recent-customer-billing");
    expect(spec.elements.root.type).toBe("TableFocus");
    expect(data).toHaveLength(10);
    expect(data.every((row) => row.name && row.amount > 0 && row.billedAt)).toBe(true);
    expect(data.map((row) => row.billedAt)).toEqual(data.map((row) => row.billedAt).toSorted().reverse());
    expect(data.every((row) => row.billedAt.slice(0, 10) <= "2026-09-22")).toBe(true);
    expect(spec.elements.root.children).toEqual(["ledger"]);
    expect(requestFidelityIssue(intent, spec)).toBeNull();
    expect(dashboardCatalog.validate(spec).success).toBe(true);
  });

  it.each([
    ["Los últimos 5 clientes que facturaron", 5, 11],
    ["Show the last 7 customers billed with names and amounts", 7, 11],
    ["Muéstrame los 8 últimos usuarios que facturaron el mes pasado", 8, 10],
    ["Últimos 3 clientes con facturación", 3, 11],
  ])("respects recency, count and month in %s", (intent, count, monthIndex) => {
    expect(parseRecentCustomerBilling(intent)).toEqual({ count, monthIndex });
    const spec = compose(intent);
    const data = Object.values(spec.elements).find((element) => element.type === "BillingLedger")?.props.data as ReturnType<typeof billingLedgerForMonth>;
    expect(data).toHaveLength(count);
    expect(data[0].billedAt.slice(0, 7)).toBe(monthIndex === 10 ? "2026-08" : "2026-09");
    expect(requestFidelityIssue(intent, spec)).toBeNull();
  });

  it.each([
    ["Muestrame los 10 clientes que mas han facturado este mes", 10],
    ["Top 5 customers by billing last month", 5],
    ["Los 6 clientes que menos facturaron", 6],
  ])("keeps amount rankings distinct from recency in %s", (intent, count) => {
    const spec = compose(intent);
    expect(Object.values(spec.elements).some((element) => element.type === "BillingLedger")).toBe(false);
    expect((Object.values(spec.elements).find((element) => element.type === "CustomerRanking")?.props.data as unknown[])).toHaveLength(count);
    expect(requestFidelityIssue(intent, spec)).toBeNull();
  });

  it("keeps identifiable histories separate from a mixed-measure chart", () => {
    const customers = "Muestrame los usuarios sus facturaciones y sus tendencias de facturacion con nombres";
    expect(block(customers, "EntityTrendTable")).toBeTruthy();
    expect(requestFidelityIssue(customers, compose(customers))).toBeNull();
    const combined = "Combina ingresos, clientes y churn en un mismo grafico de lineas";
    expect(block(combined, "LineChartCard")).toBeTruthy();
    expect(block(combined, "EntityTrendTable")).toBeFalsy();
    expect(requestFidelityIssue(combined, compose(combined))).toBeNull();
  });

  it.each([
    ["Muestrame un grafico de tarta de ventas mensuales", "PieChartCard"],
    ["Quiero ver la entrada de dinero dia a dia", "LineChartCard"],
  ])("preserves requested visual form in %s", (intent, type) => {
    expect(block(intent, type)).toBeTruthy();
    expect(requestFidelityIssue(intent, compose(intent))).toBeNull();
  });

  it.each([
    "Muestrame el gasto por proveedor",
    "Muestrame ventas por ciudad",
    "Muestrame los ingresos de 2024",
    "Muestrame los clientes que pagaron sus facturas",
    "Muestrame 10 clientes con nombre y monto",
    "Muestrame los 10 ultimos usuarios que facturaron ayer",
    "Muestrame los clientes que mas compraron",
    "Muestrame un scatter de ventas y churn",
    "Muestrame el clima de hoy",
  ])("does not replace unavailable data with a generic dashboard: %s", (intent) => {
    const issue = requestFidelityIssue(intent, compose(intent));
    expect(issue).toBeTruthy();
    const gap = unavailableSpec(issue!);
    expect(gap.elements.root.children).toEqual(["gap"]);
    expect(gap.elements.gap.props.body).toContain(issue);
  });

  it("rejects a recent-billing response that omits records or changes the requested limit", () => {
    const intent = "Muestrame los 10 ultimos usuarios que facturaron donde vea sus nombres y monto";
    const generic = buildIntentSpec("Show revenue", createContext("revenue"));
    expect(requestFidelityIssue(intent, generic)).toContain("exactamente 10");
    const truncated = structuredClone(compose(intent));
    (truncated.elements.ledger.props.data as unknown[]).pop();
    expect(requestFidelityIssue(intent, truncated)).toContain("exactamente 10");
  });
});
