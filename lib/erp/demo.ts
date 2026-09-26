/** Fictional Dominican company dataset. Replace this provider with authenticated ERP API adapters. */
export type ErpRecord = Record<string, string | number>;
export type ErpCollection = "purchaseOrders" | "salesOrders" | "salesLines" | "vendorBills" | "customerInvoices" | "creditNotes" | "posTickets" | "expenseEntries" | "journalEntries" | "stock" | "payroll" | "payrollRuns" | "payrollTaxPayments" | "attendance";

export interface ErpReadProvider {
  list(collection: ErpCollection): readonly ErpRecord[];
}

const suppliers = ["Distribuidora Cibao SRL", "Ferretería Nacional", "Empaques del Caribe", "TecnoSupply RD", "Alimentos del Norte", "Plásticos del Este", "Logística Quisqueya", "Soluciones Eléctricas", "Papelera Dominicana", "Insumos Industriales RD", "Grupo Antillas", "Comercial Duarte"];
const customers = ["Supermercados Colonial", "Farmacia Popular", "Grupo Turístico Bávaro", "Mercado Central SD", "Clínica del Este", "Hoteles Coral", "Ferretería del Norte", "Almacenes Duarte", "Comercial Ozama", "Distribuidora Vega", "Restaurante La Ceiba", "Servicios Quisqueya"];
const employees = ["Ana Martínez", "José Rodríguez", "María Pérez", "Carlos Fernández", "Laura Gómez", "Pedro Sánchez", "Isabel Jiménez", "Miguel Torres", "Sofía Castillo", "Daniel Ramírez", "Camila Reyes", "Andrés Núñez"];
const products = ["Café tostado 1 kg", "Arroz premium 25 lb", "Aceite vegetal 1 gal", "Leche UHT 1 L", "Papel higiénico 12 u", "Detergente 2 kg", "Harina de trigo 5 lb", "Agua mineral 500 ml", "Azúcar crema 5 lb", "Servilletas 200 u", "Habichuelas rojas 1 lb", "Jugo natural 1 L"];
const date = (index: number) => `2026-09-${String(23 - index).padStart(2, "0")}`;
export const demoToday = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santo_Domingo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const noteDate = (daysBefore: number) => `${demoToday.slice(0, 7)}-${String(Math.max(1, Number(demoToday.slice(-2)) - daysBefore)).padStart(2, "0")}`;
const salesOrders = customers.map((customer, index) => ({ id: `SO-2026-${String(291 - index).padStart(4, "0")}`, date: date(index), customer, items: 2 + index % 8, amount: 32600 + (11 - index) * 10850, status: ["Por facturar", "Confirmada", "Entregada"][index % 3] }));
const payroll = employees.map((employee, index) => ({ id: `EMP-${String(101 + index)}`, employee, department: ["Ventas", "Compras", "Contabilidad", "Almacén"][index % 4], gross: 42000 + (11 - index) * 2850, deductions: 3800 + index * 270, net: 38200 + (11 - index) * 2850 - index * 270, status: "Calculada" }));
const payrollGross = payroll.reduce((sum, row) => sum + row.gross, 0);
const payrollNet = payroll.reduce((sum, row) => sum + row.net, 0);
const periods = Array.from({ length: 12 }, (_, index) => {
  const year = index < 3 ? 2025 : 2026;
  const month = index < 3 ? index + 10 : index - 2;
  return { period: `${year}-${String(month).padStart(2, "0")}`, label: new Intl.DateTimeFormat("es-DO", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1))) };
});
const payrollRuns = periods.map(({ period, label }, index) => {
  const gross = payrollGross - (11 - index) * 6200;
  const net = payrollNet - (11 - index) * 5400;
  const tssEmployer = 68000 + index * 750;
  const infotepEmployer = 6300 + index * 70;
  return { id: `PAY-${period}`, period, month: label, gross, net, tssEmployer, infotepEmployer, employerTaxes: tssEmployer + infotepEmployer, employerCost: gross + tssEmployer + infotepEmployer, status: "Cerrada" };
});
const payrollTaxPayments = payrollRuns.flatMap((run) => [
  { id: `TSS-${run.period}`, period: run.period, date: `${run.period}-20`, type: "TSS patronal", amount: run.tssEmployer, status: "Pagado" },
  { id: `INF-${run.period}`, period: run.period, date: `${run.period}-21`, type: "INFOTEP patronal", amount: run.infotepEmployer, status: "Pagado" },
]);
const salesLines = salesOrders.flatMap((order, orderIndex) => {
  const base = Math.floor(order.amount / order.items);
  return Array.from({ length: order.items }, (_, lineIndex) => {
    const productIndex = (orderIndex * 3 + lineIndex * 5) % products.length;
    return { id: `${order.id}-L${lineIndex + 1}`, orderId: order.id, date: order.date, customer: order.customer, productId: `SKU-${3201 + productIndex}`, product: products[productIndex], quantity: 2 + ((orderIndex + lineIndex * 3) % 11), subtotal: lineIndex === order.items - 1 ? order.amount - base * (order.items - 1) : base };
  });
});

