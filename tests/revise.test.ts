import { describe, expect, it } from "vitest";
import { addDays, diffDays } from "@/lib/domain/dates";
import { reduce } from "@/lib/domain/reducer";
import { previewRevision, resolveRevision, validateRevision } from "@/lib/domain/revise";
import { scheduleFor } from "@/lib/domain/plan";
import type { PlannerState, Quote } from "@/lib/domain/types";
import { NOW_ISO, TODAY, samplePlan } from "./helpers";

const quote: Quote = {
  id: "q1",
  vendorName: "Sharma Caterers",
  pricing: "per_guest",
  amount: 950,
  guestsCovered: 200,
  inclusions: ["Crockery"],
  exclusions: [],
  extras: [],
};

/** A plan that is already under way: tasks done, a vendor booked, a direction chosen. */
function livePlan(): PlannerState {
  let state = samplePlan("wedding");
  state = reduce(state, { type: "task/done", id: "budget-guests", on: TODAY }, NOW_ISO);
  state = reduce(state, { type: "task/done", id: "venue-shortlist", on: TODAY }, NOW_ISO);
  state = reduce(state, { type: "vendor/saveQuote", typeId: "caterer", quote }, NOW_ISO);
  state = reduce(state, { type: "vendor/book", typeId: "caterer", quoteId: "q1" }, NOW_ISO);
  state = reduce(state, { type: "direction/choose", direction: { title: "Courtyard evening", summary: "Intimate and warm." } }, NOW_ISO);
  return state;
}

describe("validateRevision", () => {
  it("accepts sensible changes", () => {
    expect(validateRevision({ date: addDays(TODAY, 30), guests: 120, budget: 500_000 }, TODAY)).toEqual([]);
  });
  it("rejects past dates, fractional or out-of-range guests and non-positive budgets", () => {
    expect(validateRevision({ date: addDays(TODAY, -1) }, TODAY)).toHaveLength(1);
    expect(validateRevision({ guests: 0 }, TODAY)).toHaveLength(1);
    expect(validateRevision({ guests: 2.5 }, TODAY)).toHaveLength(1);
    expect(validateRevision({ guests: 99999 }, TODAY)).toHaveLength(1);
    expect(validateRevision({ budget: 0 }, TODAY)).toHaveLength(1);
  });
  it("preview throws RangeError for an invalid change", () => {
    expect(() => previewRevision(samplePlan(), { guests: -4 }, TODAY)).toThrow(RangeError);
  });
});

describe("re-planning: budget falls and the event moves two weeks earlier", () => {
  const state = livePlan();
  const newDate = addDays(state.brief.date, -14);
  const newBudget = 600_000;
  const preview = previewRevision(state, { date: newDate, budget: newBudget }, TODAY);

  it("explains what changed in plain language", () => {
    const text = preview.summary.join(" ");
    expect(text).toMatch(/14 days earlier/);
    expect(text).toMatch(/Budget changes from ₹8,00,000 to ₹6,00,000/);
    expect(text).toMatch(/needs ₹2,00,000 more than the budget/);
    expect(text).toMatch(/earlier deadlines/);
  });

  it("moves open tasks earlier without touching completed ones", () => {
    expect(preview.moves.length).toBeGreaterThan(0);
    expect(preview.moves.every((m) => m.shiftDays < 0)).toBe(true);
    expect(preview.moves.some((m) => m.id === "budget-guests" || m.id === "venue-shortlist")).toBe(false);
    expect(preview.scheduleAfter.daysAvailable).toBe(preview.scheduleBefore.daysAvailable - 14);
  });

  it("offers ways to close the budget gap and nothing is committed yet", () => {
    expect(preview.scenario?.gap).toBe(200_000);
    expect(preview.scenario?.options.length).toBeGreaterThanOrEqual(3);
    expect(state.brief.budget).toBe(800_000);
  });

  it("applying the revision keeps progress, bookings and the chosen direction", () => {
    const applied = resolveRevision(preview, state, "protect-priorities");
    const next = reduce(state, { type: "plan/revise", ...applied }, NOW_ISO);

    expect(next.brief.date).toBe(newDate);
    expect(next.brief.budget).toBe(newBudget);
    expect(next.allocations.reduce((sum, a) => sum + a.planned, 0)).toBe(newBudget);

    expect(next.progress).toEqual(state.progress);
    expect(next.vendors.find((v) => v.typeId === "caterer")?.bookedQuoteId).toBe("q1");
    expect(next.direction?.title).toBe("Courtyard evening");
    expect(next.log[0]!.text).toMatch(/Changed date to .*budget to ₹6,00,000 \(“Protect what matters most”\)/);

    // The new timeline is built from the preserved progress, not from scratch.
    const schedule = scheduleFor(next, TODAY);
    expect(schedule.doneCount).toBe(2);
    expect(diffDays(TODAY, next.brief.date)).toBe(schedule.daysAvailable);
  });

  it("choosing 'trim the guest list' lowers the guest count and balances the budget", () => {
    const applied = resolveRevision(preview, state, "fewer-guests");
    expect(applied.brief.guests).toBeLessThan(state.brief.guests);
    expect(applied.allocations.reduce((s, a) => s + a.planned, 0)).toBe(newBudget);
  });

  it("choosing 'raise the budget' restores the plan's needs", () => {
    const applied = resolveRevision(preview, state, "raise-budget");
    expect(applied.brief.budget).toBe(preview.scenario!.requiredTotal);
  });

  it("falls back to the first option when none is named", () => {
    const applied = resolveRevision(preview, state);
    expect(applied.note).toContain("Protect what matters most");
  });
});

describe("re-planning: other changes", () => {
  it("a date change alone has no budget scenario", () => {
    const state = samplePlan();
    const preview = previewRevision(state, { date: addDays(state.brief.date, 30) }, TODAY);
    expect(preview.scenario).toBeNull();
    expect(preview.summary.join(" ")).toMatch(/30 days later/);
  });

  it("a very short runway says so plainly instead of pretending everything fits", () => {
    const state = samplePlan();
    const preview = previewRevision(state, { date: addDays(TODAY, 20) }, TODAY);
    const text = preview.summary.join(" ");
    expect(text).toMatch(/compressed to \d+% of normal/);
    expect(text).toMatch(/very tight runway/);
    expect(preview.scheduleAfter.compression).toBeLessThan(0.35);
  });

  it("more time restores the full lead times", () => {
    const state = previewRevision(samplePlan(), { date: addDays(TODAY, 20) }, TODAY);
    expect(state.scheduleAfter.compressed).toBe(true);
    const again = previewRevision(
      reduce(samplePlan(), { type: "plan/revise", brief: { ...samplePlan().brief, date: addDays(TODAY, 20) }, allocations: samplePlan().allocations, note: "x" }, NOW_ISO),
      { date: addDays(TODAY, 330) },
      TODAY,
    );
    expect(again.summary.join(" ")).toMatch(/full recommended lead times/);
  });

  it("a larger budget leaves a surplus to place", () => {
    const state = samplePlan();
    const preview = previewRevision(state, { budget: 900_000 }, TODAY);
    expect(preview.summary.join(" ")).toMatch(/unallocated/);
    const applied = resolveRevision(preview, state, "keep-buffer");
    expect(applied.allocations.reduce((s, a) => s + a.planned, 0)).toBe(900_000);
  });

  it("no change reports nothing changes", () => {
    const state = samplePlan();
    const preview = previewRevision(state, {}, TODAY);
    expect(preview.summary).toEqual(["Nothing changes in the plan."]);
    expect(resolveRevision(preview, state).note).toBe("Reviewed the plan; nothing changed.");
  });
});
