import { describe, expect, it } from "vitest";
import { initialAllocations, rebalanceAllocations, summariseBudget } from "@/lib/domain/budget";
import { CATEGORIES } from "@/lib/domain/catalog/categories";
import { EVENT_TYPES } from "@/lib/domain/types";
import type { Quote } from "@/lib/domain/types";
import { samplePlan } from "./helpers";

const quote = (overrides: Partial<Quote> = {}): Quote => ({
  id: "q1",
  vendorName: "Sharma Caterers",
  pricing: "per_guest",
  amount: 950,
  inclusions: [],
  exclusions: [],
  extras: [],
  ...overrides,
});

describe("initialAllocations", () => {
  it.each(EVENT_TYPES)("sums exactly to the budget for %s, for awkward totals too", (type) => {
    for (const total of [1, 999, 60_000, 800_000, 1_234_567]) {
      const plans = initialAllocations(type, total, "balanced");
      expect(plans.reduce((sum, plan) => sum + plan.planned, 0)).toBe(total);
      expect(plans.map((p) => p.id)).toEqual(CATEGORIES[type].map((d) => d.id));
    }
  });

  it("reserves a 5% contingency buffer", () => {
    const plans = initialAllocations("wedding", 800_000, "balanced");
    expect(plans.find((p) => p.id === "contingency")?.planned).toBe(40_000);
  });

  it("gives protected categories more and flexible ones less", () => {
    const base = initialAllocations("wedding", 800_000, "balanced");
    const tuned = initialAllocations("wedding", 800_000, "balanced", { catering: "protect", decor: "flexible" });
    const get = (plans: typeof base, id: string) => plans.find((p) => p.id === id)!.planned;
    expect(get(tuned, "catering")).toBeGreaterThan(get(base, "catering"));
    expect(get(tuned, "decor")).toBeLessThan(get(base, "decor"));
    expect(tuned.find((p) => p.id === "catering")?.priority).toBe("protect");
  });

  it("a simple feel spends less on ambience and a premium feel spends more", () => {
    const decor = (feel: "simple" | "balanced" | "premium") =>
      initialAllocations("wedding", 800_000, feel).find((p) => p.id === "decor")!.planned;
    expect(decor("simple")).toBeLessThan(decor("balanced"));
    expect(decor("premium")).toBeGreaterThan(decor("balanced"));
  });

  it("rebalancing keeps the chosen priorities", () => {
    const state = samplePlan("wedding");
    const again = rebalanceAllocations(state.brief, state.allocations);
    expect(again).toEqual(state.allocations);
  });
});

describe("summariseBudget", () => {
  it("is pure estimate with nothing quoted", () => {
    const state = samplePlan("wedding");
    const summary = summariseBudget(state);
    expect(summary.plannedTotal).toBe(state.brief.budget);
    expect(summary.projectedTotal).toBe(state.brief.budget);
    expect(summary.headroom).toBe(0);
    expect(summary.rows.every((row) => row.basis === "estimate")).toBe(true);
    expect(summary.perGuestPlanned).toBe(4000);
  });

  it("uses the lowest comparable quote and labels it a quote, not a fact", () => {
    const state = samplePlan("wedding");
    const vendors = state.vendors.map((track) =>
      track.typeId === "caterer"
        ? { ...track, quotes: [quote({ id: "a", amount: 1100 }), quote({ id: "b", amount: 950 })] }
        : track,
    );
    const summary = summariseBudget({ ...state, vendors });
    const catering = summary.rows.find((row) => row.id === "catering")!;
    expect(catering.basis).toBe("quote");
    expect(catering.projected).toBe(950 * 200);
  });

  it("a booked quote takes precedence and is labelled booked", () => {
    const state = samplePlan("wedding");
    const vendors = state.vendors.map((track) =>
      track.typeId === "caterer"
        ? { ...track, status: "booked" as const, bookedQuoteId: "b", quotes: [quote({ id: "a", amount: 800 }), quote({ id: "b", amount: 1000 })] }
        : track,
    );
    const catering = summariseBudget({ ...state, vendors }).rows.find((row) => row.id === "catering")!;
    expect(catering.basis).toBe("booked");
    expect(catering.projected).toBe(200_000);
  });

  it("reports negative headroom when quotes exceed the budget", () => {
    const state = samplePlan("wedding");
    const vendors = state.vendors.map((track) =>
      track.typeId === "caterer" ? { ...track, quotes: [quote({ amount: 2500 })] } : track,
    );
    const summary = summariseBudget({ ...state, vendors });
    expect(summary.headroom).toBeLessThan(0);
  });

  it("ignores quotes that cannot be priced yet (per-hour without hours)", () => {
    const state = samplePlan("wedding");
    const vendors = state.vendors.map((track) =>
      track.typeId === "photographer"
        ? { ...track, quotes: [quote({ pricing: "per_hour", amount: 5000 })] }
        : track,
    );
    const row = summariseBudget({ ...state, vendors }).rows.find((r) => r.id === "photo_video")!;
    expect(row.basis).toBe("estimate");
  });
});
