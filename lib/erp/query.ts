import { demoErpProvider, type ErpCollection, type ErpReadProvider, type ErpRecord } from "@/lib/erp/demo";
import type { DashboardElement, DashboardSpec } from "@/types/analytics";

type FieldFilter = { field: string; op: "eq" | "startsWith"; value: string | number };
type Measure = { field: string; as: string };
export type ErpQueryPlan = {
  purpose: "productSales" | "payrollTaxes" | "payrollMonthly" | "stockZero" | "pendingInvoices" | "dynamic";
  source: ErpCollection;
  filters: FieldFilter[];
  groupBy?: string;
  measures: Measure[];
  view: "pie" | "bar" | "table" | "summary" | "line";
  limit?: number;
};

export const erpFields: Record<ErpCollection, { dimensions: string[]; measures: string[] }> = {
  purchaseOrders: { dimensions: ["id", "date", "supplier", "status"], measures: ["items", "amount"] },
  salesOrders: { dimensions: ["id", "date", "customer", "status"], measures: ["items", "amount"] },
  salesLines: { dimensions: ["product", "productId", "date", "customer", "orderId"], measures: ["quantity", "subtotal"] },
  vendorBills: { dimensions: ["id", "date", "supplier", "due", "status"], measures: ["amount"] },
  customerInvoices: { dimensions: ["id", "date", "customer", "due", "status"], measures: ["amount"] },
  journalEntries: { dimensions: ["id", "date", "reference", "account"], measures: ["debit", "credit"] },
  payrollTaxPayments: { dimensions: ["period", "type", "date", "status"], measures: ["amount"] },
  payrollRuns: { dimensions: ["period", "month", "status"], measures: ["gross", "net", "employerTaxes", "employerCost", "tssEmployer", "infotepEmployer"] },
  payroll: { dimensions: ["id", "employee", "department", "status"], measures: ["gross", "deductions", "net"] },
  stock: { dimensions: ["id", "product", "warehouse", "status"], measures: ["available", "minimum", "unitCost"] },
  attendance: { dimensions: ["id", "date", "employee", "department", "status"], measures: [] },
};
const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const dop = (value: number) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(value);
const element = (type: string, props: Record<string, unknown>): DashboardElement => ({ type, props, children: [] });
const root = (title: string, subtitle: string, children: string[], layout = "AnalysisGrid"): DashboardElement => ({ type: layout, props: { title, subtitle }, children });

export function isCrossModuleComparison(intent: string): boolean {
  const text = normalize(intent);
  return /nomina|payroll|salarios?|sueldos?/.test(text) && /compras?|adquisiciones?/.test(text) && /ventas?|ingresos?/.test(text) && /grafico|grafica|compara|comparacion|versus|\bvs\b/.test(text);
}

export function buildCrossModuleComparisonSpec(intent: string, provider: ErpReadProvider = demoErpProvider): DashboardSpec | null {
  if (!isCrossModuleComparison(intent)) return null;
  const period = "2026-09";
  const payroll = provider.list("payrollRuns").find((row) => row.period === period);
  if (!payroll) return null;
  const purchases = provider.list("purchaseOrders").filter((row) => String(row.date).startsWith(period));
  const sales = provider.list("salesOrders").filter((row) => String(row.date).startsWith(period));
  const data = [
    { name: "Costo de nómina", value: Number(payroll.employerCost), records: 1, basis: "Bruto + aportes patronales", source: "Nómina" },
    { name: "Compras", value: purchases.reduce((sum, row) => sum + Number(row.amount), 0), records: purchases.length, basis: "Órdenes de compra", source: "Compras" },
    { name: "Ventas", value: sales.reduce((sum, row) => sum + Number(row.amount), 0), records: sales.length, basis: "Órdenes de venta", source: "Ventas" },
  ];
  return { root: "root", state: { erp: { collection: "payrollPurchasesSales", source: "demo", period, measures: data.map(({ name, value }) => ({ name, value })) } }, elements: {
    root: root("Nómina vs compras vs ventas", "Septiembre 2026 · importes comparables en RD$ · datos simulados", ["chart", "records"]),
    chart: element("BarChartCard", { title: "Tres magnitudes, un período", description: "Costo empresa de nómina frente a órdenes de compra y de venta · no son flujos de caja", data, xKey: "name", series: [{ key: "value", label: "Importe" }], format: "dop", span: "wide" }),
    records: element("DataTable", { title: "Qué representa cada barra", description: "Misma moneda y mismo mes; conceptos contables diferentes", data: data.map((row, index) => ({ id: String(index + 1), ...row })), columns: [{ key: "name", label: "Medida" }, { key: "value", label: "Importe", format: "dop" }, { key: "basis", label: "Base de cálculo" }, { key: "records", label: "Registros" }, { key: "source", label: "Módulo" }], currency: "DOP", span: "wide" }),
  } };
}

