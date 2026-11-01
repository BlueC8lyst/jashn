import { describe, expect, it } from "vitest";
import { allocateByWeights, clamp, formatMoney, formatMoneyCompact, percentOf } from "@/lib/domain/money";

describe("allocateByWeights", () => {
  it("always sums to the total (randomised property check)", () => {
    let seed = 42;
    const random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let run = 0; run < 500; run++) {
      const count = 1 + Math.floor(random() * 12);
      const weights = Array.from({ length: count }, () => random() * 100);
      const total = Math.floor(random() * 5_000_000);
      const result = allocateByWeights(total, weights);
      expect(result.reduce((a, b) => a + b, 0)).toBe(total);
      expect(result.every((value) => Number.isInteger(value) && value >= 0)).toBe(true);
    }
  });

  it("splits proportionally and breaks ties towards the earlier index", () => {
    expect(allocateByWeights(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateByWeights(10, [3, 1])).toEqual([8, 2]);
  });

  it("splits evenly when every weight is zero", () => {
    expect(allocateByWeights(10, [0, 0])).toEqual([5, 5]);
  });

  it("handles empty input and zero totals", () => {
    expect(allocateByWeights(50, [])).toEqual([]);
    expect(allocateByWeights(0, [1, 2, 3])).toEqual([0, 0, 0]);
  });

  it("rejects invalid input", () => {
    expect(() => allocateByWeights(-1, [1])).toThrow(RangeError);
    expect(() => allocateByWeights(1.5, [1])).toThrow(RangeError);
    expect(() => allocateByWeights(10, [-1, 2])).toThrow(RangeError);
    expect(() => allocateByWeights(10, [Number.NaN])).toThrow(RangeError);
  });
});

describe("formatting", () => {
  it("uses Indian digit grouping for rupees", () => {
    expect(formatMoney(800000, "INR")).toBe("₹8,00,000");
  });
  it("formats other currencies and compact amounts", () => {
    expect(formatMoney(1500, "USD")).toBe("$1,500");
    expect(formatMoneyCompact(800000, "INR")).toMatch(/₹8L|₹8 ?L/);
  });
  it("reuses formatters (same output on repeat calls)", () => {
    expect(formatMoney(1, "EUR")).toBe(formatMoney(1, "EUR"));
  });
});

describe("helpers", () => {
  it("percentOf guards against a zero whole", () => {
    expect(percentOf(1, 0)).toBe(0);
    expect(percentOf(1, 4)).toBe(25);
  });
  it("clamp bounds values", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
