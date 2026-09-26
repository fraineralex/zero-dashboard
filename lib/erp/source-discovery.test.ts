import { describe, expect, it } from "vitest";
import { businessSources, discoverBusinessSources, looksLikeBusinessQuestion } from "@/lib/erp/source-discovery";

describe("semantic ERP source discovery", () => {
  it.each([
    ["grafico de torta con el porcentage que se lleva cada deparmento en nomina", "payroll"],
    ["¿Qué suplidores concentran más cuentas por pagar?", "vendorBills"],
    ["¿Quiénes llegaron tarde al trabajo?", "attendance"],
    ["Dame los productos agotados", "stock"],
    ["Reparte las ventas por artículo", "salesLines"],
    ["¿Cuánto fue a TSS patronal?", "payrollTaxPayments"],
  ])("discovers %s", (intent, source) => {
    expect(discoverBusinessSources(intent)).toContain(source);
    expect(looksLikeBusinessQuestion(intent)).toBe(true);
  });

  it("offers the full factual catalog for unfamiliar business phrasing", () => {
    expect(discoverBusinessSources("¿Cuál fue el movimiento de caja de la quincena?")).toHaveLength(businessSources.length);
    expect(looksLikeBusinessQuestion("¿Cuál fue el movimiento de caja de la quincena?")).toBe(true);
    expect(looksLikeBusinessQuestion("Analyze churn and cohort retention")).toBe(false);
  });
});
