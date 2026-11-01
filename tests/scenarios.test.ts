import { describe, expect, it } from "vitest";
import { distributeCapped, evaluateScenario, type ScenarioBase } from "@/lib/domain/scenarios";
import { samplePlan } from "./helpers";

function base(type: "wedding" | "birthday" | "community" = "wedding"): ScenarioBase {
  const state = samplePlan(type);
  return {
    type,
    currency: "INR",
    total: state.brief.budget,
    guests: state.brief.guests,
    allocations: state.allocations,
  };
}

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

describe("distributeCapped", () => {
  it("distributes in proportion to weights without exceeding caps", () => {
    const result = distributeCapped(100, [1000, 1000], [1, 1]);
    expect(result).toEqual([50, 50]);
  });
  it("re-spreads the remainder when one entry hits its cap (water-filling)", () => {
    const result = distributeCapped(100, [10, 1000], [1, 1]);
    expect(result).toEqual([10, 90]);
  });
  it("stops at the total capacity when the amount is larger", () => {
    const result = distributeCapped(1000, [30, 20], [1, 1]);
    expect(result).toEqual([30, 20]);
  });
  it("ignores zero-cap and zero-weight entries", () => {
    expect(distributeCapped(10, [0, 100], [5, 5])).toEqual([0, 10]);
    expect(distributeCapped(10, [100, 100], [0, 0])).toEqual([0, 0]);
  });
});

describe("evaluateScenario: no change", () => {
  it("balances exactly with a single 'keep as is' option", () => {
    const b = base();
    const result = evaluateScenario(b, {});
    expect(result.gap).toBe(0);
    expect(result.options.map((o) => o.id)).toEqual(["as-is"]);
    expect(sum(result.options[0]!.allocations.map((a) => a.planned))).toBe(b.total);
  });
});

describe("evaluateScenario: budget falls 20%", () => {
  const b = base();
  const result = evaluateScenario(b, { total: Math.round(b.total * 0.8) });

  it("reports the gap and offers every way to close it", () => {
    expect(result.gap).toBe(b.total - Math.round(b.total * 0.8));
    expect(result.options.map((o) => o.id)).toEqual(["protect-priorities", "spread-evenly", "fewer-guests", "raise-budget"]);
  });

  it("protect-priorities closes the gap, cutting flexible decor first and hardest", () => {
    const option = result.options.find((o) => o.id === "protect-priorities")!;
    expect(option.unresolved).toBe(0);
    expect(sum(option.allocations.map((a) => a.planned))).toBe(result.total);
    const fraction = (id: string) => (option.cuts.find((cut) => cut.id === id)?.amount ?? 0) / result.rows.find((r) => r.id === id)!.required;
    expect(fraction("decor")).toBeGreaterThan(0.4);
    expect(option.summary).toContain("Decor & flowers");
    // Protected lines give up proportionally less than the flexible one.
    for (const id of b.allocations.filter((a) => a.priority === "protect").map((a) => a.id)) {
      expect(fraction(id)).toBeLessThan(fraction("decor"));
      expect(fraction(id)).toBeLessThanOrEqual(0.15);
    }
  });

  it("leaves protected categories completely untouched when a smaller cut can be absorbed elsewhere", () => {
    const gentle = evaluateScenario(b, { total: Math.round(b.total * 0.9) });
    const option = gentle.options.find((o) => o.id === "protect-priorities")!;
    expect(option.unresolved).toBe(0);
    for (const id of b.allocations.filter((a) => a.priority === "protect").map((a) => a.id)) {
      expect(option.cuts.find((cut) => cut.id === id)).toBeUndefined();
    }
  });

  it("never cuts a category below its cap", () => {
    for (const option of result.options.filter((o) => o.cuts.length > 0)) {
      for (const cut of option.cuts) {
        const row = result.rows.find((r) => r.id === cut.id)!;
        expect(cut.amount).toBeLessThanOrEqual(Math.floor(row.required * 0.6));
      }
    }
  });

  it("spread-evenly cuts several unprotected categories", () => {
    const option = result.options.find((o) => o.id === "spread-evenly")!;
    expect(option.cuts.length).toBeGreaterThan(2);
    expect(option.unresolved).toBe(0);
    expect(sum(option.allocations.map((a) => a.planned))).toBe(result.total);
  });

  it("fewer-guests keeps categories and balances at a smaller guest count", () => {
    const option = result.options.find((o) => o.id === "fewer-guests")!;
    expect(option.guests).toBeLessThan(b.guests);
    expect(option.unresolved).toBe(0);
    expect(sum(option.allocations.map((a) => a.planned))).toBe(result.total);
  });

  it("raise-budget raises the total to what the plan needs", () => {
    const option = result.options.find((o) => o.id === "raise-budget")!;
    expect(option.total).toBe(result.requiredTotal);
    expect(sum(option.allocations.map((a) => a.planned))).toBe(option.total);
  });
});

