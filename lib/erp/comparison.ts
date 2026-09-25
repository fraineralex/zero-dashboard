import { demoErpProvider, demoPosTickets, type ErpReadProvider } from "@/lib/erp/demo";
import type { DashboardSpec } from "@/types/analytics";

type Source = "payroll" | "purchases" | "sales" | "pos";
const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const sourceLabels: Record<Source, string> = { payroll: "Nómina", purchases: "Compras", sales: "Ventas", pos: "Punto de venta" };

export function requestedComparisonSources(intent: string): Source[] {
  const text = normalize(intent);
  const matches: { source: Source; index: number }[] = [];
  const pos = /\b(?:punto de venta|terminal(?:es)? de venta|pos)\b/.exec(text);
  if (pos) matches.push({ source: "pos", index: pos.index });
  const withoutPos = pos ? text.slice(0, pos.index) + " ".repeat(pos[0].length) + text.slice(pos.index + pos[0].length) : text;
  for (const [source, pattern] of [
    ["payroll", /\b(?:nomina|payroll|salarios?|sueldos?)\b/],
    ["purchases", /\b(?:compras?|adquisiciones?)\b/],
    ["sales", /\b(?:ventas?|ingresos?)\b/],
  ] as const) {
    const match = pattern.exec(withoutPos);
    if (match) matches.push({ source, index: match.index });
  }
  if (matches.length < 2 || !/\b(?:vs|versus|contra|compar(?:a|ar|acion)?|frente a)\b|(?:grafico|grafica).*\by\b/.test(text)) return [];
  const sources = matches.sort((a, b) => a.index - b.index).map(({ source }) => source);
  // Sales and purchase orders already have a faithful, shared daily series.
  if (sources.length === 2 && sources.includes("sales") && sources.includes("purchases")) return [];
  return sources;
}

function comparisonRows(sources: Source[], provider: ErpReadProvider) {
  const period = "2026-09";
  const payroll = provider.list("payrollRuns").find((row) => row.period === period);
  const definitions: Record<Source, { value: number; records: number; basis: string; module: string }> = {
    payroll: { value: Number(payroll?.employerCost ?? 0), records: payroll ? 1 : 0, basis: "Bruto + aportes patronales", module: "Nómina" },
    purchases: { value: 0, records: 0, basis: "Órdenes de compra; no pagos", module: "Compras" },
    sales: { value: 0, records: 0, basis: "Órdenes de venta; no cobros", module: "Ventas" },
    pos: { value: 0, records: 0, basis: "Tickets cobrados", module: "Punto de venta" },
  };
  for (const [source, collection] of [["purchases", "purchaseOrders"], ["sales", "salesOrders"]] as const) {
    const records = provider.list(collection).filter((row) => String(row.date).startsWith(period));
    definitions[source].value = records.reduce((sum, row) => sum + Number(row.amount), 0);
    definitions[source].records = records.length;
  }
  const tickets = demoPosTickets.filter((ticket) => ticket.date.startsWith(period));
  definitions.pos.value = tickets.reduce((sum, ticket) => sum + ticket.amount, 0);
  definitions.pos.records = tickets.length;
  return sources.map((source, index) => ({ id: String(index + 1), source, name: sourceLabels[source], ...definitions[source] }));
}

export function buildFlexibleComparisonSpec(intent: string, provider: ErpReadProvider = demoErpProvider): DashboardSpec | null {
  const sources = requestedComparisonSources(intent);
  if (!sources.length) return null;
  const data = comparisonRows(sources, provider);
  if (data.some((row) => !row.records)) return null;
  const title = data.map((row) => row.name).join(" vs ");
  return { root: "root", state: { erp: { collection: "moduleComparison", sources, period: "2026-09", source: "demo" } }, elements: {
    root: { type: "AnalysisGrid", props: { title, subtitle: "Septiembre 2026 · módulos relacionados · RD$ · datos simulados", periodLabel: "Mismo período" }, children: ["chart", "records"] },
    chart: { type: "BarChartCard", props: { title: "Comparación entre módulos", description: "Importes de septiembre; consulta la base de cada medida antes de interpretarlos", data, xKey: "name", series: [{ key: "value", label: "Importe", format: "dop" }], format: "dop", span: "wide" }, children: [] },
    records: { type: "DataTable", props: { title: "Origen de cada importe", description: "Todas las medidas usan septiembre de 2026; las órdenes no representan dinero cobrado o pagado", data, columns: [{ key: "name", label: "Medida" }, { key: "value", label: "Importe", format: "dop" }, { key: "basis", label: "Base de cálculo" }, { key: "records", label: "Registros" }, { key: "module", label: "Módulo" }], currency: "DOP", span: "wide" }, children: [] },
  } };
}

export function flexibleComparisonFidelityIssue(intent: string, spec: DashboardSpec): string | null | undefined {
  const sources = requestedComparisonSources(intent);
  if (!sources.length) return undefined;
  const text = normalize(intent);
  if (/\b(?:202[0-5]|202[7-9])\b|\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|octubre|noviembre|diciembre)\b/.test(text)) return "La comparación demo solo cubre septiembre de 2026.";
  if (/\b(?:lineas?|tendencia|evolucion|tarta|pastel|pie|dona|donut)\b/.test(text)) return "La muestra no contiene series temporales alineadas ni partes de un mismo total para esa visualización entre módulos.";
  const marker = spec.state?.erp as { collection?: string; sources?: Source[]; period?: string } | undefined;
  const chart = Object.values(spec.elements).find((block) => block.type === "BarChartCard");
  const table = Object.values(spec.elements).find((block) => block.type === "DataTable");
  const chartRows = chart?.props.data as { source: Source; value: number }[] | undefined;
  const tableRows = table?.props.data as { source: Source; value: number }[] | undefined;
  if (marker?.collection !== "moduleComparison" || marker.period !== "2026-09" || !chartRows || !tableRows || marker.sources?.join() !== sources.join() || chartRows.length !== sources.length || tableRows.length !== sources.length) return "La vista debe comparar todas las medidas solicitadas en un mismo gráfico y período.";
  const expected = comparisonRows(sources, demoErpProvider);
  if (expected.some((row) => !chartRows.some((actual) => actual.source === row.source && actual.value === row.value) || !tableRows.some((actual) => actual.source === row.source && actual.value === row.value))) return "Los importes de la comparación no coinciden con los registros de cada módulo.";
  return null;
}
