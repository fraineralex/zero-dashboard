import { demoErpProvider, demoPosTickets, type ErpCollection, type ErpRecord, type ErpReadProvider } from "@/lib/erp/demo";
import { buildCrossModuleComparisonSpec, buildSemanticErpSpec } from "@/lib/erp/query";
import type { DashboardSpec } from "@/types/analytics";

const clean = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
type Column = { key: string; label: string; format?: string };
const columns: Record<ErpCollection, Column[]> = {
  purchaseOrders: [{ key: "id", label: "Orden" }, { key: "date", label: "Fecha" }, { key: "supplier", label: "Proveedor" }, { key: "items", label: "Ítems" }, { key: "amount", label: "Total", format: "dop" }, { key: "status", label: "Estado" }],
  salesOrders: [{ key: "id", label: "Orden" }, { key: "date", label: "Fecha" }, { key: "customer", label: "Cliente" }, { key: "items", label: "Ítems" }, { key: "amount", label: "Total", format: "dop" }, { key: "status", label: "Estado" }],
  salesLines: [{ key: "product", label: "Producto" }, { key: "quantity", label: "Unidades" }, { key: "subtotal", label: "Venta", format: "dop" }, { key: "orderId", label: "Orden" }],
  vendorBills: [{ key: "id", label: "Factura" }, { key: "supplier", label: "Proveedor" }, { key: "date", label: "Emisión" }, { key: "due", label: "Vencimiento" }, { key: "amount", label: "Importe", format: "dop" }, { key: "status", label: "Estado" }],
  customerInvoices: [{ key: "id", label: "Factura" }, { key: "customer", label: "Cliente" }, { key: "date", label: "Emisión" }, { key: "due", label: "Vencimiento" }, { key: "amount", label: "Importe", format: "dop" }, { key: "status", label: "Estado" }],
  journalEntries: [{ key: "id", label: "Asiento" }, { key: "date", label: "Fecha" }, { key: "reference", label: "Referencia" }, { key: "account", label: "Cuenta" }, { key: "debit", label: "Débito", format: "dop" }, { key: "credit", label: "Crédito", format: "dop" }],
  stock: [{ key: "id", label: "SKU" }, { key: "product", label: "Producto" }, { key: "warehouse", label: "Almacén" }, { key: "available", label: "Disponible" }, { key: "minimum", label: "Mínimo" }, { key: "status", label: "Estado" }],
  payroll: [{ key: "id", label: "Empleado" }, { key: "employee", label: "Nombre" }, { key: "department", label: "Departamento" }, { key: "gross", label: "Bruto", format: "dop" }, { key: "deductions", label: "Descuentos", format: "dop" }, { key: "net", label: "Neto", format: "dop" }],
  payrollRuns: [{ key: "period", label: "Mes" }, { key: "gross", label: "Bruto", format: "dop" }, { key: "net", label: "Neto", format: "dop" }, { key: "employerTaxes", label: "Aportes empresa", format: "dop" }, { key: "employerCost", label: "Costo total", format: "dop" }],
  payrollTaxPayments: [{ key: "id", label: "Pago" }, { key: "date", label: "Fecha" }, { key: "type", label: "Concepto" }, { key: "amount", label: "Pagado", format: "dop" }, { key: "status", label: "Estado" }],
  attendance: [{ key: "date", label: "Fecha" }, { key: "employee", label: "Empleado" }, { key: "department", label: "Departamento" }, { key: "checkIn", label: "Entrada" }, { key: "checkOut", label: "Salida" }, { key: "status", label: "Estado" }],
};
const labels: Record<ErpCollection, string> = { purchaseOrders: "órdenes de compra a proveedores", salesOrders: "órdenes de venta", salesLines: "líneas de venta", vendorBills: "facturas de proveedores", customerInvoices: "facturas de clientes", journalEntries: "asientos contables", stock: "productos en inventario", payroll: "registros de nómina", payrollRuns: "nóminas mensuales", payrollTaxPayments: "pagos patronales", attendance: "registros de asistencia" };

