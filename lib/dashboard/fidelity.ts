import { parseCustomerBillingRanking, parseRecentCustomerBilling } from "@/lib/ui-memory/registry";
import { parseErpIntent } from "@/lib/erp/intent";
import type { DashboardElement, DashboardSpec } from "@/types/analytics";

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const rows = (element: DashboardElement | undefined) => Array.isArray(element?.props.data) ? element.props.data as Record<string, unknown>[] : [];

export function requestFidelityIssue(intent: string, spec: DashboardSpec): string | null {
  const value = normalize(intent);
  if (/estado de resultados|balance general|balance de comprobacion|utilidad neta|flujo de efectivo/.test(value)) return "La muestra ERP no contiene un cierre contable completo; no sería correcto presentar un estado financiero formal.";
  const erp = parseErpIntent(intent);
  if (!erp && ["salesAndPurchases", "purchasesBySupplier"].includes((spec.state?.erp as { collection?: string } | undefined)?.collection ?? "")) return null;
  if (erp) {
    if (/\b(?:202[0-5]|202[7-9])\b|\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|octubre|noviembre|diciembre)\b/.test(value)) return "Los registros ERP simulados cubren solo septiembre de 2026.";
    if (/\b(?:hoy|ayer|today|yesterday|esta semana|semana pasada)\b/.test(value)) return "Los registros ERP simulados no cubren con precisión ese período relativo.";
    const metadata = spec.state?.erp as { collection?: string } | undefined;
    const table = Object.values(spec.elements).find((element) => element.type === "DataTable");
    const records = rows(table);
    if (metadata?.collection !== erp.collection || !table) return "La respuesta no corresponde al módulo ERP solicitado.";
    if (records.length !== (erp.mode === "low" ? records.length : erp.count)) return `Se solicitaron ${erp.count} registros y la vista muestra otra cantidad.`;
    if (erp.collection === "purchaseOrders" && records.some((row) => !row.supplier || !row.id || !row.date || typeof row.amount !== "number")) return "Faltan proveedor, orden, fecha o importe de compra.";
    if (erp.collection === "journalEntries" && records.some((row) => !row.account || !row.reference || typeof row.debit !== "number" || typeof row.credit !== "number")) return "Faltan cuenta, referencia, débito o crédito en el libro diario.";
    return null;
  }
  if (/\b(proveedor(?:es)?|vendor(?:s)?|nomina|payroll|salario(?:s)?|salary|salaries)\b/.test(value)) return "La solicitud requiere un detalle de ERP aún no disponible en los datos demo.";
  if (/\b(ciudad(?:es)?|cit(?:y|ies))\b/.test(value)) return "Los datos demo incluyen país, pero no ciudad.";
  if (/\b(?:202[0-4]|202[7-9])\b/.test(value)) return "El historial demo solo abarca octubre de 2025 a septiembre de 2026.";
  if (/\b(?:todo el ano|ano completo|full year|annual total)\b/.test(value)) return "El historial demo no contiene un año calendario completo.";
  if (/\b(?:transacciones? reales?|real sales|tickets? de venta)\b/.test(value)) return "Este prototipo no contiene ventas transaccionales reales; solo MRR y registros demo.";
  if (/\b(dispersion|scatter|sankey)\b/.test(value)) return "Ese tipo de gráfico aún no existe en el catálogo visual validado.";
  if (/\b(?:pagaron|paid invoices?|facturas? pagadas?)\b/.test(value) && /\b(clientes?|usuarios?|customers?|users?)\b/.test(value)) return "No hay confirmación de pago por cliente en el historial demo; facturar no equivale a cobrar.";
  if (/\b(clientes?|usuarios?|customers?|users?)\b/.test(value) && /\b(compraron|compras?|purchases?|gastaron|spent)\b/.test(value)) return "No hay compras o gastos transaccionales por cliente en los datos demo.";
  if (/\b(hoy|ayer|today|yesterday|esta semana|last week|semana pasada)\b/.test(value) && /factur|billing|billed|invoice/.test(value)) return "El historial de facturación demo no admite ese filtro relativo de día o semana con precisión.";

  const elements = Object.values(spec.elements);
  const find = (type: string) => elements.find((element) => element.type === type);
  const recent = parseRecentCustomerBilling(intent);
  if (recent) {
    const ledger = rows(find("BillingLedger"));
    if (ledger.length !== recent.count) return `La respuesta debe mostrar exactamente ${recent.count} facturaciones recientes identificables.`;
    if (ledger.some((row) => !row.name || !row.billedAt || typeof row.amount !== "number")) return "Faltan nombre, fecha o importe en la lista de facturaciones.";
    if (ledger.some((row, index) => index > 0 && String(ledger[index - 1].billedAt) < String(row.billedAt))) return "La lista no está ordenada de más reciente a más antigua.";
    return null;
  }
  const ranking = parseCustomerBillingRanking(intent);
  if (ranking) {
    const ranked = rows(find("CustomerRanking"));
    if (ranked.length !== ranking.count) return `La respuesta debe mostrar exactamente ${ranking.count} clientes ordenados por facturación.`;
    if (ranked.some((row) => !row.name || typeof row.value !== "number")) return "Faltan nombres o importes en el ranking.";
    return null;
  }

  const people = /\b(clientes?|usuarios?|customers?|users?|accounts?)\b/.test(value);
  const billing = /factur|billing|revenue|ingreso|mrr/.test(value);
  if (people && /\b(montos?|importes?|amounts?)\b/.test(value) && !billing) return "Se pidió un importe por cliente sin indicar si corresponde a facturación, cobro, deuda u otra medida.";
  const identity = /\b(nombres?|identific|quienes?|who|which|lista|list|tabla|table)\b/.test(value) || people && /\b(sus|their)\b/.test(value);
  if (people && billing && identity) {
    const named = find("EntityTrendTable") || find("CustomerRanking") || find("BillingLedger") || elements.find((element) => element.type === "DataTable" && (element.props.columns as { key: string }[] | undefined)?.some((column) => ["customer", "name"].includes(column.key)));
    if (!named || !rows(named).length) return "Se pidieron clientes identificables e importes, pero no hay una tabla con esos registros.";
    const requestedCount = value.match(/\b(\d{1,2})\s+(?:clientes?|usuarios?|customers?|users?)\b/)?.[1];
    if (requestedCount && rows(named).length !== Number(requestedCount)) return `Se pidieron ${requestedCount} clientes, pero la tabla muestra otra cantidad.`;
  }
  if (/\b(tarta|pastel|pie|donut|dona)\b|grafico circular/.test(value) && !find("PieChartCard")) return "Se pidió un gráfico de tarta y la vista no contiene uno.";
  if (/grafico de lineas|line chart|lineas en un|grafico.*linea/.test(value) && !find("LineChartCard")) return "Se pidió un gráfico de líneas y la vista no contiene uno.";
  if (/grafico de barras|bar chart/.test(value) && !find("BarChartCard")) return "Se pidió un gráfico de barras y la vista no contiene uno.";
  if (/dia a dia|diari|por dia|cada dia|daily/.test(value) && !elements.some((element) => element.props.xKey === "day")) return "Se pidió granularidad diaria y la vista no muestra días.";
  if (/tendencia|historial|trend|history/.test(value) && people && billing && !find("EntityTrendTable")) return "Se pidió la tendencia individual de clientes, pero solo hay cifras agregadas.";
  if (/\b(muestrame|quiero ver|dame|show me|list)\b/.test(value) && !/ingres|entrada de dinero|salida de dinero|revenue|venta|sales|factur|billing|cliente|customer|usuario|user|churn|retenc|adquis|conversion|pago|payment|caja|cash|gasto|expense|beneficio|profit|plan|pais|country|cohort|acme/.test(value)) return "No hay una fuente de datos demo relacionada con esta solicitud.";
  return null;
}

export function unavailableSpec(reason: string): DashboardSpec {
  return {
    root: "root", state: {},
    elements: {
      root: { type: "AnalysisGrid", props: { title: "No puedo mostrar esa vista con fidelidad", subtitle: "No se sustituyó tu solicitud por un dashboard genérico" }, children: ["gap"] },
      gap: { type: "FindingCard", props: { label: "Dato no disponible", title: "Falta información para responder exactamente", body: `${reason} Puedes pedir otra vista con los datos disponibles o conectar una fuente que contenga ese detalle.`, value: "—", valueLabel: "Sin datos suficientes" }, children: [] },
    },
  };
}
