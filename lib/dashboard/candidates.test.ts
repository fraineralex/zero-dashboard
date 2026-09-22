import { describe, expect, it } from "vitest";
import { resolveCandidates } from "@/lib/dashboard/candidates";
import { createContext } from "@/lib/dashboard/context";

describe("candidate resolver", () => {
  it("keeps Jev's candidate set small and configured", () => {
    const context = { ...createContext("revenue"), segment: "Enterprise" as const, investigation: "enterprise_decline" as const };
    const result = resolveCandidates(context, "why did enterprise revenue drop");
    expect(result.candidates.length).toBeGreaterThan(5);
    expect(result.candidates.length).toBeLessThanOrEqual(20);
    expect(result.candidates.every((candidate) => candidate.element.props && candidate.description)).toBe(true);
    expect(result.candidates.some((candidate) => candidate.element.type === "InvestigationLayout")).toBe(true);
  });
});