export function crossModuleFidelityIssue(intent: string, spec: DashboardSpec): string | null | undefined {
  if (!isCrossModuleComparison(intent)) return undefined;
  const marker = spec.state?.erp as { collection?: string; period?: string; measures?: { name: string; value: number }[] } | undefined;
  const chart = Object.values(spec.elements).find((block) => block.type === "BarChartCard");
  const table = Object.values(spec.elements).find((block) => block.type === "DataTable");
  const data = chart?.props.data as { name: string; value: number }[] | undefined;
  const rows = table?.props.data as { name: string; value: number }[] | undefined;
  if (marker?.collection !== "payrollPurchasesSales" || marker.period !== "2026-09" || !chart || !table || data?.length !== 3 || rows?.length !== 3) return "La comparación debe mostrar nómina, compras y ventas del mismo mes.";
  const expected = buildCrossModuleComparisonSpec(intent)?.state?.erp as { measures?: { name: string; value: number }[] } | undefined;
  if (!expected?.measures || expected.measures.some((measure) => !data.some((item) => item.name === measure.name && item.value === measure.value) || !rows.some((item) => item.name === measure.name && item.value === measure.value))) return "Una de las tres medidas no coincide con los registros ERP.";
  return null;
}

export function planKnownErpQuestion(intent: string): ErpQueryPlan | null {
  const text = normalize(intent);
  if (/facturas?|cuentas? por cobrar/.test(text) && /pendientes?|por cobrar/.test(text) && /clientes?|usuarios?/.test(text)) return {
    purpose: "pendingInvoices", source: "customerInvoices", filters: [{ field: "status", op: "eq", value: "Por cobrar" }], groupBy: "customer",
    measures: [{ field: "amount", as: "amount" }], view: /tarta|pastel|pie|dona|donut|circular/.test(text) ? "pie" : /tabla|lista/.test(text) ? "table" : "bar",
    limit: Math.min(30, Math.max(1, Number(text.match(/\b(?:top|primer[oa]s?|ultim[oa]s?)\s+(\d{1,2})\b/)?.[1] ?? 30))),
  };
  const productSales = /\b(productos?|articulos?|items?|skus?)\b/.test(text) && /mas vendidos?|top.*vendid|ventas? por producto|unidades? vendidas?/.test(text);
  if (productSales) return {
    purpose: "productSales", source: "salesLines", filters: [{ field: "date", op: "startsWith", value: "2026-09" }], groupBy: "product",
    measures: [{ field: /por importe|por monto|facturacion|ingresos|dinero/.test(text) ? "subtotal" : "quantity", as: "value" }, { field: "subtotal", as: "revenue" }],
    view: /tarta|pastel|pie|dona|donut|circular/.test(text) ? "pie" : /tabla|lista|ranking/.test(text) ? "table" : "bar",
    limit: Math.min(12, Math.max(1, Number(text.match(/\b(\d{1,2})\b/)?.[1] ?? 12))),
  };
  const payroll = /nomina|payroll|salarios?|sueldos?/.test(text);
  if (payroll && /impuestos?|aportes?|contribuciones?|cargas sociales|tss|infotep/.test(text) && /empresa|patronal|empleador|pago|sum|cuanto/.test(text)) return {
    purpose: "payrollTaxes", source: "payrollTaxPayments", filters: [{ field: "period", op: "eq", value: "2026-09" }], groupBy: "type", measures: [{ field: "amount", as: "amount" }], view: "summary",
  };
  if (payroll && /\b(mes|mensual|mensualmente|cada mes|por mes|al mes)\b|pagando en nomina|costo.*nomina/.test(text)) return {
    purpose: "payrollMonthly", source: "payrollRuns", filters: [], groupBy: "month", measures: [{ field: "gross", as: "gross" }, { field: "net", as: "net" }, { field: "employerCost", as: "employerCost" }], view: "line",
  };
  if (/productos?|inventario|stock|existencias?/.test(text) && /sin stock|sin existencias?|agotad|stock\s*(?:=|igual a)?\s*0|inventario\s*(?:=|igual a)?\s*0/.test(text)) return {
    purpose: "stockZero", source: "stock", filters: [{ field: "available", op: "eq", value: 0 }], measures: [], view: "table",
  };
  return null;
}

