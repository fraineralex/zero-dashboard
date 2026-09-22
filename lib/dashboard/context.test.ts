import { describe, expect, it } from "vitest";
import { contextFromIntent, createContext } from "@/lib/dashboard/context";
import type { AnalyticsContext } from "@/types/analytics";

describe("analytics context transitions", () => {
  it("supports the exact demo journey", () => {
    let context: AnalyticsContext = { ...createContext("revenue"), segment: "Enterprise" };
    context = contextFromIntent("Show me why enterprise revenue dropped this month", context);
    expect(context.investigation).toBe("enterprise_decline");
    context = contextFromIntent("Which customers are responsible for most of that decline?", context);
    expect(context.investigation).toBe("decline_customers");
    context = contextFromIntent("Open Acme", context);
    expect(context.entityId).toBe("acme");
    context = contextFromIntent("Compare Acme with similar customers", context);
    expect(context.investigation).toBe("cohort_comparison");
  });
});