describe("evaluateScenario: more guests", () => {
  it("scales guest-driven categories more than fixed ones", () => {
    const b = base();
    const result = evaluateScenario(b, { guests: 250 });
    const catering = result.rows.find((r) => r.id === "catering")!;
    const photo = result.rows.find((r) => r.id === "photo_video")!;
    const attire = result.rows.find((r) => r.id === "attire_beauty")!;
    expect(catering.required).toBe(Math.round(catering.planned * 1.25));
    expect(photo.required).toBeGreaterThan(photo.planned);
    expect(photo.required / photo.planned).toBeLessThan(1.05);
    expect(attire.required).toBe(attire.planned);
    expect(result.gap).toBeGreaterThan(0);
  });
});

describe("evaluateScenario: spending more on one category", () => {
  it("shows the cost of extra photography and where it would come from", () => {
    const b = base();
    const result = evaluateScenario(b, { categoryDeltas: { photo_video: 30_000 } });
    expect(result.gap).toBe(30_000);
    const option = result.options.find((o) => o.id === "protect-priorities")!;
    expect(option.unresolved).toBe(0);
    expect(option.cuts.every((cut) => cut.id !== "photo_video")).toBe(true);
    const photo = option.allocations.find((a) => a.id === "photo_video")!;
    expect(photo.planned).toBe(b.allocations.find((a) => a.id === "photo_video")!.planned + 30_000);
  });
});

describe("evaluateScenario: surplus", () => {
  it("offers to buffer or reinvest, and both fully allocate the budget", () => {
    const b = base();
    const result = evaluateScenario(b, { total: b.total + 50_000 });
    expect(result.gap).toBe(-50_000);
    expect(result.options.map((o) => o.id)).toEqual(["keep-buffer", "reinvest"]);
    for (const option of result.options) expect(sum(option.allocations.map((a) => a.planned))).toBe(result.total);
    const reinvest = result.options.find((o) => o.id === "reinvest")!;
    expect(reinvest.summary).toContain("Food & catering");
  });
});

describe("evaluateScenario: extreme budget cuts", () => {
  it("reports an unresolved shortfall instead of pretending the plan balances", () => {
    const b = base();
    const result = evaluateScenario(b, { total: Math.round(b.total * 0.3) });
    const option = result.options.find((o) => o.id === "protect-priorities")!;
    expect(option.unresolved).toBeGreaterThan(0);
    expect(option.summary).toContain("over budget");
  });

  it("omits the fewer-guests option when even one guest cannot fit", () => {
    const b = base();
    const result = evaluateScenario(b, { total: 1000 });
    expect(result.options.some((o) => o.id === "fewer-guests")).toBe(false);
  });
});

describe("evaluateScenario: other event types", () => {
  it.each(["birthday", "community"] as const)("balances a 15 percent budget cut for %s", (type) => {
    const b = base(type);
    const result = evaluateScenario(b, { total: Math.round(b.total * 0.85) });
    const option = result.options.find((o) => o.id === "protect-priorities")!;
    expect(option.unresolved).toBe(0);
    expect(sum(option.allocations.map((a) => a.planned))).toBe(result.total);
  });
});