/** Execute only whitelisted, read-only fields; no generated SQL, code, or arbitrary Odoo RPC calls. */
export function executeErpQuery(plan: ErpQueryPlan, provider: ErpReadProvider = demoErpProvider): ErpRecord[] {
  const definition = erpFields[plan.source];
  if (!definition || plan.filters.some((filter) => ![...definition.dimensions, ...definition.measures].includes(filter.field)) || plan.measures.some((measure) => !definition.measures.includes(measure.field)) || (plan.groupBy && !definition.dimensions.includes(plan.groupBy))) throw new Error("ERP query references an unavailable field.");
  const source = provider.list(plan.source).filter((row) => plan.filters.every((filter) => filter.op === "eq" ? row[filter.field] === filter.value : String(row[filter.field] ?? "").startsWith(String(filter.value))));
  if (!plan.groupBy) return source.map((row) => ({ ...row }));
  const groups = new Map<string, ErpRecord>();
  for (const row of source) {
    const key = String(row[plan.groupBy] ?? "");
    const item = groups.get(key) ?? { [plan.groupBy]: key };
    for (const measure of plan.measures) item[measure.as] = Number(item[measure.as] ?? 0) + Number(row[measure.field] ?? 0);
    groups.set(key, item);
  }
  return [...groups.values()];
}

