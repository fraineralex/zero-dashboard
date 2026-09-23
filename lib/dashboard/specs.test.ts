import { describe, expect, it } from "vitest";
import { createContext } from "@/lib/dashboard/context";
import { buildIntentSpec } from "@/lib/dashboard/specs";

function chartFrom(spec: ReturnType<typeof buildIntentSpec>) {
  return Object.values(spec.elements).find((element) =>
    ["LineChartCard", "AreaChartCard", "BarChartCard", "ComparisonChart"].includes(element.type),
  );
}

describe("intent-driven canvas composition", () => {
  it("understands a Spanish request for daily cash-in", () => {
    const spec = buildIntentSpec("Quiero ver la entrada de dinero dia a dia", createContext("revenue"));
    const chart = chartFrom(spec);

    expect(spec.root).toBe("root");
    expect(spec.elements.root.props.title).toContain("Cash in");
    expect(chart?.props.xKey).toBe("day");
    expect(chart?.props.series).toEqual([
      expect.objectContaining({ key: "cashIn", label: "Cash in" }),
    ]);
  });

  it("combines heterogeneous measures as separate lines", () => {
    const spec = buildIntentSpec("Combina ingresos, clientes y churn en líneas", createContext("retention"));
    const chart = chartFrom(spec);

    expect(spec.elements.root.props.title).toContain("Revenue");
    expect(chart?.type).toBe("LineChartCard");
    const series = chart?.props.series as Array<{ key: string; axis?: string }>;
    expect(series.map((item) => item.key)).toEqual(["revenue", "customers", "churn"]);
    expect(series.find((item) => item.key === "revenue")?.axis).toBeUndefined();
    expect(series.filter((item) => item.axis === "right")).toHaveLength(2);
  });

  it("adds a new daily measure without discarding the current chart", () => {
    const initial = buildIntentSpec("Quiero ver la entrada de dinero dia a dia", createContext("revenue"));
    const updated = buildIntentSpec("Agrega reembolsos", createContext("revenue"), initial);
    const chart = chartFrom(updated);
    const series = chart?.props.series as Array<{ key: string }>;

    expect(chart?.props.xKey).toBe("day");
    expect(series.map((item) => item.key)).toEqual(["cashIn", "refunds"]);
  });
});