/** Sample POS tickets, deliberately separate from quotations/orders and recurring revenue. */
export const demoPosTickets = Array.from({ length: 12 }, (_, index) => ({
  id: `POS-2026-${String(912 - index).padStart(4, "0")}`,
  date: date(index),
  register: ["Caja principal", "Caja tienda", "Caja sucursal"][index % 3],
  paymentMethod: ["Tarjeta", "Efectivo", "Transferencia"][index % 3],
  items: 1 + index % 5,
  amount: 1840 + (11 - index) * 415 + (index % 3) * 230,
  status: "Pagado",
}));

const data: Record<ErpCollection, ErpRecord[]> = {
  purchaseOrders: suppliers.map((supplier, index) => ({ id: `PO-2026-${String(147 - index).padStart(4, "0")}`, date: date(index), supplier, items: 3 + index % 6, amount: 45800 + (11 - index) * 7190, status: ["Por aprobar", "Confirmada", "Recibida", "En tránsito"][index % 4] })),
  salesOrders,
  salesLines,
  vendorBills: suppliers.map((supplier, index) => ({ id: `BILL-2026-${String(88 - index).padStart(4, "0")}`, date: date(index), supplier, due: `2026-10-${String(12 + index).padStart(2, "0")}`, amount: 29400 + (11 - index) * 6410, status: index % 3 === 0 ? "Pagada" : "Pendiente" })),
  customerInvoices: [
    ...customers.map((customer, index) => ({ id: `INV-2026-${String(327 - index).padStart(4, "0")}`, date: date(index), customer, due: `2026-10-${String(10 + index).padStart(2, "0")}`, amount: 36500 + (11 - index) * 8840, status: index % 4 === 0 ? "Pagada" : "Por cobrar" })),
    ...customers.slice(0, 5).map((customer, index) => ({ id: `INV-DEMO-TODAY-${index + 1}`, date: demoToday, customer, due: demoToday, amount: 18450 + index * 7120, status: "Por cobrar" })),
  ],
  creditNotes: [
    { id: "NC-DEMO-001", date: noteDate(3), customer: customers[0], invoiceId: "INV-2026-0327", amount: 18000, appliedAmount: 18000, remainingAmount: 0, status: "Aplicada" },
    { id: "NC-DEMO-002", date: noteDate(2), customer: customers[1], invoiceId: "INV-2026-0326", amount: 12500, appliedAmount: 8000, remainingAmount: 4500, status: "Parcial" },
    { id: "NC-DEMO-003", date: noteDate(1), customer: customers[2], invoiceId: "INV-2026-0325", amount: 9600, appliedAmount: 0, remainingAmount: 9600, status: "Disponible" },
    { id: "NC-DEMO-004", date: noteDate(0), customer: customers[3], invoiceId: "INV-2026-0324", amount: 7100, appliedAmount: 7100, remainingAmount: 0, status: "Aplicada" },
  ],
  posTickets: demoPosTickets,
  expenseEntries: ["Alquiler", "Servicios", "Logística", "Marketing", "Mantenimiento", "Servicios", "Logística", "Alquiler"].map((category, index) => ({
    id: `EXP-2026-${String(81 - index).padStart(4, "0")}`, date: date(index), category,
    description: ["Local comercial", "Electricidad", "Transporte", "Campaña digital", "Equipos", "Internet", "Entregas", "Almacén"][index],
    amount: 12500 + index * 1750, status: "Registrado",
  })),
  journalEntries: Array.from({ length: 12 }, (_, index) => {
    const group = Math.floor(index / 2);
    const customerSide = group < 3;
    const sourceIndex = customerSide ? group : group - 3;
    const amount = customerSide ? 36500 + (11 - sourceIndex) * 8840 : 29400 + (11 - sourceIndex) * 6410;
    return { id: `JE-2026-${String(441 - index).padStart(4, "0")}`, date: date(group), reference: `${customerSide ? "INV" : "BILL"}-2026-${String((customerSide ? 327 : 88) - sourceIndex).padStart(4, "0")}`, account: customerSide ? index % 2 === 0 ? "Cuentas por cobrar" : "Ingresos por ventas" : index % 2 === 0 ? "Compras de inventario" : "Cuentas por pagar", debit: index % 2 === 0 ? amount : 0, credit: index % 2 === 1 ? amount : 0 };
  }),
  stock: products.map((product, index) => { const available = [4, 0, 11, 16, 20, 8, 3, 0, 14, 6, 18, 9][index]; return { id: `SKU-${String(3201 + index)}`, product, warehouse: index % 2 ? "Santiago" : "Santo Domingo", available, minimum: 12, unitCost: 95 + index * 42, status: available === 0 ? "Sin stock" : available < 12 ? "Reponer" : "Disponible" }; }),
  payroll,
  payrollRuns,
  payrollTaxPayments,
  attendance: employees.map((employee, index) => ({ id: `ATT-${String(901 + index)}`, date: date(index), employee, department: ["Ventas", "Compras", "Contabilidad", "Almacén"][index % 4], checkIn: index % 4 === 0 ? "08:18" : "07:58", checkOut: "17:02", status: index % 4 === 0 ? "Tardanza" : "A tiempo" })),
};

export const demoErpProvider: ErpReadProvider = { list: (collection) => data[collection] };