export function buildSemanticErpSpec(intent: string, provider: ErpReadProvider = demoErpProvider): DashboardSpec | null {
  const plan = planKnownErpQuestion(intent);
  if (!plan) return null;
  const queried = executeErpQuery(plan, provider);
  const metadata = { purpose: plan.purpose, collection: plan.source, source: "demo", view: plan.view };
  if (plan.purpose === "productSales") {
    const byValue = [...queried].sort((a, b) => Number(b.value) - Number(a.value));
    const selected = byValue.slice(0, plan.limit);
    const others = byValue.slice(plan.limit).reduce((sum, row) => sum + Number(row.value), 0);
    const isMoney = plan.measures[0].field === "subtotal";
    const chartData = selected.map((row) => ({ name: String(row.product), value: Number(row.value) }));
    if (others > 0) chartData.push({ name: "Otros productos", value: others });
    const tableData = selected.map((row, index) => ({ id: String(row.product), rank: index + 1, product: row.product, value: row.value, revenue: row.revenue }));
    const chartType = plan.view === "pie" ? "PieChartCard" : "BarChartCard";
    const elements: Record<string, DashboardElement> = {
      root: root("Productos más vendidos", `Septiembre 2026 · ${isMoney ? "importe vendido" : "unidades vendidas"} · datos simulados`, plan.view === "table" ? ["records"] : ["chart", "records"]),
      records: element("DataTable", { title: "Productos identificables", description: `${selected.length} productos ordenados por ${isMoney ? "importe" : "unidades"} · muestra demo`, data: tableData, columns: [{ key: "rank", label: "#" }, { key: "product", label: "Producto" }, { key: "value", label: isMoney ? "Ventas" : "Unidades", ...(isMoney ? { format: "dop" } : {}) }, { key: "revenue", label: "Importe vendido", format: "dop" }], currency: "DOP", span: "wide" }),
    };
    if (plan.view !== "table") elements.chart = plan.view === "pie"
      ? element(chartType, { title: "Participación por producto", description: `Cada porción representa ${isMoney ? "RD$ vendidos" : "unidades vendidas"}${others > 0 ? " · otros reúne el resto" : ""}`, data: chartData, nameKey: "name", valueKey: "value", format: isMoney ? "dop" : "number", unitLabel: isMoney ? "Ventas en RD$" : "Unidades vendidas", span: "wide" })
      : element(chartType, { title: "Productos líderes", description: `Ordenado por ${isMoney ? "importe" : "unidades"} vendido`, data: selected.map((row) => ({ name: String(row.product).slice(0, 16), value: Number(row.value) })), xKey: "name", series: [{ key: "value", label: isMoney ? "Ventas" : "Unidades" }], format: isMoney ? "dop" : "number", horizontal: true, span: "wide" });
    return { root: "root", state: { erp: { ...metadata, measure: plan.measures[0].field, total: byValue.reduce((sum, row) => sum + Number(row.value), 0) } }, elements };
  }
  if (plan.purpose === "payrollTaxes") {
    const payments = provider.list("payrollTaxPayments").filter((row) => row.period === "2026-09").sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const total = payments.reduce((sum, row) => sum + Number(row.amount), 0);
    const breakdown = queried.sort((a, b) => Number(b.amount) - Number(a.amount));
    return { root: "root", state: { erp: { ...metadata, total } }, elements: {
      root: root("Aportes patronales pagados", "Septiembre 2026 · pagos efectuados · RD$ · datos simulados", ["total", "breakdown", "payments"]),
      total: element("MetricCard", { label: "Total pagado por la empresa", value: dop(total), tone: "neutral", helper: "TSS + INFOTEP patronal · no son deducciones del empleado", span: "wide" }),
      breakdown: element("BarChartCard", { title: "Detalle por concepto", description: "Pagos de cargas de nómina asumidos por la empresa", data: breakdown.map((row) => ({ name: row.type, value: row.amount })), xKey: "name", series: [{ key: "value", label: "Pagado" }], format: "dop", span: "wide" }),
      payments: element("DataTable", { title: "Pagos que componen el total", description: "Dos pagos registrados · septiembre 2026 · datos simulados", data: payments, columns: [{ key: "date", label: "Fecha" }, { key: "type", label: "Concepto" }, { key: "amount", label: "Pagado", format: "dop" }, { key: "status", label: "Estado" }], currency: "DOP", total, span: "wide" }),
    } };
  }
  if (plan.purpose === "payrollMonthly") {
    const runs = provider.list("payrollRuns");
    const current = runs.find((row) => row.period === "2026-09");
    if (!current) throw new Error("Payroll run for the requested month is unavailable.");
    return { root: "root", state: { erp: { ...metadata, period: "2026-09", total: current.employerCost } }, elements: {
      root: root("Costo de nómina por mes", "Octubre 2025 — septiembre 2026 · RD$ · datos simulados", ["cost", "gross", "net", "trend", "records"]),
      cost: element("MetricCard", { label: "Costo total empresa · septiembre", value: dop(Number(current.employerCost)), tone: "neutral", helper: "Bruto + aportes patronales" }),
      gross: element("MetricCard", { label: "Salario bruto · septiembre", value: dop(Number(current.gross)), tone: "neutral", helper: "Antes de deducciones" }),
      net: element("MetricCard", { label: "Neto a empleados · septiembre", value: dop(Number(current.net)), tone: "neutral", helper: "Después de deducciones" }),
      trend: element("LineChartCard", { title: "Evolución mensual de nómina", description: "Costo empresa, bruto y neto · cada línea es una medida", data: runs.map((row) => ({ month: row.month, employerCost: row.employerCost, gross: row.gross, net: row.net })), xKey: "month", series: [{ key: "employerCost", label: "Costo empresa" }, { key: "gross", label: "Bruto" }, { key: "net", label: "Neto" }], format: "dop", span: "wide" }),
      records: element("DataTable", { title: "Detalle mes a mes", description: "Aportes patronales separados del salario y del neto", data: runs, columns: [{ key: "period", label: "Mes" }, { key: "gross", label: "Bruto", format: "dop" }, { key: "net", label: "Neto", format: "dop" }, { key: "employerTaxes", label: "Aportes patronales", format: "dop" }, { key: "employerCost", label: "Costo empresa", format: "dop" }], currency: "DOP", span: "wide" }),
    } };
  }
  if (plan.purpose === "pendingInvoices") {
    const invoices = provider.list("customerInvoices").filter((row) => row.status === "Por cobrar").sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const grouped = [...queried].sort((a, b) => Number(b.amount) - Number(a.amount));
    const selected = grouped.slice(0, plan.limit);
    const chartData = selected.map((row) => ({ name: String(row.customer), value: Number(row.amount) }));
    const tableRows = invoices.filter((row) => selected.some((item) => item.customer === row.customer));
    const total = tableRows.reduce((sum, row) => sum + Number(row.amount), 0);
    const children = plan.view === "table" ? ["records"] : ["chart", "records"];
    const elements: Record<string, DashboardElement> = {
      root: root("Facturas pendientes por cliente", "Septiembre 2026 · solo facturas por cobrar · RD$ · datos simulados", children),
      records: element("DataTable", { title: "Facturas pendientes identificables", description: `${tableRows.length} facturas por cobrar · total ${dop(total)} · muestra demo`, data: tableRows, columns: [{ key: "customer", label: "Cliente" }, { key: "id", label: "Factura" }, { key: "date", label: "Emisión" }, { key: "due", label: "Vencimiento" }, { key: "amount", label: "Pendiente", format: "dop" }, { key: "status", label: "Estado" }], currency: "DOP", total, span: "wide" }),
    };
    if (plan.view === "pie") elements.chart = element("PieChartCard", { title: "Deuda por cliente", description: "Distribución del importe pendiente de cobro", data: chartData, nameKey: "name", valueKey: "value", format: "dop", unitLabel: "Pendiente en RD$", span: "wide" });
    else if (plan.view === "bar") elements.chart = element("BarChartCard", { title: "Deuda por cliente", description: "Facturas por cobrar agrupadas por cliente", data: chartData, xKey: "name", series: [{ key: "value", label: "Pendiente" }], format: "dop", horizontal: true, span: "wide" });
    return { root: "root", state: { erp: { ...metadata, total, count: invoices.length } }, elements };
  }
  const stock = queried;
  return { root: "root", state: { erp: { ...metadata, collection: "stock", mode: "zero", count: stock.length } }, elements: {
    root: root("Productos sin stock", "Existencia disponible = 0 · dos almacenes · datos simulados", ["records"], "TableFocus"),
    records: element("DataTable", { title: "Existencias agotadas", description: `${stock.length} productos con exactamente 0 unidades disponibles`, data: stock, columns: [{ key: "id", label: "SKU" }, { key: "product", label: "Producto" }, { key: "warehouse", label: "Almacén" }, { key: "available", label: "Disponible" }, { key: "minimum", label: "Mínimo" }, { key: "status", label: "Estado" }], currency: "DOP", span: "wide" }),
  } };
}

