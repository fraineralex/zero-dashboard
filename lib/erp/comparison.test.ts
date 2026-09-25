import { describe, expect, it } from "vitest";
import { demoErpProvider, demoPosTickets } from "@/lib/erp/demo";
import { requestedComparisonSources } from "@/lib/erp/comparison";
import { buildErpSpec } from "@/lib/erp/intent";
import { requestFidelityIssue } from "@/lib/dashboard/fidelity";

describe("generated cross-module comparisons", () => {
  it.each([
    ["grafico de ventas vs nomina", ["sales", "payroll"]],
    ["grafico que muestre punto de venta vs compras", ["pos", "purchases"]],
    ["compara punto de venta, compras y nómina", ["pos", "purchases", "payroll"]],
  ] as const)("answers %s with every requested source", (request, sources) => {
    expect(requestedComparisonSources(request)).toEqual(sources);
    const spec = buildErpSpec(request)!;
    expect(spec.elements.chart.type).toBe("BarChartCard");
    expect(spec.elements.records.type).toBe("DataTable");
    expect((spec.elements.chart.props.data as { source: string }[]).map((row) => row.source)).toEqual(sources);
    expect(requestFidelityIssue(request, spec)).toBeNull();
    expect(requestFidelityIssue(request, buildErpSpec("punto de venta")!)).not.toBeNull();
  });

  it("uses POS receipts and purchase orders rather than recurring revenue", () => {
    const spec = buildErpSpec("grafico que muestre punto de venta vs compras")!;
    const data = spec.elements.chart.props.data as { source: string; value: number }[];
    expect(data.find((row) => row.source === "pos")?.value).toBe(demoPosTickets.reduce((sum, row) => sum + row.amount, 0));
    expect(data.find((row) => row.source === "purchases")?.value).toBe(demoErpProvider.list("purchaseOrders").reduce((sum, row) => sum + Number(row.amount), 0));
  });
});
