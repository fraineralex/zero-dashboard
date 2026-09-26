import { demoErpProvider, demoToday, type ErpCollection, type ErpReadProvider, type ErpRecord } from "@/lib/erp/demo";
import { erpFields } from "@/lib/erp/query";
import { normalizeErpQuestion } from "@/lib/erp/question-language";
import type { DashboardElement, DashboardSpec } from "@/types/analytics";

export type BusinessPlan = {
  source: ErpCollection;
  period: "today" | "yesterday" | "thisMonth" | "previousMonth" | "all";
  measures: { field: string; label: string }[];
  filters?: { field: string; op?: "eq" | "lt" | "lte" | "gt" | "gte"; value: string | number }[];
  groupBy?: string;
  comparePreviousMonth?: boolean;
  view: "summary" | "bar" | "pie" | "line" | "table";
  limit: number;
  title: string;
};

const dateFields: Partial<Record<ErpCollection, string>> = {
  purchaseOrders: "date", salesOrders: "date", salesLines: "date", vendorBills: "date", customerInvoices: "date",
  creditNotes: "date", posTickets: "date", expenseEntries: "date", journalEntries: "date", payrollRuns: "period", payrollTaxPayments: "period", attendance: "date",
};
const normal = normalizeErpQuestion;
const money = (value: number) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(value);
const number = (value: number) => new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 }).format(value);
const moneyFields = new Set(["amount", "appliedAmount", "remainingAmount", "subtotal", "gross", "net", "employerCost", "employerTaxes", "tssEmployer", "infotepEmployer", "debit", "credit"]);
const groupLabels: Record<string, string> = { customer: "cliente", supplier: "proveedor", product: "producto", category: "categoría", date: "día", period: "mes", paymentMethod: "método de pago", status: "estado", department: "departamento" };
const sourceLabels: Partial<Record<ErpCollection, string>> = { customerInvoices: "facturas emitidas", creditNotes: "notas de crédito", posTickets: "tickets POS", expenseEntries: "gastos registrados", salesOrders: "órdenes de venta", purchaseOrders: "órdenes de compra", salesLines: "líneas de venta", payroll: "empleados de la nómina", payrollRuns: "nóminas cerradas" };
const node = (type: string, props: Record<string, unknown>): DashboardElement => ({ type, props, children: [] });
const previousMonth = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 2, 1)).toISOString().slice(0, 7);
};
const yesterday = (today: string) => new Date(new Date(`${today}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
const periodValue = (period: BusinessPlan["period"], today: string) => period === "today" ? today : period === "yesterday" ? yesterday(today) : period === "previousMonth" ? previousMonth(today.slice(0, 7)) : today.slice(0, 7);
const periodLabel = (period: BusinessPlan["period"], today: string) => period === "today" ? `Hoy · ${today}` : period === "yesterday" ? `Ayer · ${yesterday(today)}` : period === "previousMonth" ? `Mes anterior · ${previousMonth(today.slice(0, 7))}` : period === "thisMonth" ? `Mes actual · ${today.slice(0, 7)}` : "Todos los registros disponibles";

/** Fast plans for common wording; the executor and renderer below are shared with generated plans. */
export function planBusinessQuestion(intent: string): BusinessPlan | null {
  const text = normal(intent);
  if (/pagadas?|pagaron/.test(text) && /\bhoy\b|\bayer\b/.test(text)) return null;
  if (/cuentas? por cobrar/.test(text) && /cuentas? por pagar/.test(text) && /vs|versus|compara|comparacion/.test(text)) return null;
  const requestedPeriod = /\bhoy\b/.test(text) ? "today" as const : /\bayer\b/.test(text) ? "yesterday" as const : /este mes|mes actual/.test(text) ? "thisMonth" as const : "all" as const;
  const explicitChart = /grafic|tarta|pastel|circular|\bpie\b|\bdonut\b/.test(text);
  const invoiceGrouping = /por clientes?/.test(text) ? "customer" as const : /por proveedores?/.test(text) ? "supplier" as const : /por (?:fecha|d[ií]a)/.test(text) ? "date" as const : undefined;
  const invoiceView = /tarta|pastel|circular|\bpie\b|\bdonut\b/.test(text) ? "pie" as const : /lineas?|tendencia|evolucion/.test(text) ? "line" as const : "bar" as const;
  if (/facturas?/.test(text) && explicitChart && invoiceView === "line" && invoiceGrouping !== "date") return null;
  if (/gastos?|egresos?/.test(text) && /categor[ií]a|tipo|concepto/.test(text)) return {
    source: "expenseEntries", period: /hoy/.test(text) ? "today" : /ayer/.test(text) ? "yesterday" : "thisMonth",
    measures: [{ field: "amount", label: "Gastos registrados" }], groupBy: "category", view: /tarta|pastel|circular/.test(text) ? "pie" : /tabla|lista/.test(text) ? "table" : "bar", limit: 20, title: "Gastos por categoría",
  };
  if (/tardanzas?|llegadas? tarde/.test(text) && /departamento|[aá]rea/.test(text)) return {
    source: "attendance", period: "all", measures: [{ field: "count", label: "Tardanzas" }], filters: [{ field: "status", value: "Tardanza" }], groupBy: "department", view: /tabla|lista/.test(text) ? "table" : "bar", limit: 20, title: "Tardanzas por departamento",
  };
  if (/nomina|salarios?|sueldos?/.test(text) && /departamentos?/.test(text) && !/crecim|variacion|aumento|disminucion/.test(text)) {
    const net = /net[oa]/.test(text);
    const share = /porcent|participacion|del total|distribucion|repart/.test(text);
    const view = /tarta|pastel|circular|\bpie\b|\bdonut\b|\bdona\b/.test(text) ? "pie" : /tabla|lista/.test(text) ? "table" : /barras?/.test(text) ? "bar" : share ? "pie" : "bar";
    return { source: "payroll", period: "all", measures: [{ field: net ? "net" : "gross", label: net ? "Nómina neta" : "Nómina bruta" }], groupBy: "department", view, limit: 20, title: `${share ? "Participación de la " : ""}${net ? "nómina neta" : "nómina bruta"} por departamento` };
  }
  if (/productos?|inventario|stock/.test(text) && /sin stock|agotad|sin existencias?/.test(text) && /por almac[eé]n/.test(text)) return {
    source: "stock", period: "all", measures: [{ field: "count", label: "Productos sin stock" }], filters: [{ field: "available", value: 0 }], groupBy: "warehouse", view: /tarta|pastel/.test(text) ? "pie" : /tabla|lista/.test(text) ? "table" : "bar", limit: 20, title: "Productos sin stock por almacén",
  };
  if (/facturas?|cuentas? por pagar/.test(text) && /proveedores?|compras?|por pagar/.test(text) && /vencid|atrasad|pendient|por pagar|pagadas?/.test(text) && !(explicitChart && !invoiceGrouping)) {
    const overdue = /vencid|atrasad/.test(text);
    const paid = /pagadas?/.test(text) && !/por pagar/.test(text);
    return { source: "vendorBills", period: requestedPeriod, measures: [{ field: "amount", label: paid ? "Facturas pagadas" : overdue ? "Importe vencido" : "Saldo por pagar" }], filters: [{ field: "status", value: paid ? "Pagada" : "Pendiente" }, ...(overdue ? [{ field: "due", op: "lt" as const, value: demoToday }] : [])], ...(invoiceGrouping ? { groupBy: invoiceGrouping } : {}), view: explicitChart ? invoiceView : "table", limit: 30, title: paid ? "Facturas de proveedores pagadas" : overdue ? "Facturas de proveedores vencidas" : "Cuentas por pagar" };
  }
  if (/facturas?.*pagadas?/.test(text) && !/proveedores?|compras?/.test(text) && !(explicitChart && !invoiceGrouping)) return {
    source: "customerInvoices", period: requestedPeriod, measures: [{ field: "amount", label: "Facturas pagadas" }], filters: [{ field: "status", value: "Pagada" }], ...(invoiceGrouping ? { groupBy: invoiceGrouping } : {}), view: explicitChart ? invoiceView : "table", limit: 30, title: "Facturas de clientes pagadas",
  };
  if (/facturas?|cuentas? por cobrar|clientes?/.test(text) && /vencid|atrasad|moros/.test(text) && !/proveedor|compras?|por pagar/.test(text) && !(explicitChart && !invoiceGrouping)) return {
    source: "customerInvoices", period: "all", measures: [{ field: "amount", label: "Importe vencido" }], filters: [{ field: "status", value: "Por cobrar" }, { field: "due", op: "lt", value: demoToday }], ...(invoiceGrouping ? { groupBy: invoiceGrouping } : {}), view: explicitChart ? invoiceView : "table", limit: 30, title: "Facturas de clientes vencidas",
  };
  if (/cuentas? por cobrar|facturas? pendientes? de clientes?|facturas? por cobrar/.test(text) && !/proveedor|compras?|por pagar|grafic|tarta|pastel|por cliente/.test(text)) return {
    source: "customerInvoices", period: "all", measures: [{ field: "amount", label: "Saldo por cobrar" }], filters: [{ field: "status", value: "Por cobrar" }], view: "table", limit: 30, title: "Cuentas por cobrar",
  };
  if (/clientes?|usuarios?/.test(text) && /factur/.test(text) && /este mes|mes actual/.test(text) && /mas|mayor|top/.test(text)) {
    const limit = Number(text.match(/\b(?:top|primeros?|las?|los?)?\s*(\d{1,2})\s+clientes?\b/)?.[1] ?? 10);
    return { source: "customerInvoices", period: "thisMonth", measures: [{ field: "amount", label: "Facturado" }], groupBy: "customer", view: /tarta|pastel|circular/.test(text) ? "pie" : /tabla|lista/.test(text) ? "table" : "bar", limit, title: `Clientes que más facturaron este mes` };
  }
  if (/punto de venta|\bpos\b|tickets? pos/.test(text) && /ayer/.test(text)) return {
    source: "posTickets", period: "yesterday", measures: [{ field: "amount", label: "Ventas cobradas" }], view: "table", limit: 30, title: "Tickets POS de ayer",
  };
  if (/punto de venta|\bpos\b|tickets? pos/.test(text) && /metodo de pago|forma de pago/.test(text) && /grafic|tarta|pastel|circular|por metodo|por forma/.test(text)) return {
    source: "posTickets", period: "thisMonth", measures: [{ field: "amount", label: "Ventas cobradas" }], groupBy: "paymentMethod",
    view: /tarta|pastel|circular/.test(text) ? "pie" : "bar", limit: 12, title: "Ventas POS por método de pago",
  };
  if (/punto de venta|\bpos\b|tickets? pos/.test(text) && /tickets?/.test(text) && /ultim|recient/.test(text)) {
    const limit = Number(text.match(/\b(\d{1,2})\s+(?:ultimos?\s+)?tickets?\b|\bultimos?\s+(\d{1,2})\s+tickets?\b/)?.[1] ?? text.match(/\bultimos?\s+(\d{1,2})\s+tickets?\b/)?.[1] ?? 10);
    return { source: "posTickets", period: "all", measures: [{ field: "amount", label: "Importe cobrado" }], view: "table", limit, title: `Últimos ${limit} tickets POS` };
  }
  if (/nomina|salarios?|sueldos?|payroll/.test(text) && /porcent|crecim|variacion|aumento|disminucion/.test(text) && /mes anterior|mes pasado|mes actual|este mes/.test(text)) return {
    source: "payrollRuns", period: "thisMonth", measures: [
      /\bnet[oa]\b/.test(text) ? { field: "net", label: "Nómina neta" } : /\bbrut[oa]\b/.test(text) ? { field: "gross", label: "Nómina bruta" } : { field: "employerCost", label: "Costo de nómina" },
    ], comparePreviousMonth: true,
    view: "summary", limit: 2, title: "Crecimiento mensual de nómina",
  };
  if (/notas? de credito/.test(text) && /este mes|mes actual/.test(text) && /monto|cuanto|consum|aplicad|utilizad|emitid/.test(text)) return {
    source: "creditNotes", period: "thisMonth", measures: [
      { field: "amount", label: "Notas de crédito emitidas" },
      { field: "appliedAmount", label: "Importe aplicado" },
      { field: "remainingAmount", label: "Saldo disponible" },
    ], view: "summary", limit: 30, title: "Notas de crédito del mes",
  };
  if (/clientes?|usuarios?/.test(text) && /factur/.test(text) && /hoy/.test(text) && /mas|mayor|top/.test(text)) {
    const limit = Number(text.match(/\b(?:top|primeros?|las?|los?)?\s*(\d{1,2})\s+clientes?\b/)?.[1] ?? 10);
    return { source: "customerInvoices", period: "today", measures: [{ field: "amount", label: "Facturado" }], groupBy: "customer", view: /tarta|pastel|circular/.test(text) ? "pie" : /tabla|lista/.test(text) ? "table" : "bar", limit, title: "Clientes que más facturaron hoy" };
  }
  return null;
}

export function validateBusinessPlan(plan: BusinessPlan): string | null {
  const fields = erpFields[plan.source];
  if (!fields || (plan.period !== "all" && !dateFields[plan.source])) return "El origen no tiene fechas consultables en esta muestra.";
  if (!plan.measures.length || plan.measures.length > 3 || plan.measures.some((measure) => ![...fields.measures, "count"].includes(measure.field) || measure.label.length < 2 || measure.label.length > 45)) return "La medida no pertenece al modelo solicitado.";
  if ((plan.filters?.length ?? 0) > 3 || plan.filters?.some((filter) => (!fields.dimensions.includes(filter.field) && !fields.measures.includes(filter.field)) || ![undefined, "eq", "lt", "lte", "gt", "gte"].includes(filter.op) || String(filter.value).length > 80 || (filter.op && filter.op !== "eq" && !["date", "due", "period", ...fields.measures].includes(filter.field)))) return "El filtro no pertenece al modelo solicitado.";
  if (plan.groupBy && !fields.dimensions.includes(plan.groupBy)) return "La agrupación no pertenece al modelo solicitado.";
  if (plan.comparePreviousMonth && (plan.period !== "thisMonth" || plan.groupBy || plan.measures.length !== 1)) return "La comparación requiere una medida mensual sin agrupación.";
  if ((plan.view === "pie" || plan.view === "bar" || plan.view === "line") && !plan.groupBy) return "El gráfico requiere una agrupación.";
  if (plan.view === "pie" && plan.measures.length !== 1) return "La tarta requiere una sola medida.";
  if (plan.groupBy && plan.measures.length !== 1) return "Esta vista agrupada requiere una medida para evitar omitir resultados.";
  if (plan.view === "line" && !["date", "period"].includes(plan.groupBy ?? "")) return "Una línea requiere fechas o meses en el eje horizontal.";
  if (!Number.isInteger(plan.limit) || plan.limit < 1 || plan.limit > 30 || plan.title.length < 3 || plan.title.length > 80) return "El límite o título no es válido.";
  return null;
}

export function executeBusinessPlan(plan: BusinessPlan, provider: ErpReadProvider = demoErpProvider, today = demoToday) {
  const issue = validateBusinessPlan(plan);
  if (issue) throw new Error(issue);
  const field = dateFields[plan.source];
  const target = periodValue(plan.period, today);
  const matchesFilters = (row: ErpRecord) => (plan.filters ?? []).every((filter) => {
    const value = row[filter.field];
    if (filter.op === "lt") return value < filter.value;
    if (filter.op === "lte") return value <= filter.value;
    if (filter.op === "gt") return value > filter.value;
    if (filter.op === "gte") return value >= filter.value;
    return value === filter.value;
  });
  const rows = provider.list(plan.source).filter((row) => (plan.period === "all" || String(row[field!] ?? "").startsWith(target)) && matchesFilters(row));
  const amount = (row: ErpRecord, measure: { field: string }) => measure.field === "count" ? 1 : Number(row[measure.field] ?? 0);
  const totals = Object.fromEntries(plan.measures.map((measure) => [measure.field, rows.reduce((sum, row) => sum + amount(row, measure), 0)]));
  const previous = plan.comparePreviousMonth ? provider.list(plan.source).filter((row) => String(row[field!] ?? "").startsWith(previousMonth(today.slice(0, 7))) && matchesFilters(row)) : [];
  const previousTotal = plan.comparePreviousMonth ? previous.reduce((sum, row) => sum + amount(row, plan.measures[0]), 0) : null;
  const groups = new Map<string, ErpRecord>();
  if (plan.groupBy) for (const row of rows) {
    const key = String(row[plan.groupBy] ?? "");
    const group = groups.get(key) ?? { [plan.groupBy]: key };
    for (const measure of plan.measures) group[measure.field] = Number(group[measure.field] ?? 0) + amount(row, measure);
    groups.set(key, group);
  }
  const grouped = [...groups.values()].sort((a, b) => plan.view === "line" ? String(a[plan.groupBy!]).localeCompare(String(b[plan.groupBy!])) : Number(b[plan.measures[0].field]) - Number(a[plan.measures[0].field]));
  return { rows, totals, previous, previousTotal, grouped };
}

export function buildBusinessSpec(plan: BusinessPlan, provider: ErpReadProvider = demoErpProvider, today = demoToday): DashboardSpec {
  const result = executeBusinessPlan(plan, provider, today);
  const monetary = plan.measures.every((measure) => moneyFields.has(measure.field));
  const format = monetary ? "dop" : "number";
  const display = monetary ? money : number;
  const scope = plan.source === "payroll" ? `${result.rows.length} empleados de muestra · sin período asignado · ${monetary ? "RD$" : "unidades"} · datos simulados` : `${periodLabel(plan.period, today)} · ${monetary ? "RD$" : "unidades"} · datos simulados`;
  const elements: Record<string, DashboardElement> = {};
  const children: string[] = [];
  const add = (id: string, type: string, props: Record<string, unknown>) => { elements[id] = node(type, props); children.push(id); };
  if (plan.comparePreviousMonth) {
    const current = Number(result.totals[plan.measures[0].field]);
    const previous = Number(result.previousTotal);
    if (!result.rows.length || !result.previous.length || !previous) return emptySpec(plan, "No hay dos meses con nóminas cerradas o el mes anterior es cero; no se puede calcular un porcentaje fiable.", scope);
    const growth = (current - previous) / previous * 100;
    const currentMonth = today.slice(0, 7);
    const priorMonth = previousMonth(currentMonth);
    const evidence = [{ id: priorMonth, period: priorMonth, amount: previous }, { id: currentMonth, period: currentMonth, amount: current }];
    add("growth", "MetricCard", { label: `Variación de ${plan.measures[0].label.toLowerCase()}`, value: `${growth >= 0 ? "+" : ""}${growth.toFixed(2)}%`, tone: growth >= 0 ? "positive" : "negative", helper: `(${money(current)} − ${money(previous)}) ÷ ${money(previous)}` });
    add("current", "MetricCard", { label: `Mes actual · ${currentMonth}`, value: money(current), tone: "neutral", helper: plan.measures[0].field === "employerCost" ? "Bruto + aportes patronales" : plan.measures[0].label });
    add("previous", "MetricCard", { label: `Mes anterior · ${priorMonth}`, value: money(previous), tone: "neutral", helper: "Misma definición de nómina" });
    add("evidence", "DataTable", { title: "Base de la comparación", description: "Dos nóminas mensuales cerradas · misma medida y moneda", data: evidence, columns: [{ key: "period", label: "Mes" }, { key: "amount", label: plan.measures[0].label, format: "dop" }], currency: "DOP", span: "wide" });
  } else if (!result.rows.length) return emptySpec(plan, `No hay registros de ${plan.source} para ${periodLabel(plan.period, today).toLowerCase()}. No se sustituyó por datos de otro período.`, scope);
  else if (plan.groupBy) {
    const selected: ErpRecord[] = result.grouped.slice(0, plan.limit).map((row, index) => ({ id: String(row[plan.groupBy!] ?? index), rank: index + 1, ...row }));
    const measure = plan.measures[0];
    const selectedTotal = selected.reduce((sum, row) => sum + Number(row[measure.field] ?? 0), 0);
    if (plan.view === "pie") for (const row of selected) row.share = selectedTotal ? Number(row[measure.field] ?? 0) / selectedTotal * 100 : 0;
    const chartData = selected.map((row) => ({ name: String(row[plan.groupBy!] ?? ""), value: Number(row[measure.field] ?? 0) }));
    const groupLabel = groupLabels[plan.groupBy] ?? plan.groupBy;
    if (plan.view !== "table") add("chart", plan.view === "pie" ? "PieChartCard" : plan.view === "line" ? "LineChartCard" : "BarChartCard", plan.view === "pie"
      ? { title: `${measure.label} por ${groupLabel}`, description: `Cada porción muestra su porcentaje del total · ${plan.source === "payroll" ? "bruto o neto según la medida · " : ""}datos simulados`, data: chartData, nameKey: "name", valueKey: "value", format, unitLabel: `Total de ${measure.label.toLowerCase()}`, span: "wide" }
      : { title: `${measure.label} por ${groupLabel}`, description: plan.view === "line" ? "Evolución cronológica de los importes" : "Mayor importe primero · los nombres completos figuran en la tabla", data: chartData, xKey: "name", series: [{ key: "value", label: measure.label, format }], format, ...(plan.view === "bar" ? { horizontal: true } : {}), span: "wide" });
    add("records", "DataTable", { title: `Detalle por ${groupLabel}`, description: `${selected.length} grupos · ${sourceLabels[plan.source] ?? "registros ERP"} · datos simulados`, data: selected, columns: [{ key: "rank", label: "#" }, { key: plan.groupBy, label: groupLabel[0].toUpperCase() + groupLabel.slice(1) }, { key: measure.field, label: measure.label, ...(monetary ? { format: "dop" } : {}) }, ...(plan.view === "pie" ? [{ key: "share", label: "% del total", format: "percent" }] : [])], ...(monetary ? { currency: "DOP", total: selectedTotal } : {}), span: "wide" });
  } else {
    const rows = [...result.rows].sort((a, b) => String(b.date ?? b.period).localeCompare(String(a.date ?? a.period))).slice(0, plan.limit);
    for (const [index, measure] of plan.measures.entries()) {
      const value = plan.view === "table" ? rows.reduce((sum, row) => sum + Number(row[measure.field] ?? 0), 0) : Number(result.totals[measure.field]);
      add(`metric${index}`, "MetricCard", { label: measure.label, value: display(value), tone: "neutral", helper: plan.view === "table" ? `${rows.length} registros visibles` : `${result.rows.length} registros del período` });
    }
    const preferred = plan.source === "creditNotes" ? ["id", "date", "customer", "invoiceId", "amount", "appliedAmount", "remainingAmount", "status"] : Object.keys(rows[0]).slice(0, 8);
    const labels: Record<string, string> = { id: plan.source === "posTickets" ? "Ticket" : "Nota", date: "Fecha", customer: "Cliente", invoiceId: "Factura", register: "Caja", paymentMethod: "Medio de pago", items: "Ítems", amount: plan.source === "posTickets" ? "Cobrado" : "Emitido", appliedAmount: "Consumido", remainingAmount: "Disponible", status: "Estado" };
    add("records", "DataTable", { title: plan.source === "creditNotes" ? "Notas emitidas y consumo individual" : "Registros que respaldan el total", description: plan.source === "creditNotes" ? `${rows.length} notas · aplicado + disponible = importe emitido` : `${rows.length} registros · ${sourceLabels[plan.source] ?? "ERP"}`, data: rows, columns: preferred.map((key) => ({ key, label: labels[key] ?? key, ...(["amount", "appliedAmount", "remainingAmount"].includes(key) ? { format: "dop" } : {}) })), currency: "DOP", span: "wide" });
  }
  elements.root = { type: plan.groupBy ? "TableFocus" : "AnalysisGrid", props: { title: plan.title, subtitle: scope, periodLabel: periodLabel(plan.period, today) }, children };
  return { root: "root", state: { business: { plan, today, source: "demo" } }, elements };
}

function emptySpec(plan: BusinessPlan, reason: string, scope: string): DashboardSpec {
  return { root: "root", state: { business: { plan, source: "demo", empty: true } }, elements: {
    root: { type: "AnalysisGrid", props: { title: plan.title, subtitle: scope }, children: ["empty"] },
    empty: node("FindingCard", { label: "Sin datos del período", title: "No hay una cifra verificable", body: reason, value: "—", valueLabel: "Sin resultado" }),
  } };
}

export function businessFidelityIssue(intent: string, spec: DashboardSpec): string | null | undefined {
  const plan = planBusinessQuestion(intent);
  const marker = spec.state?.business as { plan?: BusinessPlan; today?: string } | undefined;
  if (!plan && !marker?.plan) return undefined;
  const requested = normal(intent);
  const selected = plan ?? marker?.plan;
  if (selected && (/tarta|pastel|circular|\bpie\b|\bdonut\b/.test(requested) && selected.view !== "pie" || /grafic[oa].*barras?|barras?.*grafic[oa]/.test(requested) && selected.view !== "bar" || /grafic[oa].*lineas?|lineas?.*grafic[oa]/.test(requested) && selected.view !== "line")) return "La visualización no coincide con el gráfico solicitado.";
  if (!plan && marker?.plan) {
    const issue = validateBusinessPlan(marker.plan);
    if (issue) return issue;
    const expected = buildBusinessSpec(marker.plan, demoErpProvider, marker.today ?? demoToday);
    return JSON.stringify(spec.elements) === JSON.stringify(expected.elements) ? null : "Las cifras o la visualización no coinciden con los registros consultados.";
  }
  if (!marker?.plan || JSON.stringify(marker.plan) !== JSON.stringify(plan)) return "La respuesta no conserva la consulta de negocio solicitada.";
  const expected = buildBusinessSpec(plan!, demoErpProvider, marker.today ?? demoToday);
  if (JSON.stringify(spec.elements) !== JSON.stringify(expected.elements)) return "Las cifras, filtros o visualizaciones no coinciden con los registros del período.";
  return null;
}