export function semanticFidelityIssue(intent: string, spec: DashboardSpec): string | null | undefined {
  const plan = planKnownErpQuestion(intent);
  if (!plan) return undefined;
  const marker = spec.state?.erp as { purpose?: string; measure?: string; total?: number } | undefined;
  if (marker?.purpose !== plan.purpose) return "La vista no responde a la medida y entidad solicitadas.";
  const blocks = Object.values(spec.elements);
  const find = (type: string) => blocks.find((block) => block.type === type);
  if (plan.purpose === "productSales") {
    if (marker.measure !== plan.measures[0].field) return "El gráfico usa una medida distinta a la solicitada.";
    const target = plan.view === "pie" ? "PieChartCard" : plan.view === "table" ? "DataTable" : "BarChartCard";
    if (!find(target)) return `Se solicitó ${plan.view} y no se mostró esa visualización.`;
    const chartRows = find(target)?.props.data as ErpRecord[] | undefined;
    if (!chartRows?.length || !find("DataTable")) return "Faltan los productos identificables y sus ventas.";
    if (plan.view === "pie" && chartRows.reduce((sum, row) => sum + Number(row.value), 0) !== marker.total) return "El gráfico omite parte de las ventas de productos.";
  }
  if (plan.purpose === "payrollTaxes") {
    const rows = find("DataTable")?.props.data as ErpRecord[] | undefined;
    if (!find("MetricCard") || !rows?.length || rows.some((row) => row.period !== "2026-09" || row.status !== "Pagado") || rows.reduce((sum, row) => sum + Number(row.amount), 0) !== marker.total) return "El total patronal no coincide con los pagos efectuados.";
  }
  if (plan.purpose === "payrollMonthly" && (!find("LineChartCard") || !find("DataTable") || blocks.filter((block) => block.type === "MetricCard").length < 3)) return "Falta el costo mensual, el neto o la comparación temporal de nómina.";
  if (plan.purpose === "stockZero") {
    const rows = find("DataTable")?.props.data as ErpRecord[] | undefined;
    if (!rows || rows.some((row) => row.available !== 0)) return "La vista incluye productos que sí tienen existencias.";
  }
  if (plan.purpose === "pendingInvoices") {
    const rows = find("DataTable")?.props.data as ErpRecord[] | undefined;
    const target = plan.view === "pie" ? "PieChartCard" : plan.view === "bar" ? "BarChartCard" : "DataTable";
    if (!find(target) || !rows?.length || rows.some((row) => row.status !== "Por cobrar" || !row.customer || !row.id || typeof row.amount !== "number")) return "La vista incluye facturas pagadas o carece de clientes e importes.";
    if (rows.reduce((sum, row) => sum + Number(row.amount), 0) !== marker.total) return "El importe pendiente no coincide con las facturas visibles.";
  }
  return null;
}