export function parseErpIntent(intent: string): { collection: ErpCollection; count: number; mode: "latest" | "largest" | "low" | "zero" | "all" } | null {
  const text = clean(intent);
  const purchasing = /compras?|proveedor|purchase|vendor/.test(text);
  let collection: ErpCollection | null = null;
  if (/nomina|salarios?|payroll|sueldos?|empleados?.*(?:pago|neto|bruto)/.test(text)) collection = "payroll";
  else if (/asistencia|marcaciones?|ponches?|tardanzas?|attendance/.test(text)) collection = "attendance";
  else if (/inventario|existencias?|stock|almacen|productos?.*(?:disponib|reponer)/.test(text)) collection = "stock";
  else if (/asientos? contables?|libro diario|movimientos? contables?|journal entries|general ledger/.test(text)) collection = "journalEntries";
  else if (/\b(?:facturas?|invoices?)\b|cuentas? por (?:cobrar|pagar)/.test(text) && !/\b(?:clientes?|usuarios?)\b.*\b(?:pagaron|facturaron|facturado)\b/.test(text)) collection = purchasing || /pagar/.test(text) ? "vendorBills" : "customerInvoices";
  else if (/(?:ordenes?|pedidos?|cotizaciones?)\s+(?:de\s+)?compras?|compras?.*(?:orden|pedido)|ordenes?.*proveedor|proveedor.*orden/.test(text)) collection = "purchaseOrders";
  else if (/(?:ordenes?|pedidos?)\s+(?:de\s+)?ventas?|ventas?.*(?:orden|pedido)/.test(text)) collection = "salesOrders";
  if (!collection) return null;
  const count = Math.max(1, Number(text.match(/\b(\d{1,2})\b/)?.[1] ?? 10));
  const mode = /sin stock|sin existencias?|agotad|stock(?:\s*=\s*|\s+igual a\s+)0|inventario(?:\s*=\s*|\s+igual a\s+)0/.test(text) && collection === "stock" ? "zero" : /bajo|baja|reponer|minimum|low stock/.test(text) && collection === "stock" ? "low" : /mayores?|mas (?:altos?|grandes?|costosos?)|top|highest/.test(text) ? "largest" : /ultim|recient|recent|latest/.test(text) ? "latest" : "all";
  return { collection, count, mode };
}

