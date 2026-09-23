/** Fictional Dominican company dataset. Replace this provider with authenticated ERP API adapters. */
export type ErpRecord = Record<string, string | number>;
export type ErpCollection = "purchaseOrders" | "salesOrders" | "vendorBills" | "customerInvoices" | "journalEntries" | "stock" | "payroll" | "attendance";

export interface ErpReadProvider {
  list(collection: ErpCollection): readonly ErpRecord[];
}

const suppliers = ["Distribuidora Cibao SRL", "Ferretería Nacional", "Empaques del Caribe", "TecnoSupply RD", "Alimentos del Norte", "Plásticos del Este", "Logística Quisqueya", "Soluciones Eléctricas", "Papelera Dominicana", "Insumos Industriales RD", "Grupo Antillas", "Comercial Duarte"];
const customers = ["Supermercados Colonial", "Farmacia Popular", "Grupo Turístico Bávaro", "Mercado Central SD", "Clínica del Este", "Hoteles Coral", "Ferretería del Norte", "Almacenes Duarte", "Comercial Ozama", "Distribuidora Vega", "Restaurante La Ceiba", "Servicios Quisqueya"];
const employees = ["Ana Martínez", "José Rodríguez", "María Pérez", "Carlos Fernández", "Laura Gómez", "Pedro Sánchez", "Isabel Jiménez", "Miguel Torres", "Sofía Castillo", "Daniel Ramírez", "Camila Reyes", "Andrés Núñez"];
const products = ["Café tostado 1 kg", "Arroz premium 25 lb", "Aceite vegetal 1 gal", "Leche UHT 1 L", "Papel higiénico 12 u", "Detergente 2 kg", "Harina de trigo 5 lb", "Agua mineral 500 ml", "Azúcar crema 5 lb", "Servilletas 200 u", "Habichuelas rojas 1 lb", "Jugo natural 1 L"];
const date = (index: number) => `2026-09-${String(23 - index).padStart(2, "0")}`;

const data: Record<ErpCollection, ErpRecord[]> = {
  purchaseOrders: suppliers.map((supplier, index) => ({ id: `PO-2026-${String(147 - index).padStart(4, "0")}`, date: date(index), supplier, items: 3 + index % 6, amount: 45800 + (11 - index) * 7190, status: ["Por aprobar", "Confirmada", "Recibida", "En tránsito"][index % 4] })),
  salesOrders: customers.map((customer, index) => ({ id: `SO-2026-${String(291 - index).padStart(4, "0")}`, date: date(index), customer, items: 2 + index % 8, amount: 32600 + (11 - index) * 10850, status: ["Por facturar", "Confirmada", "Entregada"][index % 3] })),
  vendorBills: suppliers.map((supplier, index) => ({ id: `BILL-2026-${String(88 - index).padStart(4, "0")}`, date: date(index), supplier, due: `2026-10-${String(12 + index).padStart(2, "0")}`, amount: 29400 + (11 - index) * 6410, status: index % 3 === 0 ? "Pagada" : "Pendiente" })),
  customerInvoices: customers.map((customer, index) => ({ id: `INV-2026-${String(327 - index).padStart(4, "0")}`, date: date(index), customer, due: `2026-10-${String(10 + index).padStart(2, "0")}`, amount: 36500 + (11 - index) * 8840, status: index % 4 === 0 ? "Pagada" : "Por cobrar" })),
  journalEntries: Array.from({ length: 12 }, (_, index) => {
    const group = Math.floor(index / 2);
    const customerSide = group < 3;
    const sourceIndex = customerSide ? group : group - 3;
    const amount = customerSide ? 36500 + (11 - sourceIndex) * 8840 : 29400 + (11 - sourceIndex) * 6410;
    return { id: `JE-2026-${String(441 - index).padStart(4, "0")}`, date: date(group), reference: `${customerSide ? "INV" : "BILL"}-2026-${String((customerSide ? 327 : 88) - sourceIndex).padStart(4, "0")}`, account: customerSide ? index % 2 === 0 ? "Cuentas por cobrar" : "Ingresos por ventas" : index % 2 === 0 ? "Compras de inventario" : "Cuentas por pagar", debit: index % 2 === 0 ? amount : 0, credit: index % 2 === 1 ? amount : 0 };
  }),
  stock: products.map((product, index) => ({ id: `SKU-${String(3201 + index)}`, product, warehouse: index % 2 ? "Santiago" : "Santo Domingo", available: [4, 7, 11, 16, 20, 8, 3, 24, 14, 6, 18, 9][index], minimum: 12, unitCost: 95 + index * 42, status: [4, 7, 11, 16, 20, 8, 3, 24, 14, 6, 18, 9][index] < 12 ? "Reponer" : "Disponible" })),
  payroll: employees.map((employee, index) => ({ id: `EMP-${String(101 + index)}`, employee, department: ["Ventas", "Compras", "Contabilidad", "Almacén"][index % 4], gross: 42000 + (11 - index) * 2850, deductions: 3800 + index * 270, net: 38200 + (11 - index) * 2850 - index * 270, status: "Calculada" })),
  attendance: employees.map((employee, index) => ({ id: `ATT-${String(901 + index)}`, date: date(index), employee, department: ["Ventas", "Compras", "Contabilidad", "Almacén"][index % 4], checkIn: index % 4 === 0 ? "08:18" : "07:58", checkOut: "17:02", status: index % 4 === 0 ? "Tardanza" : "A tiempo" })),
};

export const demoErpProvider: ErpReadProvider = { list: (collection) => data[collection] };