export type DynamicErpPlan = {
  source: ErpCollection;
  filters: FieldFilter[];
  groupBy: string | null;
  measures: Measure[];
  view: "pie" | "bar" | "line" | "table" | "summary";
  limit: number;
  title: string;
};

export function allowedErpSources(intent: string): ErpCollection[] {
  const text = normalize(intent);
  if (/sin stock|inventario|existencias|almacen/.test(text)) return ["stock"];
  if (/nomina|payroll|salarios?|sueldos?/.test(text) && /impuesto|aporte|tss|infotep|patronal/.test(text)) return ["payrollTaxPayments", "payrollRuns"];
  if (/nomina|payroll|salarios?|sueldos?/.test(text)) return ["payroll", "payrollRuns"];
  if (/asistencia|marcaciones?|ponches?|tardanzas?/.test(text)) return ["attendance"];
  if (/productos?|articulos?|skus?/.test(text) && /vendid|ventas?/.test(text)) return ["salesLines"];
  if (/productos?|articulos?|skus?/.test(text)) return ["stock", "salesLines"];
  if (/proveedores?/.test(text) && /factur|cuentas? por pagar/.test(text)) return ["vendorBills"];
  if (/compras?|proveedores?/.test(text)) return ["purchaseOrders", "vendorBills"];
  if (/clientes?/.test(text) && /factur|cuentas? por cobrar/.test(text)) return ["customerInvoices"];
  if (/ventas?/.test(text)) return ["salesOrders", "salesLines", "customerInvoices"];
  if (/asientos?|contab|libro diario/.test(text)) return ["journalEntries"];
  return [];
}

export function shouldPlanDynamicErp(intent: string, prepared: DashboardSpec): boolean {
  if (isCrossModuleComparison(intent) || planKnownErpQuestion(intent) || !allowedErpSources(intent).length) return false;
  const preparedKind = (prepared.state?.erp as { collection?: string } | undefined)?.collection;
  if (preparedKind === "salesAndPurchases" || preparedKind === "purchasesBySupplier") return false;
  return /gra[áa]fic|tarta|pastel|pie|barras?|lineas?|líneas?|por (?:cliente|proveedor|producto|almacen|departamento|mes|dia|estado|cuenta)|suma|total|promedio|tendencia|evolucion|evolución|compara|combina/i.test(intent);
}

