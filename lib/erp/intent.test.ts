import { describe, expect, it } from "vitest";
import { buildErpSpec, parseErpIntent } from "@/lib/erp/intent";
import { requestFidelityIssue } from "@/lib/dashboard/fidelity";

const cases = [
  ["Últimas 10 órdenes de compra a proveedores", "purchaseOrders", "supplier"],
  ["dejame ver las ultimas 10 ordenes de compra proveedores", "purchaseOrders", "supplier"],
  ["Muéstrame 5 pedidos de compra", "purchaseOrders", "supplier"],
  ["Últimas 10 órdenes de venta", "salesOrders", "customer"],
  ["Últimas facturas de proveedores", "vendorBills", "supplier"],
  ["Facturas por pagar", "vendorBills", "supplier"],
  ["Últimas facturas de clientes", "customerInvoices", "customer"],
  ["Cuentas por cobrar", "customerInvoices", "customer"],
  ["Últimos 10 asientos contables", "journalEntries", "account"],
  ["Productos con inventario bajo", "stock", "product"],
  ["Muéstrame la nómina de empleados", "payroll", "employee"],
  ["Últimos registros de asistencia", "attendance", "employee"],
] as const;

describe("ERP request fidelity", () => {
  it.each(cases)("serves %s from %s", (intent, collection, entityKey) => {
    const result = buildErpSpec(intent);
    expect(parseErpIntent(intent)?.collection).toBe(collection);
    expect(result).not.toBeNull();
    const table = result!.elements.records;
    const rows = table.props.data as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => Boolean(row[entityKey]))).toBe(true);
    expect(requestFidelityIssue(intent, result!)).toBeNull();
  });

  it("returns exactly ten recent purchase orders with supplier, date and RD$ amounts", () => {
    const result = buildErpSpec("Últimas 10 órdenes de compra a proveedores")!;
    const rows = result.elements.records.props.data as Record<string, unknown>[];
    expect(rows).toHaveLength(10);
    expect(rows[0]).toMatchObject({ id: "PO-2026-0147", date: "2026-09-23", supplier: "Distribuidora Cibao SRL" });
    expect(rows.every((row, index) => index === 0 || String(rows[index - 1].date) >= String(row.date))).toBe(true);
    expect(result.elements.records.props.currency).toBe("DOP");
    expect((result.elements.records.props.columns as { key: string }[]).map((column) => column.key)).toEqual(["id", "date", "supplier", "items", "amount", "status"]);
  });

  it("never accepts a customer table as an answer to supplier purchases", () => {
    const purchase = buildErpSpec("Últimas 10 órdenes de compra a proveedores")!;
    const sales = buildErpSpec("Últimas 10 órdenes de venta")!;
    expect(requestFidelityIssue("Últimas 10 órdenes de compra a proveedores", sales)).toContain("módulo ERP");
    expect(requestFidelityIssue("Últimas 10 órdenes de compra a proveedores", purchase)).toBeNull();
  });

  it("compares sales and purchases on one chart without inventing another module", () => {
    const result = buildErpSpec("Compara compras y ventas")!;
    expect(result.elements.chart.type).toBe("LineChartCard");
    expect((result.elements.chart.props.series as { key: string }[]).map((item) => item.key)).toEqual(["ventas", "compras"]);
    expect(requestFidelityIssue("Compara compras y ventas", result)).toBeNull();
  });

  it("groups purchase amounts by supplier", () => {
    const result = buildErpSpec("Compras por proveedor")!;
    expect(result.elements.chart.type).toBe("BarChartCard");
    expect((result.elements.chart.props.data as { name: string }[])[0].name).toBe("Cibao");
    expect((result.elements.records.props.data as { supplier: string }[])[0].supplier).toBe("Distribuidora Cibao SRL");
    expect(requestFidelityIssue("Compras por proveedor", result)).toBeNull();
  });

  it("does not silently replace unavailable count or month", () => {
    const tooMany = "Últimas 20 órdenes de compra a proveedores";
    const pastMonth = "Órdenes de compra a proveedores de agosto";
    expect(requestFidelityIssue(tooMany, buildErpSpec(tooMany)!)).toContain("20 registros");
    expect(requestFidelityIssue(pastMonth, buildErpSpec(pastMonth)!)).toContain("septiembre de 2026");
  });

  it("does not present an incomplete sample as a formal financial statement", () => {
    const sample = buildErpSpec("Últimos 10 asientos contables")!;
    expect(sample.elements.root.props.title).toBe("Últimos 10 asientos contables");
    expect(requestFidelityIssue("Muéstrame el estado de resultados", sample)).toContain("cierre contable completo");
  });
});
