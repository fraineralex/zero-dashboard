import { demoErpProvider, demoToday, type ErpCollection, type ErpReadProvider, type ErpRecord } from "@/lib/erp/demo";
import { erpFields } from "@/lib/erp/query";
import { normalizeErpQuestion } from "@/lib/erp/question-language";
import { discoverBusinessSources } from "@/lib/erp/source-discovery";
import type { DashboardElement, DashboardSpec } from "@/types/analytics";

export type BusinessPlan = {
  source: ErpCollection;
  period: "today" | "yesterday" | "thisMonth" | "previousMonth" | "all";
  dateRange?: { from: string; to: string };
  timeRange?: { from: string; to: string };
  measures: { field: string; label: string; aggregation?: "sum" | "average" | "min" | "max" | "distinctCount" }[];
  filters?: { field: string; op?: "eq" | "lt" | "lte" | "gt" | "gte"; value: string | number }[];
  groupBy?: string;
  comparePreviousMonth?: boolean;
  view: "summary" | "bar" | "pie" | "line" | "table";
  limit: number;
  title: string;
};

const dateFields: Partial<Record<ErpCollection, string>> = {
  purchaseOrders: "date", salesOrders: "date", salesLines: "date", vendorBills: "date", customerInvoices: "date",
  creditNotes: "date", posTickets: "date", expenseEntries: "date", journalEntries: "date", payrollRuns: "period", payrollTaxPayments: "date", attendance: "date",
};
const normal = normalizeErpQuestion;
const money = (value: number) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(value);
const number = (value: number) => new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 }).format(value);
const moneyFields = new Set(["amount", "appliedAmount", "remainingAmount", "subtotal", "gross", "net", "employerCost", "employerTaxes", "tssEmployer", "infotepEmployer", "debit", "credit"]);
const groupLabels: Record<string, string> = { customer: "cliente", supplier: "proveedor", product: "producto", category: "categoría", date: "día", period: "mes", paymentMethod: "método de pago", status: "estado", department: "departamento", cashier: "cajera" };
const sourceLabels: Partial<Record<ErpCollection, string>> = { customerInvoices: "facturas emitidas", creditNotes: "notas de crédito", posTickets: "tickets POS", expenseEntries: "gastos registrados", salesOrders: "órdenes de venta", purchaseOrders: "órdenes de compra", salesLines: "líneas de venta", payroll: "empleados de la nómina", payrollRuns: "nóminas cerradas", attendance: "marcaciones de asistencia", stock: "productos en inventario" };
const node = (type: string, props: Record<string, unknown>): DashboardElement => ({ type, props, children: [] });
const previousMonth = (month: string) => {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 2, 1)).toISOString().slice(0, 7);
};
const yesterday = (today: string) => new Date(new Date(`${today}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
const periodValue = (period: BusinessPlan["period"], today: string) => period === "today" ? today : period === "yesterday" ? yesterday(today) : period === "previousMonth" ? previousMonth(today.slice(0, 7)) : today.slice(0, 7);
const periodLabel = (period: BusinessPlan["period"], today: string) => period === "today" ? `Hoy · ${today}` : period === "yesterday" ? `Ayer · ${yesterday(today)}` : period === "previousMonth" ? `Mes anterior · ${previousMonth(today.slice(0, 7))}` : period === "thisMonth" ? `Mes actual · ${today.slice(0, 7)}` : "Todos los registros disponibles";
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const minusDays = (today: string, days: number) => isoDay(new Date(new Date(`${today}T12:00:00Z`).getTime() - days * 86_400_000));

export function requestedDateRange(intent: string, today = demoToday): BusinessPlan["dateRange"] | undefined {
  const text = normal(intent);
  const dates = [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((match) => match[1]);
  if (dates.length === 2 && dates[0] <= dates[1]) return { from: dates[0], to: dates[1] };
  if (dates.length === 1) return { from: dates[0], to: dates[0] };
  const months: Record<string, number> = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  const monthNames = Object.keys(months).join("|");
  const daySpan = text.match(new RegExp(`\\bdel\\s+(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+de\\s+(${monthNames})\\s+(?:de\\s+)?(20\\d{2})\\b`));
  if (daySpan) {
    const [, start, end, monthName, year] = daySpan;
    const month = months[monthName];
    const last = new Date(Date.UTC(Number(year), month, 0)).getUTCDate();
    if (Number(start) >= 1 && Number(end) <= last && Number(start) <= Number(end)) return { from: `${year}-${String(month).padStart(2, "0")}-${String(start).padStart(2, "0")}`, to: `${year}-${String(month).padStart(2, "0")}-${String(end).padStart(2, "0")}` };
  }
  const namedMonth = text.match(new RegExp(`\\b(${monthNames})\\s+(?:de\\s+)?(20\\d{2})\\b`));
  if (namedMonth) {
    const month = months[namedMonth[1]];
    const last = new Date(Date.UTC(Number(namedMonth[2]), month, 0)).getUTCDate();
    return { from: `${namedMonth[2]}-${String(month).padStart(2, "0")}-01`, to: `${namedMonth[2]}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
  }
  const latestDays = text.match(/\bultimos?\s+(\d{1,3})\s+dias?\b/);
  if (latestDays) {
    const days = Number(latestDays[1]);
    if (days < 1 || days > 366) return undefined;
    return { from: minusDays(today, days - 1), to: today };
  }
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const currentMonday = minusDays(today, (weekday + 6) % 7);
  if (/\besta semana\b/.test(text)) return { from: currentMonday, to: today };
  if (/\bsemana pasada\b/.test(text)) return { from: minusDays(currentMonday, 7), to: minusDays(currentMonday, 1) };
  if (/\b(?:este ano|ano actual)\b/.test(text)) return { from: `${today.slice(0, 4)}-01-01`, to: today };
  if (/\b(?:este trimestre|trimestre actual)\b/.test(text)) {
    const month = Number(today.slice(5, 7));
    return { from: `${today.slice(0, 4)}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, "0")}-01`, to: today };
  }
  return undefined;
}

export function requestedTimeRange(intent: string, now = new Date()): BusinessPlan["timeRange"] | undefined {
  const text = normal(intent);
  const match = text.match(/\bultimas?\s+(\d{1,2})?\s*horas?\b/);
  if (!match) return undefined;
  const hours = Number(match[1] ?? 1);
  if (hours < 1 || hours > 24) return undefined;
  const end = Math.floor(now.getTime() / 60_000) * 60_000;
  return { from: new Date(end - hours * 3_600_000).toISOString(), to: new Date(end).toISOString() };
}

/** Fast plans for common wording; the executor and renderer below are shared with generated plans. */
export function planBusinessQuestion(intent: string): BusinessPlan | null {
  const text = normal(intent);
  const timeRange = requestedTimeRange(intent);
  if (timeRange && /ventas?|cobros?|tickets?|punto de venta|\bpos\b/.test(text)) return {
    source: "posTickets", period: "all", timeRange, measures: [{ field: "amount", label: "Ventas POS cobradas" }],
    view: "summary", limit: 30, title: "Ventas cobradas en la última hora",
  };
  if (/cajer[oa]s?/.test(text) && /factur|vend|ventas?|cobr|ingres/.test(text)) return {
    source: "posTickets", period: "all", measures: [{ field: "amount", label: "Cobrado en POS" }], groupBy: "cashier",
    view: /tarta|pastel|circular|\bpie\b|\bdonut\b/.test(text) ? "pie" : /tabla|lista/.test(text) ? "table" : "bar",
    limit: 20, title: "Cobros de punto de venta por cajera",
  };
  if (/\b(?:promedio|media|average|unicos?|distintos?|diferentes?|unique)\b/.test(text) || requestedDateRange(intent)) return planCompositionalQuestion(intent);
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
  if (/nomina|salarios?|sueldos?/.test(text) && /departamentos?/.test(text) && !/crecim|variacion|aumento|disminucion|este mes|mes actual|\bhoy\b|\bayer\b/.test(text)) {
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
  if (/punto de venta|\bpos\b|tickets? pos/.test(text) && /\b(?:ultimos?\s+\d{1,2}\s+tickets?|\d{1,2}\s+ultimos?\s+tickets?|tickets?\s+(?:pos\s+)?(?:mas\s+)?recientes?)\b/.test(text) && !/promedio|media|ultimos?\s+\d+\s+dias?/.test(text)) {
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

/** A small typed visual grammar, composed from source + measure + time + aggregation + view. */
function planCompositionalQuestion(intent: string): BusinessPlan | null {
  const text = normal(intent);
  const sources = discoverBusinessSources(intent);
  if (sources.length !== 1) return null;
  const source = sources[0];
  const range = requestedDateRange(intent);
  const period: BusinessPlan["period"] = range ? "all" : /\bhoy\b/.test(text) ? "today" : /\bayer\b/.test(text) ? "yesterday" : /este mes|mes actual/.test(text) ? "thisMonth" : /mes anterior|mes pasado/.test(text) ? "previousMonth" : "all";
  if ((period !== "all" || range) && (!dateFields[source] || range && dateFields[source] === "period")) return null;
  const fields = erpFields[source];
  const groupedDimension = /(?:\bpor|\bcada|\bentre)\s+(?:los?\s+|las?\s+)?(?:departamentos?|areas?)\b/.test(text) ? "department"
    : /(?:\bpor|\bcada|\bentre)\s+(?:los?\s+|las?\s+)?(?:productos?|articulos?)\b/.test(text) ? "product"
    : /(?:\bpor|\bcada|\bentre)\s+(?:los?\s+|las?\s+)?(?:clientes?|usuarios?)\b/.test(text) ? "customer"
    : /(?:\bpor|\bcada|\bentre)\s+(?:los?\s+|las?\s+)?(?:proveedores?|suplidores?)\b/.test(text) ? "supplier"
    : /(?:\bpor|\bcada|\bentre)\s+(?:los?\s+|las?\s+)?(?:categorias?|rubros?)\b/.test(text) ? "category"
    : /(?:\bpor|\bcada)\s+(?:los?\s+|las?\s+)?(?:almacenes?|bodegas?)\b/.test(text) ? "warehouse"
    : /(?:\bpor|\bcada)\s+(?:los?\s+|las?\s+)?(?:estados?|estatus)\b/.test(text) ? "status"
    : /(?:\bpor|\bcada)\s+(?:los?\s+|las?\s+)?(?:dias?|fechas?)\b/.test(text) ? "date"
    : /(?:\bpor|\bcada)\s+(?:los?\s+|las?\s+)?(?:meses?)\b/.test(text) ? "period"
    : /(?:\bpor|\bcada)\s+(?:los?\s+|las?\s+)?(?:cajas?)\b/.test(text) ? "register"
    : /(?:\bpor|\bcada)\s+(?:los?\s+|las?\s+)?(?:metodos?|formas?)\s+de\s+pago\b/.test(text) ? "paymentMethod" : undefined;
  const groupBy = groupedDimension && fields.dimensions.includes(groupedDimension) ? groupedDimension : undefined;
  if (groupedDimension && !groupBy) return null;
  const wantsPie = /\b(?:tarta|pastel|pie|donut|dona)\b|grafico circular/.test(text);
  const wantsLine = /\b(?:lineas?|tendencia|evolucion)\b/.test(text);
  const wantsBar = /\bbarras?\b/.test(text);
  if ((wantsPie || wantsLine || wantsBar) && !groupBy) return null;
  const wantsRecords = /\b(?:lista|listado|tabla|registros?|recientes?|nombres?|detalles?)\b/.test(text) || /\bultimos?\s+\d{1,2}\s+(?:tickets?|facturas?|productos?|clientes?|proveedores?|ordenes?)\b/.test(text);
  const view: BusinessPlan["view"] = wantsPie ? "pie" : wantsLine ? "line" : wantsBar ? "bar" : groupBy ? "bar" : wantsRecords ? "table" : "summary";
  if (wantsLine && !["date", "period"].includes(groupBy ?? "")) return null;
  const aggregation: BusinessPlan["measures"][number]["aggregation"] = /\b(?:promedio|media|average)\b/.test(text) ? "average" : /\b(?:unicos?|distintos?|diferentes?|unique)\b/.test(text) ? "distinctCount" : "sum";
  const measureBySource: Partial<Record<ErpCollection, string>> = {
    posTickets: /\b(?:cuantos?|numero|cantidad)\s+(?:de\s+)?tickets?\b/.test(text) ? "count" : "amount",
    expenseEntries: "amount", creditNotes: /consumid|aplicad|utilizad/.test(text) ? "appliedAmount" : /disponible|restante|remanente/.test(text) ? "remainingAmount" : "amount",
    payroll: /\bnet[oa]\b/.test(text) ? "net" : "gross", attendance: "count",
    stock: /\bcosto\b/.test(text) ? "unitCost" : /cuantos?|cantidad|sin stock|agotad/.test(text) ? "count" : "available",
    salesLines: /unidades?|cantidad|volumen/.test(text) ? "quantity" : "subtotal",
    journalEntries: /credito|haber/.test(text) ? "credit" : "debit",
    customerInvoices: "amount", vendorBills: "amount", purchaseOrders: "amount", salesOrders: "amount",
  };
  const distinctField = aggregation === "distinctCount" ? /emplead|persona|trabajador/.test(text) && fields.dimensions.includes("employee") ? "employee" : /clientes?|usuarios?/.test(text) && fields.dimensions.includes("customer") ? "customer" : /productos?|articulos?/.test(text) && fields.dimensions.includes("product") ? "product" : /proveedores?|suplidores?/.test(text) && fields.dimensions.includes("supplier") ? "supplier" : undefined : undefined;
  const measureField = distinctField ?? measureBySource[source];
  if (!measureField || aggregation === "distinctCount" && !distinctField) return null;
  if (wantsPie && aggregation !== "sum") return null;
  const filters: BusinessPlan["filters"] = [];
  if (source === "stock" && /sin stock|agotad|sin existencias?/.test(text)) filters.push({ field: "available", value: 0 });
  if (source === "attendance" && /tardanz|tarde/.test(text)) filters.push({ field: "status", value: "Tardanza" });
  if (source === "creditNotes" && /aplicadas?|consumidas?/.test(text) && !/cuanto|monto|total/.test(text)) filters.push({ field: "status", value: "Aplicada" });
  const count = text.match(/\b(?:top|ultimos?|primeros?)\s+(\d{1,2})\s+(?:clientes?|tickets?|facturas?|registros?|productos?|proveedores?|ordenes?)\b/);
  const limit = count ? Number(count[1]) : 30;
  const label = aggregation === "distinctCount" ? measureField === "employee" ? "Empleados distintos" : measureField === "customer" ? "Clientes distintos" : measureField === "product" ? "Productos distintos" : "Entidades distintas" : aggregation === "average" ? source === "posTickets" && measureField === "amount" ? "Ticket promedio" : `Promedio de ${measureField === "amount" ? "importe" : measureField}` : measureField === "count" ? "Cantidad" : measureField === "gross" ? "Nómina bruta" : measureField === "net" ? "Nómina neta" : measureField === "amount" ? "Importe" : measureField;
  const title = source === "posTickets" ? aggregation === "average" ? "Ticket promedio de punto de venta" : "Punto de venta" : source === "attendance" ? "Asistencia" : source === "stock" ? "Inventario" : source === "expenseEntries" ? "Gastos" : source === "payroll" ? "Nómina" : source === "creditNotes" ? "Notas de crédito" : source === "salesLines" ? "Ventas por producto" : source === "customerInvoices" ? "Facturación de clientes" : source === "vendorBills" ? "Facturas de proveedores" : source === "purchaseOrders" ? "Órdenes de compra" : source === "salesOrders" ? "Órdenes de venta" : "Libro diario";
  const plan: BusinessPlan = { source, period, ...(range ? { dateRange: range } : {}), measures: [{ field: measureField, label, aggregation }], filters, ...(groupBy ? { groupBy } : {}), view, limit, title };
  return validateBusinessPlan(plan) ? null : plan;
}

export function validateBusinessPlan(plan: BusinessPlan): string | null {
  const fields = erpFields[plan.source];
  if (!fields || (plan.period !== "all" && !dateFields[plan.source])) return "El origen no tiene fechas consultables en esta muestra.";
  if (plan.dateRange && (!dateFields[plan.source] || dateFields[plan.source] === "period" || plan.period !== "all" || !/^\d{4}-\d{2}-\d{2}$/.test(plan.dateRange.from) || !/^\d{4}-\d{2}-\d{2}$/.test(plan.dateRange.to) || plan.dateRange.from > plan.dateRange.to)) return "El rango de fechas no es válido para este modelo.";
  if (plan.timeRange && (plan.source !== "posTickets" || plan.period !== "all" || plan.dateRange || !Number.isFinite(Date.parse(plan.timeRange.from)) || !Number.isFinite(Date.parse(plan.timeRange.to)) || plan.timeRange.from > plan.timeRange.to)) return "El intervalo horario requiere tickets POS con hora exacta.";
  if (!plan.measures.length || plan.measures.length > 3 || plan.measures.some((measure) => ![...fields.measures, ...fields.dimensions, "count"].includes(measure.field) || measure.label.length < 2 || measure.label.length > 45 || (measure.aggregation && !["sum", "average", "min", "max", "distinctCount"].includes(measure.aggregation)) || (measure.field === "count" && measure.aggregation && measure.aggregation !== "sum") || (fields.dimensions.includes(measure.field) && measure.aggregation !== "distinctCount"))) return "La medida no pertenece al modelo solicitado.";
  if ((plan.filters?.length ?? 0) > 3 || plan.filters?.some((filter) => (!fields.dimensions.includes(filter.field) && !fields.measures.includes(filter.field)) || ![undefined, "eq", "lt", "lte", "gt", "gte"].includes(filter.op) || String(filter.value).length > 80 || (filter.op && filter.op !== "eq" && !["date", "due", "period", ...fields.measures].includes(filter.field)))) return "El filtro no pertenece al modelo solicitado.";
  if (plan.groupBy && !fields.dimensions.includes(plan.groupBy)) return "La agrupación no pertenece al modelo solicitado.";
  if (plan.comparePreviousMonth && (plan.period !== "thisMonth" || plan.groupBy || plan.measures.length !== 1)) return "La comparación requiere una medida mensual sin agrupación.";
  if ((plan.view === "pie" || plan.view === "bar" || plan.view === "line") && !plan.groupBy) return "El gráfico requiere una agrupación.";
  if (plan.view === "pie" && plan.measures.length !== 1) return "La tarta requiere una sola medida.";
  if (plan.view === "pie" && plan.measures[0].aggregation && !["sum", "distinctCount"].includes(plan.measures[0].aggregation)) return "Una tarta debe mostrar partes de un total aditivo.";
  if (new Set(plan.measures.map((measure) => measure.field)).size !== plan.measures.length) return "Cada serie necesita una medida distinta.";
  if (plan.groupBy && ["bar", "line"].includes(plan.view) && plan.measures.some((measure) => moneyFields.has(measure.field) !== moneyFields.has(plan.measures[0].field))) return "Un solo eje no puede mezclar importes y conteos.";
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
  const inPeriod = (row: ErpRecord) => plan.timeRange ? String(row.soldAt ?? "") >= plan.timeRange.from && String(row.soldAt ?? "") <= plan.timeRange.to : plan.dateRange ? String(row[field!] ?? "") >= plan.dateRange.from && String(row[field!] ?? "") <= plan.dateRange.to : plan.period === "all" || String(row[field!] ?? "").startsWith(target);
  const rows = provider.list(plan.source).filter((row) => inPeriod(row) && matchesFilters(row));
  const aggregate = (records: readonly ErpRecord[], measure: BusinessPlan["measures"][number]) => {
    if (measure.field === "count") return records.length;
    if (measure.aggregation === "distinctCount") return new Set(records.map((row) => String(row[measure.field] ?? ""))).size;
    const values = records.map((row) => Number(row[measure.field] ?? 0));
    if (!values.length) return 0;
    if (measure.aggregation === "average") return values.reduce((sum, value) => sum + value, 0) / values.length;
    if (measure.aggregation === "min") return Math.min(...values);
    if (measure.aggregation === "max") return Math.max(...values);
    return values.reduce((sum, value) => sum + value, 0);
  };
  const totals = Object.fromEntries(plan.measures.map((measure) => [measure.field, aggregate(rows, measure)]));
  const previous = plan.comparePreviousMonth ? provider.list(plan.source).filter((row) => String(row[field!] ?? "").startsWith(previousMonth(today.slice(0, 7))) && matchesFilters(row)) : [];
  const previousTotal = plan.comparePreviousMonth ? aggregate(previous, plan.measures[0]) : null;
  const groups = new Map<string, ErpRecord[]>();
  if (plan.groupBy) for (const row of rows) {
    const key = String(row[plan.groupBy] ?? "");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const grouped = [...groups.entries()].map(([key, records]) => ({ [plan.groupBy!]: key, ...Object.fromEntries(plan.measures.map((measure) => [measure.field, aggregate(records, measure)])) })).sort((a, b) => plan.view === "line" ? String(a[plan.groupBy!]).localeCompare(String(b[plan.groupBy!])) : Number(b[plan.measures[0].field]) - Number(a[plan.measures[0].field]));
  return { rows, totals, previous, previousTotal, grouped };
}

export function buildBusinessSpec(plan: BusinessPlan, provider: ErpReadProvider = demoErpProvider, today = demoToday): DashboardSpec {
  const result = executeBusinessPlan(plan, provider, today);
  const monetary = plan.measures.every((measure) => moneyFields.has(measure.field) && measure.aggregation !== "distinctCount");
  const format = monetary ? "dop" : "number";
  const display = monetary ? money : number;
  const scope = plan.source === "payroll" ? `${result.rows.length} empleados de muestra · sin período asignado · ${monetary ? "RD$" : "unidades"} · datos simulados` : `${plan.timeRange ? `Última hora · ${plan.timeRange.from.slice(11, 16)}–${plan.timeRange.to.slice(11, 16)} UTC` : plan.dateRange ? `${plan.dateRange.from} – ${plan.dateRange.to}` : periodLabel(plan.period, today)} · ${monetary ? "RD$" : "unidades"} · datos simulados`;
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
    if (plan.view === "pie" || plan.groupBy === "cashier") for (const row of selected) row.share = selectedTotal ? Number(row[measure.field] ?? 0) / selectedTotal * 100 : 0;
    const chartData = selected.map((row) => ({ name: String(row[plan.groupBy!] ?? ""), ...Object.fromEntries(plan.measures.map((series) => [series.field, Number(row[series.field] ?? 0)])), value: Number(row[measure.field] ?? 0) }));
    const groupLabel = groupLabels[plan.groupBy] ?? plan.groupBy;
    if (plan.view !== "table") add("chart", plan.view === "pie" ? "PieChartCard" : plan.view === "line" ? "LineChartCard" : "BarChartCard", plan.view === "pie"
      ? { title: `${measure.label} por ${groupLabel}`, description: `Cada porción muestra su porcentaje del total · ${plan.source === "payroll" ? "bruto o neto según la medida · " : ""}datos simulados`, data: chartData, nameKey: "name", valueKey: "value", format, unitLabel: `Total de ${measure.label.toLowerCase()}`, span: "wide" }
      : { title: `${plan.measures.map((series) => series.label).join(" vs ")} por ${groupLabel}`, description: plan.view === "line" ? "Evolución cronológica de las medidas" : "Mayor valor de la primera medida primero · detalle exacto en la tabla", data: chartData, xKey: "name", series: plan.measures.map((series) => ({ key: series.field, label: series.label, format: moneyFields.has(series.field) && series.aggregation !== "distinctCount" ? "dop" : "number" })), format, ...(plan.view === "bar" ? { horizontal: true } : {}), span: "wide" });
    add("records", "DataTable", { title: `Detalle por ${groupLabel}`, description: `${selected.length} grupos · ${sourceLabels[plan.source] ?? "registros ERP"} · datos simulados`, data: selected, columns: [{ key: "rank", label: "#" }, { key: plan.groupBy, label: groupLabel[0].toUpperCase() + groupLabel.slice(1) }, ...plan.measures.map((series) => ({ key: series.field, label: series.label, ...(moneyFields.has(series.field) && series.aggregation !== "distinctCount" ? { format: "dop" } : {}) })), ...(plan.view === "pie" || plan.groupBy === "cashier" ? [{ key: "share", label: "% del total", format: "percent" }] : [])], ...(monetary && plan.measures.length === 1 && (!measure.aggregation || measure.aggregation === "sum") ? { currency: "DOP", total: selectedTotal } : monetary ? { currency: "DOP" } : {}), span: "wide" });
  } else {
    const rows = [...result.rows].sort((a, b) => String(b.soldAt ?? b.date ?? b.period).localeCompare(String(a.soldAt ?? a.date ?? a.period))).slice(0, plan.limit);
    for (const [index, measure] of plan.measures.entries()) {
      const value = plan.view === "table" && (!measure.aggregation || measure.aggregation === "sum") ? rows.reduce((sum, row) => sum + (measure.field === "count" ? 1 : Number(row[measure.field] ?? 0)), 0) : Number(result.totals[measure.field]);
      add(`metric${index}`, "MetricCard", { label: measure.label, value: display(value), tone: "neutral", helper: plan.view === "table" ? `${rows.length} registros visibles` : `${result.rows.length} registros del período` });
    }
    const preferred = plan.source === "creditNotes" ? ["id", "date", "customer", "invoiceId", "amount", "appliedAmount", "remainingAmount", "status"] : plan.source === "posTickets" ? ["id", "date", "soldAtLocal", "cashier", "register", "paymentMethod", "amount", "status"] : Object.keys(rows[0]).slice(0, 8);
    const labels: Record<string, string> = { id: plan.source === "posTickets" ? "Ticket" : plan.source === "attendance" ? "Marcación" : plan.source === "stock" ? "SKU" : plan.source === "creditNotes" ? "Nota" : "Referencia", date: "Fecha", soldAtLocal: "Hora RD", cashier: "Cajera", period: "Mes", customer: "Cliente", supplier: "Proveedor", employee: "Empleado", department: "Departamento", product: "Producto", invoiceId: "Factura", register: "Caja", paymentMethod: "Medio de pago", checkIn: "Entrada", checkOut: "Salida", items: "Ítems", amount: plan.source === "posTickets" ? "Cobrado" : plan.source === "creditNotes" ? "Emitido" : "Importe", gross: "Bruto", net: "Neto", deductions: "Descuentos", available: "Disponible", minimum: "Mínimo", appliedAmount: "Consumido", remainingAmount: "Disponible", status: "Estado" };
    add("records", "DataTable", { title: plan.source === "creditNotes" ? "Notas emitidas y consumo individual" : plan.measures[0].aggregation === "average" ? "Registros usados para el promedio" : plan.measures[0].aggregation === "distinctCount" ? "Registros usados para contar entidades únicas" : "Registros que respaldan el total", description: plan.source === "creditNotes" ? `${rows.length} notas · aplicado + disponible = importe emitido` : `${rows.length} registros · ${sourceLabels[plan.source] ?? "ERP"}`, data: rows, columns: preferred.map((key) => ({ key, label: labels[key] ?? key, ...(["amount", "appliedAmount", "remainingAmount", "gross", "net", "deductions"].includes(key) ? { format: "dop" } : {}) })), currency: "DOP", span: "wide" });
  }
  elements.root = { type: plan.groupBy ? "TableFocus" : "AnalysisGrid", props: { title: plan.title, subtitle: scope, periodLabel: plan.timeRange ? "Última hora" : plan.dateRange ? `${plan.dateRange.from} – ${plan.dateRange.to}` : periodLabel(plan.period, today) }, children };
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