export function validateDynamicErpPlan(plan: DynamicErpPlan, intent: string): string | null {
  const allowed = allowedErpSources(intent);
  if (!allowed.includes(plan.source)) return "El modelo eligió un módulo distinto al solicitado.";
  const definition = erpFields[plan.source];
  if (plan.groupBy && !definition.dimensions.includes(plan.groupBy)) return "La dimensión solicitada no existe en ese modelo.";
  if (plan.filters.length > 3 || plan.filters.some((filter) => ![...definition.dimensions, ...definition.measures].includes(filter.field) || String(filter.value).length > 50)) return "El filtro no pertenece al modelo seleccionado.";
  if (plan.filters.some((filter) => ["status", "warehouse", "department", "type"].includes(filter.field) && filter.op === "eq" && !demoErpProvider.list(plan.source).some((row) => row[filter.field] === filter.value))) return "El filtro categórico no coincide con los valores disponibles en el modelo.";
  if (plan.measures.length > 3 || plan.measures.some((measure) => !definition.measures.includes(measure.field) || !/^[a-zA-Z][a-zA-Z0-9]{0,24}$/.test(measure.as))) return "La medida no pertenece al modelo seleccionado.";
  if (plan.limit < 1 || plan.limit > 30 || plan.title.length < 3 || plan.title.length > 70) return "Los límites de la vista no son válidos.";
  if (["pie", "bar", "line"].includes(plan.view) && (!plan.groupBy || !plan.measures.length)) return "El gráfico requiere una dimensión y al menos una medida.";
  if ((plan.view === "pie" || plan.view === "summary") && plan.measures.length !== 1) return "Esta visualización requiere una sola medida.";
  if (plan.view === "line" && !["date", "period", "month"].includes(plan.groupBy ?? "")) return "Una línea temporal requiere fecha o mes.";
  const text = normalize(intent);
  const requestedCount = text.match(/\b(?:top|ultim[oa]s?|primer[oa]s?)\s+(\d{1,2})\b|\b(\d{1,2})\s+(?:ultim[oa]s?|primer[oa]s?|clientes?|proveedores?|productos?)\b/);
  if (requestedCount && plan.limit !== Number(requestedCount[1] ?? requestedCount[2])) return "La cantidad de registros no coincide con la solicitud.";
  if (/\b(tarta|pastel|pie|donut|dona)\b|grafico circular/.test(text) && plan.view !== "pie") return "La solicitud exige un gráfico de tarta.";
  if (/\b(barras?|bar chart)\b/.test(text) && plan.view !== "bar") return "La solicitud exige un gráfico de barras.";
  if (/\b(lineas?|tendencia|evolucion)\b/.test(text) && plan.view !== "line") return "La solicitud exige una tendencia temporal.";
  const requiredDimension = /por clientes?/.test(text) ? "customer" : /por proveedores?/.test(text) ? "supplier" : /por productos?/.test(text) ? "product" : /por departamentos?/.test(text) ? "department" : /por almac[eé]n(?:es)?/.test(text) ? "warehouse" : null;
  if (requiredDimension && plan.groupBy !== requiredDimension) return "La agrupación no coincide con la entidad pedida.";
  return null;
}

const pretty: Record<string, string> = { id: "Referencia", date: "Fecha", period: "Mes", month: "Mes", product: "Producto", supplier: "Proveedor", customer: "Cliente", warehouse: "Almacén", department: "Departamento", status: "Estado", amount: "Importe", subtotal: "Venta", quantity: "Unidades", gross: "Bruto", net: "Neto", employerCost: "Costo empresa", employerTaxes: "Aportes empresa", available: "Disponible", minimum: "Mínimo", account: "Cuenta", debit: "Débito", credit: "Crédito" };
const currencyFields = new Set(["amount", "subtotal", "gross", "net", "employerCost", "employerTaxes", "tssEmployer", "infotepEmployer", "unitCost", "debit", "credit"]);

