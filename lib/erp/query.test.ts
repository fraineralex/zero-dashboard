import { describe, expect, it } from "vitest";
import { demoErpProvider } from "@/lib/erp/demo";
import { buildErpSpec } from "@/lib/erp/intent";
import { buildDynamicErpSpec, dynamicFidelityIssue, executeErpQuery, planKnownErpQuestion, shouldPlanDynamicErp, validateDynamicErpPlan, type DynamicErpPlan } from "@/lib/erp/query";
import { requestFidelityIssue } from "@/lib/dashboard/fidelity";

const ask = (text: string) => {
  const spec = buildErpSpec(text);
  expect(spec).not.toBeNull();
  expect(requestFidelityIssue(text, spec!)).toBeNull();
  return spec!;
};

describe("semantic ERP queries compose the requested UI from related records", () => {
  it.each([
    "Muestrame un grafico de tarta de los productos mas vendidos",
    "Gráfico circular de los productos más vendidos",
    "Top 5 productos más vendidos en tarta",
  ])("builds a real product-sales pie for %s", (request) => {
    const spec = ask(request);
    const chart = spec.elements.chart;
    expect(chart.type).toBe("PieChartCard");
    const slices = chart.props.data as { name: string; value: number }[];
    expect(slices.some((slice) => slice.name === "Otros productos")).toBe(/Top 5/.test(request));
    expect(slices.reduce((sum, row) => sum + row.value, 0)).toBe(demoErpProvider.list("salesLines").reduce((sum, row) => sum + Number(row.quantity), 0));
    expect((spec.elements.records.props.data as { product: string }[]).every((row) => Boolean(row.product))).toBe(true);
  });

  it("keeps line item totals reconciled to their sales orders", () => {
    const orders = demoErpProvider.list("salesOrders");
    const lines = demoErpProvider.list("salesLines");
    for (const order of orders) expect(lines.filter((line) => line.orderId === order.id).reduce((sum, line) => sum + Number(line.subtotal), 0)).toBe(order.amount);
  });

  it.each([
    "Muestrame cuanto suman los pagos de impuestos de nomina por parte de la empresa",
    "Cuánto pagamos de aportes patronales de nómina",
  ])("sums only paid employer contributions for %s", (request) => {
    const spec = ask(request);
    const payments = spec.elements.payments.props.data as { amount: number; status: string; period: string }[];
    const expected = payments.reduce((sum, row) => sum + row.amount, 0);
    expect(payments).toHaveLength(2);
    expect(payments.every((row) => row.status === "Pagado" && row.period === "2026-09")).toBe(true);
    expect(spec.elements.total.props.value).toBe(new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(expected));
    expect(spec.elements.records).toBeUndefined();
  });

  it.each([
    "Muestra cuanto estoy pagando en nomina al mes",
    "Costo mensual de nómina",
  ])("shows employer cost, gross and net month by month for %s", (request) => {
    const spec = ask(request);
    const chart = spec.elements.trend;
    expect(chart.type).toBe("LineChartCard");
    expect((chart.props.series as { key: string }[]).map((item) => item.key)).toEqual(["employerCost", "gross", "net"]);
    const rows = spec.elements.records.props.data as { period: string; employerCost: number; gross: number; employerTaxes: number }[];
    expect(rows).toHaveLength(12);
    expect(rows.at(-1)?.period).toBe("2026-09");
    expect(rows.every((row) => row.employerCost === row.gross + row.employerTaxes)).toBe(true);
  });

  it.each(["productos sin stock", "Muéstrame productos agotados", "Inventario sin existencias"])('shows exactly zero-stock products for %s', (request) => {
    const spec = ask(request);
    const rows = spec.elements.records.props.data as { product: string; available: number }[];
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.available === 0 && row.product)).toBe(true);
    expect(rows.length).toBeLessThan(demoErpProvider.list("stock").length);
  });

  it("rejects query plans that reference fields outside the source model", () => {
    const plan = planKnownErpQuestion("productos sin stock")!;
    expect(() => executeErpQuery({ ...plan, filters: [{ field: "salary", op: "eq", value: 0 }] })).toThrow("unavailable field");
  });

  it("generates a new customer-sales view from a validated semantic plan", () => {
    const request = "Muestrame un grafico de barras de ventas por cliente";
    const plan: DynamicErpPlan = { source: "salesOrders", filters: [], groupBy: "customer", measures: [{ field: "amount", as: "sales" }], view: "bar", limit: 12, title: "Ventas por cliente" };
    expect(shouldPlanDynamicErp(request, { root: "root", elements: { root: { type: "AnalysisGrid", props: {}, children: [] } } })).toBe(true);
    expect(validateDynamicErpPlan(plan, request)).toBeNull();
    const spec = buildDynamicErpSpec(plan, request);
    expect(spec.elements.chart.type).toBe("BarChartCard");
    expect(spec.elements.records.type).toBe("DataTable");
    expect(dynamicFidelityIssue(request, spec)).toBeNull();
    expect((spec.elements.records.props.data as { customer: string; sales: number }[]).every((row) => row.customer && row.sales > 0)).toBe(true);
  });

  it("rejects another module, invented fields and a mismatched chart", () => {
    const request = "Muestrame un grafico de tarta de ventas por cliente";
    const plan: DynamicErpPlan = { source: "salesOrders", filters: [], groupBy: "customer", measures: [{ field: "amount", as: "sales" }], view: "pie", limit: 12, title: "Ventas por cliente" };
    expect(validateDynamicErpPlan({ ...plan, source: "purchaseOrders" }, request)).toContain("módulo distinto");
    expect(validateDynamicErpPlan({ ...plan, measures: [{ field: "invented", as: "sales" }] }, request)).toContain("medida");
    expect(validateDynamicErpPlan({ ...plan, view: "bar" }, request)).toContain("tarta");
    const spec = buildDynamicErpSpec(plan, request);
    expect(spec.elements.chart.type).toBe("PieChartCard");
    const slices = spec.elements.chart.props.data as { value: number }[];
    expect(slices.reduce((sum, row) => sum + row.value, 0)).toBe(demoErpProvider.list("salesOrders").reduce((sum, row) => sum + Number(row.amount), 0));
  });

  it("keeps requested record counts and sums every record in generated summaries", () => {
    const request = "Top 3 ventas por cliente";
    const plan: DynamicErpPlan = { source: "salesOrders", filters: [], groupBy: "customer", measures: [{ field: "amount", as: "sales" }], view: "table", limit: 3, title: "Top clientes" };
    expect(validateDynamicErpPlan({ ...plan, limit: 5 }, request)).toContain("cantidad");
    expect((buildDynamicErpSpec(plan, request).elements.records.props.data as unknown[])).toHaveLength(3);
    const summary = buildDynamicErpSpec({ ...plan, groupBy: null, view: "summary", limit: 2 }, "Suma total de ventas");
    const total = demoErpProvider.list("salesOrders").reduce((sum, row) => sum + Number(row.amount), 0);
    expect(summary.elements.total.props.value).toBe(new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(total));
  });
});
