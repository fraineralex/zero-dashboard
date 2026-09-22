import { describe, expect, it } from "vitest";
import { calculateAnalytics } from "@/lib/analytics/engine";
import { generateDataset } from "@/lib/dataset/seed";

describe("deterministic analytics", () => {
  it("generates the requested reproducible customer scale", () => {
    const first = generateDataset();
    const second = generateDataset();
    expect(first).toHaveLength(2481);
    expect(second[100].mrrHistory).toEqual(first[100].mrrHistory);
  });

  it("derives the enterprise decline from seeded records", () => {
    const analytics = calculateAnalytics();
    expect(analytics.enterprise.current).toBeLessThan(analytics.enterprise.previous);
    expect(analytics.enterprise.customers[0].decline).toBeLessThan(0);
    expect(analytics.enterprise.customers.some((row) => row.id === "acme")).toBe(true);
  });

  it("keeps the Acme story internally consistent", () => {
    const analytics = calculateAnalytics();
    expect(analytics.acme.mrr).toBe(4200);
    expect(analytics.acme.arr).toBe(50400);
    expect(analytics.acme.failedPayments).toBe(3);
    expect(analytics.acme.usageDelta).toBeLessThan(-40);
  });
});