export function buildDynamicErpSpec(plan: DynamicErpPlan, intent: string, provider: ErpReadProvider = demoErpProvider): DashboardSpec {
  const issue = validateDynamicErpPlan(plan, intent);
  if (issue) throw new Error(issue);
  const query: ErpQueryPlan = { purpose: "dynamic", source: plan.source, filters: plan.filters, ...(plan.groupBy ? { groupBy: plan.groupBy } : {}), measures: plan.measures, view: plan.view, limit: plan.limit };
  const rows = executeErpQuery(query, provider);
  if (!rows.length) throw new Error("La consulta no devolvió registros en la muestra disponible.");
  const primary = plan.measures[0];
  const sorted = plan.groupBy && plan.view !== "line" && primary ? [...rows].sort((a, b) => Number(b[primary.as]) - Number(a[primary.as])) : rows;
  const selected = sorted.slice(0, plan.limit);
  const format = primary && currencyFields.has(primary.field) ? "dop" : "number";
  const title = plan.title.trim();
  const metadata = { purpose: "dynamic", collection: plan.source, source: "demo", query: plan };
  const cols = plan.groupBy ? [plan.groupBy, ...plan.measures.map((measure) => measure.as)] : Object.keys(selected[0]).slice(0, 7);
  const colProps = cols.map((key) => ({ key, label: pretty[key] ?? pretty[plan.measures.find((measure) => measure.as === key)?.field ?? ""] ?? key, ...(currencyFields.has(plan.measures.find((measure) => measure.as === key)?.field ?? key) ? { format: "dop" } : {}) }));
  const records = element("DataTable", { title: "Detalle de la consulta", description: `${selected.length} de ${rows.length} registros o grupos · ${plan.source} · muestra simulada`, data: selected, columns: colProps, currency: "DOP", span: "wide" });
  if (plan.view === "table") return { root: "root", state: { erp: metadata }, elements: { root: root(title, "Consulta ERP generada · datos simulados", ["records"], "TableFocus"), records } };
  if (plan.view === "summary") {
    const total = rows.reduce((sum, row) => sum + Number(row[primary.as] ?? row[primary.field] ?? 0), 0);
    return { root: "root", state: { erp: { ...metadata, total } }, elements: {
      root: root(title, "Consulta ERP generada · datos simulados", ["total", "records"]),
      total: element("MetricCard", { label: pretty[primary.field] ?? primary.field, value: format === "dop" ? dop(total) : String(total), tone: "neutral", helper: `Suma de ${rows.length} registros` }),
      records,
    } };
  }
  const chartData = selected.map((row) => ({ name: String(row[plan.groupBy!] ?? ""), ...Object.fromEntries(plan.measures.map((measure) => [measure.as, Number(row[measure.as])])) }));
  const series = plan.measures.map((measure) => ({ key: measure.as, label: pretty[measure.field] ?? measure.field, format: currencyFields.has(measure.field) ? "dop" : "number" }));
  const chart = plan.view === "pie"
    ? element("PieChartCard", { title, description: `${pretty[primary.field] ?? primary.field} por ${pretty[plan.groupBy!] ?? plan.groupBy}`, data: [...selected.map((row) => ({ name: String(row[plan.groupBy!] ?? ""), value: Number(row[primary.as]) })), ...(rows.length > selected.length ? [{ name: "Otros", value: rows.slice(selected.length).reduce((sum, row) => sum + Number(row[primary.as]), 0) }] : [])], nameKey: "name", valueKey: "value", format, unitLabel: pretty[primary.field] ?? primary.field, span: "wide" })
    : element(plan.view === "line" ? "LineChartCard" : "BarChartCard", { title, description: `${plan.measures.map((measure) => pretty[measure.field] ?? measure.field).join(" · ")} por ${pretty[plan.groupBy!] ?? plan.groupBy}`, data: chartData, xKey: "name", series, format, ...(plan.view === "bar" ? { horizontal: true } : {}), span: "wide" });
  return { root: "root", state: { erp: metadata }, elements: { root: root(title, "Consulta ERP generada · datos simulados", ["chart", "records"]), chart, records } };
}

export function dynamicFidelityIssue(intent: string, spec: DashboardSpec): string | null | undefined {
  const marker = spec.state?.erp as { purpose?: string; query?: DynamicErpPlan } | undefined;
  if (marker?.purpose !== "dynamic" || !marker.query) return undefined;
  const issue = validateDynamicErpPlan(marker.query, intent);
  if (issue) return issue;
  const expected = marker.query.view === "pie" ? "PieChartCard" : marker.query.view === "bar" ? "BarChartCard" : marker.query.view === "line" ? "LineChartCard" : marker.query.view === "summary" ? "MetricCard" : "DataTable";
  if (!Object.values(spec.elements).some((item) => item.type === expected)) return "La composición omitió la visualización solicitada.";
  if (!Object.values(spec.elements).some((item) => item.type === "DataTable")) return "Falta la tabla de respaldo con registros identificables.";
  return null;
}
