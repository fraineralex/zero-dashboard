import type { ErpCollection } from "@/lib/erp/demo";
import { normalizeErpQuestion } from "@/lib/erp/question-language";

export const businessSources = ["purchaseOrders", "salesOrders", "salesLines", "vendorBills", "customerInvoices", "creditNotes", "posTickets", "expenseEntries", "journalEntries", "stock", "payroll", "payrollRuns", "payrollTaxPayments", "attendance"] as const satisfies readonly ErpCollection[];

/** Descriptions are semantic context, not authorization to fabricate missing fields or data. */
export const sourceDescriptions: Record<ErpCollection, string> = {
  purchaseOrders: "Órdenes de compra a proveedores; compromiso de compra, no pago ni factura.",
  salesOrders: "Órdenes de venta a clientes; venta solicitada, no necesariamente cobrada ni facturada.",
  salesLines: "Líneas vendidas por producto y cliente; unidades y subtotal de venta.",
  vendorBills: "Facturas recibidas de proveedores; importe, estado y fecha de vencimiento.",
  customerInvoices: "Facturas emitidas a clientes; facturación, estado de cobro y vencimiento.",
  creditNotes: "Notas de crédito emitidas a clientes; importe, aplicado y remanente.",
  posTickets: "Tickets de punto de venta cobrados; fecha, hora exacta, cajera identificada, caja y medio de pago. Son cobros POS, no facturas emitidas.",
  expenseEntries: "Gastos registrados; categoría, descripción e importe.",
  journalEntries: "Asientos contables; cuenta, débito y crédito, sin cierre financiero completo.",
  stock: "Existencias actuales por producto y almacén; disponible, mínimo y costo unitario.",
  payroll: "Empleados con departamento y nómina bruta, deducciones y neta; SIN fecha ni período.",
  payrollRuns: "Nóminas mensuales cerradas; bruto, neto, aportes y costo empresa; SIN departamento ni empleado.",
  payrollTaxPayments: "Pagos mensuales de TSS e INFOTEP patronal; fecha, estado e importe.",
  attendance: "Marcaciones de empleados por fecha y departamento; estado de puntualidad.",
};

/** Restrict obvious requests, but give the planner the whole catalog for novel wording. */
export function discoverBusinessSources(intent: string): ErpCollection[] {
  const text = normalizeErpQuestion(intent);
  if (/cajer[oa]s?/.test(text) || /ventas? de la ultima hora|ventas? en la ultima hora/.test(text)) return ["posTickets"];
  if (/notas? de credito|devolucion(?:es)? de factur/.test(text)) return ["creditNotes"];
  if (/\b(?:tss|infotep)\b/.test(text)) return ["payrollTaxPayments", "payrollRuns"];
  if (/impuesto|aportes?|patronal/.test(text) && /nomina|salarios?|sueldos?|personal/.test(text)) return ["payrollTaxPayments", "payrollRuns"];
  if (/nomina|salarios?|sueldos?|remuneracion|personal/.test(text) && /departamentos?|empleados?/.test(text)) return ["payroll"];
  if (/nomina|salarios?|sueldos?|remuneracion/.test(text) && /crec|variacion|mes anterior|mes pasado|mensual/.test(text)) return ["payrollRuns"];
  if (/nomina|salarios?|sueldos?|remuneracion/.test(text)) return ["payroll", "payrollRuns"];
  if (/gastos?|egresos?|desembolsos?/.test(text)) return ["expenseEntries"];
  if (/punto de venta|\bpos\b|tickets?|cajas? registrador/.test(text)) return ["posTickets"];
  if (/sin stock|inventario|existencias?|almac[eé]n(?:es)?/.test(text)) return ["stock"];
  if (/asistencia|marcaciones?|ponches?|tardanzas?|llegad[oa]s? tarde|llegaron tarde|puntualidad/.test(text)) return ["attendance"];
  if (/productos?|articulos?|skus?/.test(text) && /vendid|ventas?/.test(text)) return ["salesLines"];
  if (/productos?|articulos?|skus?/.test(text)) return ["stock", "salesLines"];
  if (/proveedores?|suplidores?/.test(text) && /factur|cuentas? por pagar|deudas?/.test(text)) return ["vendorBills"];
  if (/compras?|proveedores?|suplidores?/.test(text)) return ["purchaseOrders", "vendorBills"];
  if (/clientes?|usuarios?/.test(text) && /factur|cuentas? por cobrar|deudas?/.test(text)) return ["customerInvoices"];
  if (/facturas?/.test(text) && /pagad|cobrad|emitid/.test(text)) return ["customerInvoices", "vendorBills"];
  if (/ventas?/.test(text)) return ["salesOrders", "salesLines", "customerInvoices"];
  if (/asientos?|contab|libro diario/.test(text)) return ["journalEntries"];
  return [...businessSources];
}

export function looksLikeBusinessQuestion(intent: string): boolean {
  const text = normalizeErpQuestion(intent);
  if (/\b(?:mrr|churn|cohort|retention|retencion|lifetime value|l[t]?v)\b|clientes?.*riesgo|riesgo.*clientes?/.test(text)) return false;
  return /\b(?:muestr\w*|ensen\w*|dame|quiero|necesito|grafic\w*|tabla|lista|top|cuanto\w*|cual\w*|quien\w*|como|que|compar\w*|analiz\w*|distribucion|porcentaje|participacion|tendencia|evolucion|total|promedio|ultim\w*|ventas?|compras?|nomina|inventario|facturas?|clientes?|proveedores?|suplidores?|productos?|gastos?|contabilidad|asistencia|stock|tardanzas?|tss|infotep|cajer[oa]s?)\b/.test(text);
}
