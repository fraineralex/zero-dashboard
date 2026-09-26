import { describe, expect, it } from "vitest";
import { buildBusinessSpec, businessFidelityIssue, executeBusinessPlan, planBusinessQuestion } from "@/lib/erp/business-question";
import { demoErpProvider, demoToday } from "@/lib/erp/demo";
import { buildErpSpec } from "@/lib/erp/intent";
import { requestFidelityIssue } from "@/lib/dashboard/fidelity";
import { dashboardCatalog } from "@/lib/dashboard/catalog";
import { validateCanvasDesign } from "@/lib/dashboard/design-system";

describe("business questions preserve measures, scope and supporting records", () => {
  it.each([
    "porcentage de crecimiento de nomina del mes anterior respecto al mes actual",
    "Porcentaje de crecimiento de nómina del mes pasado al actual",
  ])("calculates payroll growth for %s", (intent) => {
    const plan = planBusinessQuestion(intent)!;
    expect(plan.source).toBe("payrollRuns");
    const spec = buildBusinessSpec(plan);
    const runs = demoErpProvider.list("payrollRuns");
    const current = Number(runs.find((row) => row.period === demoToday.slice(0, 7))?.employerCost);
    const [year, month] = demoToday.slice(0, 7).split("-").map(Number);
    const previousPeriod = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
    const previous = Number(runs.find((row) => row.period === previousPeriod)?.employerCost);
    expect(spec.elements.growth.props.value).toBe(`${current >= previous ? "+" : ""}${(((current - previous) / previous) * 100).toFixed(2)}%`);
    expect((spec.elements.evidence.props.data as { amount: number }[]).map((row) => row.amount)).toEqual([previous, current]);
    expect(businessFidelityIssue(intent, spec)).toBeNull();
  });

  it("does not replace net-payroll growth with employer-cost growth", () => {
    const intent = "Porcentaje de crecimiento de nómina neta del mes anterior al mes actual";
    const plan = planBusinessQuestion(intent)!;
    expect(plan.measures[0].field).toBe("net");
    const spec = buildBusinessSpec(plan);
    expect(spec.elements.evidence.props.columns).toContainEqual({ key: "amount", label: "Nómina neta", format: "dop" });
    expect(businessFidelityIssue(intent, spec)).toBeNull();
  });

  it("reconciles credit notes issued, applied and still available", () => {
    const intent = "Qué monto se le ha hecho notas de crédito este mes y cuáles han sido consumidas de ellas";
    const plan = planBusinessQuestion(intent)!;
    expect(plan.source).toBe("creditNotes");
    const spec = buildBusinessSpec(plan);
    const rows = spec.elements.records.props.data as { amount: number; appliedAmount: number; remainingAmount: number; status: string }[];
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.amount === row.appliedAmount + row.remainingAmount)).toBe(true);
    expect(rows.some((row) => row.status === "Aplicada")).toBe(true);
    expect(rows.some((row) => row.status === "Parcial")).toBe(true);
    const totals = executeBusinessPlan(plan).totals;
    expect(totals.amount).toBe(totals.appliedAmount + totals.remainingAmount);
    expect(businessFidelityIssue(intent, spec)).toBeNull();
  });

  it("ranks only invoices issued today, with identifiable customers and exact amounts", () => {
    const intent = "muéstrame los clientes que más facturaron hoy";
    const plan = planBusinessQuestion(intent)!;
    expect(plan.source).toBe("customerInvoices");
    expect(plan.period).toBe("today");
    const spec = buildBusinessSpec(plan);
    const rows = spec.elements.records.props.data as { customer: string; amount: number }[];
    expect(rows).toHaveLength(5);
    expect(rows.every((row, index) => row.customer && (index === 0 || rows[index - 1].amount >= row.amount))).toBe(true);
    const source = demoErpProvider.list("customerInvoices").filter((row) => row.date === demoToday);
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(source.reduce((sum, row) => sum + Number(row.amount), 0));
    expect(businessFidelityIssue(intent, spec)).toBeNull();
  });

  it("returns an honest empty state instead of another period when no records exist", () => {
    const plan = planBusinessQuestion("muéstrame los clientes que más facturaron hoy")!;
    const spec = buildBusinessSpec(plan, demoErpProvider, "2028-01-02");
    expect(spec.elements.empty.type).toBe("FindingCard");
    expect(spec.elements.records).toBeUndefined();
  });

  it("uses the existing POS fields to compose a payment-method pie", () => {
    const intent = "Muestra ventas de punto de venta por método de pago en gráfico de tarta";
    const plan = planBusinessQuestion(intent)!;
    const spec = buildBusinessSpec(plan);
    expect(spec.elements.chart.type).toBe("PieChartCard");
    const slices = spec.elements.chart.props.data as { name: string; value: number }[];
    expect(slices.map((slice) => slice.name).sort()).toEqual(["Efectivo", "Tarjeta", "Transferencia"]);
    expect(slices.reduce((sum, slice) => sum + slice.value, 0)).toBe(demoErpProvider.list("posTickets").reduce((sum, row) => sum + Number(row.amount), 0));
    expect(businessFidelityIssue(intent, spec)).toBeNull();
  });

  it("honors the requested number of recent POS tickets", () => {
    const intent = "Muéstrame los 5 tickets POS más recientes";
    const spec = buildBusinessSpec(planBusinessQuestion(intent)!);
    const rows = spec.elements.records.props.data as { id: string; date: string }[];
    expect(rows).toHaveLength(5);
    expect(rows.every((row, index) => index === 0 || rows[index - 1].date >= row.date)).toBe(true);
    const selectedTotal = (spec.elements.records.props.data as { amount: number }[]).reduce((sum, row) => sum + row.amount, 0);
    expect(spec.elements.metric0.props.value).toBe(new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(selectedTotal));
    expect(businessFidelityIssue(intent, spec)).toBeNull();
  });

  it("ranks invoices issued this month, not recurring SaaS revenue", () => {
    const intent = "Muéstrame los 10 clientes que más han facturado este mes";
    const plan = planBusinessQuestion(intent)!;
    expect(plan).toMatchObject({ source: "customerInvoices", period: "thisMonth", groupBy: "customer", limit: 10 });
    const spec = buildBusinessSpec(plan);
    const rows = spec.elements.records.props.data as { customer: string; amount: number }[];
    expect(rows).toHaveLength(10);
    expect(rows.every((row, index) => Boolean(row.customer) && (index === 0 || rows[index - 1].amount >= row.amount))).toBe(true);
    expect(businessFidelityIssue(intent, spec)).toBeNull();
  });

  it("excludes paid invoices from receivables and future due invoices from overdue", () => {
    const openIntent = "Muéstrame las cuentas por cobrar";
    const openPlan = planBusinessQuestion(openIntent)!;
    const openRows = executeBusinessPlan(openPlan).rows;
    expect(openRows.length).toBeGreaterThan(0);
    expect(openRows.every((row) => row.status === "Por cobrar")).toBe(true);
    expect(businessFidelityIssue(openIntent, buildBusinessSpec(openPlan))).toBeNull();

    const overdueIntent = "Muéstrame las facturas de clientes vencidas";
    const overduePlan = planBusinessQuestion(overdueIntent)!;
    const overdueRows = executeBusinessPlan(overduePlan).rows;
    expect(overdueRows.every((row) => row.status === "Por cobrar" && String(row.due) < demoToday)).toBe(true);
    expect(buildBusinessSpec(overduePlan).elements.records === undefined || overdueRows.length > 0).toBe(true);
    expect(businessFidelityIssue(overdueIntent, buildBusinessSpec(overduePlan))).toBeNull();
  });

  it("uses expense entries for expenses by category", () => {
    const intent = "Gráfico de barras de gastos por categoría";
    const plan = planBusinessQuestion(intent)!;
    expect(plan).toMatchObject({ source: "expenseEntries", groupBy: "category", view: "bar" });
    const spec = buildBusinessSpec(plan);
    expect(spec.elements.chart.type).toBe("BarChartCard");
    const rows = spec.elements.records.props.data as { category: string; amount: number }[];
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(demoErpProvider.list("expenseEntries").reduce((sum, row) => sum + Number(row.amount), 0));
    expect(businessFidelityIssue(intent, spec)).toBeNull();
  });

  it("does not present the September POS sample as yesterday's sales", () => {
    const intent = "Muéstrame las ventas del punto de venta de ayer";
    const plan = planBusinessQuestion(intent)!;
    expect(plan.period).toBe("yesterday");
    const rows = executeBusinessPlan(plan).rows;
    const target = new Date(new Date(`${demoToday}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
    expect(rows.every((row) => row.date === target)).toBe(true);
    expect(businessFidelityIssue(intent, buildBusinessSpec(plan))).toBeNull();
  });

  it("compares open receivables and payables as balances, excluding paid bills", () => {
    const intent = "Compara cuentas por cobrar vs cuentas por pagar";
    const spec = buildErpSpec(intent)!;
    const bars = spec.elements.chart.props.data as { source: string; value: number }[];
    expect(bars.map((row) => row.source)).toEqual(["receivables", "payables"]);
    expect(bars[0].value).toBe(demoErpProvider.list("customerInvoices").filter((row) => row.status === "Por cobrar").reduce((sum, row) => sum + Number(row.amount), 0));
    expect(bars[1].value).toBe(demoErpProvider.list("vendorBills").filter((row) => row.status === "Pendiente").reduce((sum, row) => sum + Number(row.amount), 0));
    expect(requestFidelityIssue(intent, spec)).toBeNull();
  });

  it("keeps paid and pending invoice statuses separate", () => {
    const paid = planBusinessQuestion("Facturas de clientes pagadas")!;
    expect(executeBusinessPlan(paid).rows.every((row) => row.status === "Pagada")).toBe(true);
    const pending = planBusinessQuestion("Facturas de proveedores pendientes")!;
    expect(executeBusinessPlan(pending).rows.every((row) => row.status === "Pendiente")).toBe(true);
    const overdue = planBusinessQuestion("Facturas de proveedores vencidas")!;
    expect(executeBusinessPlan(overdue).rows.every((row) => row.status === "Pendiente" && String(row.due) < demoToday)).toBe(true);
    expect(planBusinessQuestion("Facturas pagadas hoy")).toBeNull();
    const pieIntent = "Gráfico de tarta de facturas pagadas por cliente";
    const pie = buildBusinessSpec(planBusinessQuestion(pieIntent)!);
    expect(pie.elements.chart.type).toBe("PieChartCard");
    expect(requestFidelityIssue(pieIntent, pie)).toBeNull();
  });

  it("counts filtered attendance and out-of-stock products by their requested dimension", () => {
    const late = planBusinessQuestion("Gráfico de tardanzas por departamento")!;
    expect(late).toMatchObject({ source: "attendance", groupBy: "department", view: "bar" });
    const lateSpec = buildBusinessSpec(late);
    const lateRows = lateSpec.elements.records.props.data as { department: string; count: number }[];
    expect(lateRows.reduce((sum, row) => sum + row.count, 0)).toBe(demoErpProvider.list("attendance").filter((row) => row.status === "Tardanza").length);

    const stock = planBusinessQuestion("Productos sin stock por almacén")!;
    expect(stock).toMatchObject({ source: "stock", groupBy: "warehouse" });
    const stockSpec = buildBusinessSpec(stock);
    const stockRows = stockSpec.elements.records.props.data as { warehouse: string; count: number }[];
    expect(stockRows.reduce((sum, row) => sum + row.count, 0)).toBe(demoErpProvider.list("stock").filter((row) => row.available === 0).length);
  });

  it("groups gross payroll by department instead of showing employee records only", () => {
    const intent = "Gráfico de nómina bruta por departamento";
    const plan = planBusinessQuestion(intent)!;
    expect(plan).toMatchObject({ source: "payroll", groupBy: "department", view: "bar", measures: [{ field: "gross", label: "Nómina bruta" }] });
    const spec = buildBusinessSpec(plan);
    expect(spec.elements.chart.type).toBe("BarChartCard");
    const rows = spec.elements.records.props.data as { gross: number }[];
    expect(rows.reduce((sum, row) => sum + row.gross, 0)).toBe(demoErpProvider.list("payroll").reduce((sum, row) => sum + Number(row.gross), 0));
    expect(requestFidelityIssue(intent, spec)).toBeNull();
  });

  it.each([
    "grafico de torta con el porcentage que se lleva cada deparmento en nomina del total",
    "Gráfico de tarta del porcentaje de nómina por departamento",
    "Distribución porcentual de la nómina entre departamentos",
  ])("shows each department's actual share of total payroll for %s", (intent) => {
    const plan = planBusinessQuestion(intent)!;
    expect(plan).toMatchObject({ source: "payroll", period: "all", groupBy: "department", view: "pie", measures: [{ field: "gross", label: "Nómina bruta" }] });
    const spec = buildBusinessSpec(plan);
    expect(spec.elements.chart.type).toBe("PieChartCard");
    const slices = spec.elements.chart.props.data as { name: string; value: number }[];
    const rows = spec.elements.records.props.data as { department: string; gross: number; share: number }[];
    const employees = demoErpProvider.list("payroll");
    const total = employees.reduce((sum, row) => sum + Number(row.gross), 0);
    expect(slices).toHaveLength(new Set(employees.map((row) => row.department)).size);
    expect(slices.reduce((sum, slice) => sum + slice.value, 0)).toBe(total);
    expect(rows.map((row) => row.department)).toEqual(slices.map((slice) => slice.name));
    expect(rows.every((row) => Math.abs(row.share - row.gross / total * 100) < 0.00001)).toBe(true);
    expect(rows.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(100);
    expect(spec.elements.records.props.columns).toContainEqual({ key: "share", label: "% del total", format: "percent" });
    expect(dashboardCatalog.validate(spec).success).toBe(true);
    expect(validateCanvasDesign(spec)).toBeNull();
    expect(requestFidelityIssue(intent, spec)).toBeNull();
  });

  it("keeps explicitly requested net payroll distinct from gross", () => {
    const intent = "Gráfico de torta del porcentaje de nómina neta de cada departamento";
    const plan = planBusinessQuestion(intent)!;
    expect(plan.measures[0].field).toBe("net");
    const spec = buildBusinessSpec(plan);
    const total = demoErpProvider.list("payroll").reduce((sum, row) => sum + Number(row.net), 0);
    expect((spec.elements.chart.props.data as { value: number }[]).reduce((sum, row) => sum + row.value, 0)).toBe(total);
    expect(requestFidelityIssue(intent, spec)).toBeNull();
  });
});