export function buildErpSpec(intent: string, provider: ErpReadProvider = demoErpProvider): DashboardSpec | null {
  if (/\b(?:punto de venta|terminal(?:es)? de venta|pos)\b/.test(clean(intent))) {
    const tickets = [...demoPosTickets].sort((a, b) => b.date.localeCompare(a.date));
    const total = tickets.reduce((sum, ticket) => sum + ticket.amount, 0);
    const dop = (value: number) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(value);
    return { root: "root", state: { erp: { collection: "posTickets", source: "demo", count: tickets.length } }, elements: {
      root: { type: "AnalysisGrid", props: { title: "Punto de venta", subtitle: "Septiembre 2026 · operaciones POS · datos simulados", periodLabel: "Muestra · 12 tickets" }, children: ["sales", "tickets", "average", "trend", "records"] },
      sales: { type: "MetricCard", props: { label: "Ventas cobradas", value: dop(total), helper: "En los tickets de la muestra", tone: "neutral" }, children: [] },
      tickets: { type: "MetricCard", props: { label: "Tickets pagados", value: String(tickets.length), helper: "Operaciones POS", tone: "neutral" }, children: [] },
      average: { type: "MetricCard", props: { label: "Ticket promedio", value: dop(Math.round(total / tickets.length)), helper: "Ventas ÷ tickets", tone: "neutral" }, children: [] },
      trend: { type: "BarChartCard", props: { title: "Ventas por día", description: "Importe cobrado en cada fecha de la muestra · RD$", data: [...tickets].reverse().map((ticket) => ({ day: ticket.date.slice(-2), amount: ticket.amount })), xKey: "day", series: [{ key: "amount", label: "Ventas cobradas", format: "dop" }], format: "dop", span: "wide" }, children: [] },
      records: { type: "DataTable", props: { title: "Tickets recientes", description: "Identificador, caja, medio de pago e importe · datos simulados", data: tickets, columns: [{ key: "id", label: "Ticket" }, { key: "date", label: "Fecha" }, { key: "register", label: "Caja" }, { key: "paymentMethod", label: "Pago" }, { key: "items", label: "Ítems" }, { key: "amount", label: "Cobrado", format: "dop" }], currency: "DOP", total, span: "wide" }, children: [] },
    } };
  }
  const crossModule = buildCrossModuleComparisonSpec(intent, provider);
  if (crossModule) return crossModule;
  const semantic = buildSemanticErpSpec(intent, provider);
  if (semantic) return semantic;
  const text = clean(intent);
  if (/compras?/.test(text) && /ventas?/.test(text) && /compar|combina|evolucion|tendencia|grafico|grafica/.test(text)) {
    const purchases = provider.list("purchaseOrders");
    const sales = provider.list("salesOrders");
    const chartData = sales.map((row) => ({ day: String(row.date).slice(-2), ventas: Number(row.amount), compras: Number(purchases.find((order) => order.date === row.date)?.amount ?? 0) })).reverse();
    return { root: "root", state: { erp: { collection: "salesAndPurchases", source: "demo" } }, elements: {
      root: { type: "AnalysisGrid", props: { title: "Ventas y compras, lado a lado", subtitle: "Empresa demo · septiembre 2026 · RD$ · datos simulados" }, children: ["chart"] },
      chart: { type: "LineChartCard", props: { title: "Ventas vs compras", description: "Importe de órdenes por día · no equivale a cobros o pagos", data: chartData, xKey: "day", series: [{ key: "ventas", label: "Ventas" }, { key: "compras", label: "Compras" }], format: "dop", span: "wide" }, children: [] },
    } };
  }
  if (/compras?/.test(text) && /por proveedor|proveedores?/.test(text) && !/ordenes?|pedidos?|ultim|recient/.test(text)) {
    const requestedCount = Number(text.match(/\b(?:top|primer[oa]s?|mayores?)\s+(\d{1,2})\b/)?.[1] ?? 0);
    const orders = [...provider.list("purchaseOrders")].sort((a, b) => Number(b.amount) - Number(a.amount));
    const selected = requestedCount ? orders.slice(0, requestedCount) : orders;
    const chartRows = selected.slice(0, requestedCount || 6);
    return { root: "root", state: { erp: { collection: "purchasesBySupplier", source: "demo" } }, elements: {
      root: { type: "AnalysisGrid", props: { title: requestedCount ? `Top ${chartRows.length} proveedores por compras` : "Compras por proveedor", subtitle: "Empresa demo · septiembre 2026 · RD$ · datos simulados" }, children: ["chart", "records"] },
      chart: { type: "BarChartCard", props: { title: requestedCount ? `${chartRows.length} mayores proveedores` : "Seis mayores proveedores", description: "Importe de órdenes de compra de la muestra · nombres completos abajo", data: chartRows.map((row) => ({ name: String(row.supplier).replace(/^(?:Distribuidora|Ferretería|Empaques|Alimentos|Plásticos)\s+(?:(?:del|de|la)\s+)?/, "").replace(/\s+SRL$/, "").slice(0, 13), value: Number(row.amount) })), xKey: "name", series: [{ key: "value", label: "Compras" }], format: "dop", horizontal: true, span: "wide" }, children: [] },
      records: { type: "DataTable", props: { title: "Detalle por proveedor", description: `${selected.length} proveedores · datos simulados`, data: selected.map((row) => ({ id: row.id, supplier: row.supplier, amount: row.amount, date: row.date, status: row.status })), columns: [{ key: "supplier", label: "Proveedor" }, { key: "id", label: "Orden" }, { key: "date", label: "Fecha" }, { key: "amount", label: "Total", format: "dop" }, { key: "status", label: "Estado" }], currency: "DOP", total: selected.reduce((sum, row) => sum + Number(row.amount), 0), span: "wide" }, children: [] },
    } };
  }
  const query = parseErpIntent(intent);
  if (!query) return null;
  let rows: ErpRecord[] = [...provider.list(query.collection)];
  if (query.mode === "zero") rows = rows.filter((row) => Number(row.available) === 0);
  else if (query.mode === "low") rows = rows.filter((row) => Number(row.available) < Number(row.minimum)).sort((a, b) => Number(a.available) - Number(b.available));
  else if (query.mode === "largest") rows.sort((a, b) => Number(b.amount ?? b.net ?? 0) - Number(a.amount ?? a.net ?? 0));
  else if (query.collection !== "stock" && query.collection !== "payroll") rows.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
  rows = rows.slice(0, query.count);
  const masculine = ["journalEntries", "stock", "payroll", "attendance"].includes(query.collection);
  const title = query.mode === "zero" ? "Productos sin stock" : query.mode === "low" ? "Inventario para reponer" : query.mode === "largest" ? `${rows.length} ${labels[query.collection]} de mayor importe` : query.mode === "latest" ? `${masculine ? "Últimos" : "Últimas"} ${rows.length} ${labels[query.collection]}` : `${rows.length} ${labels[query.collection]}`;
  const amount = rows.reduce((sum, row) => sum + Number(row.amount ?? row.net ?? 0), 0);
  const hasAmount = columns[query.collection].some((column) => column.key === "amount" || column.key === "net");
  return { root: "root", state: { erp: { collection: query.collection, count: rows.length, mode: query.mode, source: "demo" } }, elements: {
    root: { type: "TableFocus", props: { title, subtitle: "Empresa demo · República Dominicana · septiembre 2026", periodLabel: "Datos simulados" }, children: ["records"] },
    records: { type: "DataTable", props: { title: labels[query.collection][0].toUpperCase() + labels[query.collection].slice(1), description: `${rows.length} registros · ${query.mode === "largest" ? "mayor importe primero" : query.mode === "low" ? "menor disponibilidad primero" : "más reciente primero"} · datos simulados`, data: rows, columns: columns[query.collection], span: "wide", currency: "DOP", ...(hasAmount ? { total: amount } : {}) }, children: [] },
  } };
}
