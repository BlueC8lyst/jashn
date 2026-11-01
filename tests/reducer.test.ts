import { describe, expect, it } from "vitest";
import { reduce, type Action } from "@/lib/domain/reducer";
import { LIMITS } from "@/lib/domain/types";
import type { Quote } from "@/lib/domain/types";
import { NOW_ISO, TODAY, samplePlan } from "./helpers";

const quote = (id: string, over: Partial<Quote> = {}): Quote => ({
  id,
  vendorName: `Vendor ${id}`,
  pricing: "flat",
  amount: 1000,
  inclusions: [],
  exclusions: [],
  extras: [],
  ...over,
});

const run = (state = samplePlan(), ...actions: Action[]) => actions.reduce((s, a) => reduce(s, a, NOW_ISO), state);

describe("tasks", () => {
  it("marks done and reopens", () => {
    const done = run(undefined, { type: "task/done", id: "budget-guests", on: TODAY });
    expect(done.progress["budget-guests"]).toEqual({ status: "done", doneOn: TODAY });
    const reopened = reduce(done, { type: "task/reopen", id: "budget-guests" }, NOW_ISO);
    expect(reopened.progress).toEqual({});
    expect(reduce(reopened, { type: "task/reopen", id: "budget-guests" }, NOW_ISO)).toBe(reopened);
  });

  it("records and clears a delay, but ignores delays on finished tasks", () => {
    const delayed = run(undefined, { type: "task/delay", id: "book-venue", to: "2027-01-01" });
    expect(delayed.progress["book-venue"]).toEqual({ status: "todo", delayedTo: "2027-01-01" });
    const cleared = reduce(delayed, { type: "task/delay", id: "book-venue", to: null }, NOW_ISO);
    expect(cleared.progress["book-venue"]).toBeUndefined();
    expect(reduce(cleared, { type: "task/delay", id: "book-venue", to: null }, NOW_ISO)).toBe(cleared);
    const done = run(undefined, { type: "task/done", id: "book-venue", on: TODAY });
    expect(reduce(done, { type: "task/delay", id: "book-venue", to: "2027-01-01" }, NOW_ISO)).toBe(done);
  });
});

describe("budget", () => {
  it("changes a priority (not the contingency) and rebalances", () => {
    const state = samplePlan();
    const next = reduce(state, { type: "budget/priority", id: "venue", priority: "protect" }, NOW_ISO);
    expect(next.allocations.find((a) => a.id === "venue")?.priority).toBe("protect");
    expect(reduce(next, { type: "budget/priority", id: "venue", priority: "protect" }, NOW_ISO)).toBe(next);
    expect(reduce(state, { type: "budget/priority", id: "contingency", priority: "protect" }, NOW_ISO)).toBe(state);
    expect(reduce(state, { type: "budget/priority", id: "nope", priority: "protect" }, NOW_ISO)).toBe(state);

    const rebalanced = reduce(next, { type: "budget/rebalance" }, NOW_ISO);
    expect(rebalanced.allocations.reduce((s, a) => s + a.planned, 0)).toBe(state.brief.budget);
    expect(rebalanced.allocations.find((a) => a.id === "venue")!.planned).toBeGreaterThan(
      state.allocations.find((a) => a.id === "venue")!.planned,
    );
  });
});

describe("vendors", () => {
  it("saving a quote moves the vendor to 'quotes received' and updating replaces in place", () => {
    const one = run(undefined, { type: "vendor/saveQuote", typeId: "caterer", quote: quote("a") });
    expect(one.vendors.find((v) => v.typeId === "caterer")?.status).toBe("quotes_in");
    const updated = reduce(one, { type: "vendor/saveQuote", typeId: "caterer", quote: quote("a", { amount: 5 }) }, NOW_ISO);
    const track = updated.vendors.find((v) => v.typeId === "caterer")!;
    expect(track.quotes).toHaveLength(1);
    expect(track.quotes[0]!.amount).toBe(5);
  });

  it("caps the number of quotes per vendor", () => {
    let state = samplePlan();
    for (let i = 0; i < LIMITS.quotesPerVendor + 3; i++) {
      state = reduce(state, { type: "vendor/saveQuote", typeId: "caterer", quote: quote(`q${i}`) }, NOW_ISO);
    }
    expect(state.vendors.find((v) => v.typeId === "caterer")!.quotes).toHaveLength(LIMITS.quotesPerVendor);
  });

  it("booking, unbooking and removing a booked quote keep statuses consistent", () => {
    let state = run(undefined, { type: "vendor/saveQuote", typeId: "caterer", quote: quote("a") }, { type: "vendor/saveQuote", typeId: "caterer", quote: quote("b") });
    state = reduce(state, { type: "vendor/book", typeId: "caterer", quoteId: "a" }, NOW_ISO);
    let track = state.vendors.find((v) => v.typeId === "caterer")!;
    expect(track.status).toBe("booked");
    expect(track.bookedQuoteId).toBe("a");
    expect(state.log[0]!.text).toBe("Marked Vendor a as booked.");

    state = reduce(state, { type: "vendor/book", typeId: "caterer", quoteId: null }, NOW_ISO);
    track = state.vendors.find((v) => v.typeId === "caterer")!;
    expect(track.status).toBe("quotes_in");

    state = reduce(state, { type: "vendor/book", typeId: "caterer", quoteId: "b" }, NOW_ISO);
    state = reduce(state, { type: "vendor/removeQuote", typeId: "caterer", quoteId: "b" }, NOW_ISO);
    track = state.vendors.find((v) => v.typeId === "caterer")!;
    expect(track.bookedQuoteId).toBeNull();
    expect(track.status).toBe("quotes_in");

    state = reduce(state, { type: "vendor/removeQuote", typeId: "caterer", quoteId: "a" }, NOW_ISO);
    expect(state.vendors.find((v) => v.typeId === "caterer")!.quotes).toHaveLength(0);
  });

  it("ignores unknown vendors and unknown quotes", () => {
    const state = samplePlan();
    expect(reduce(state, { type: "vendor/status", typeId: "zzz", status: "booked" }, NOW_ISO)).toBe(state);
    expect(reduce(state, { type: "vendor/book", typeId: "caterer", quoteId: "missing" }, NOW_ISO)).toBe(state);
    expect(reduce(state, { type: "vendor/removeQuote", typeId: "caterer", quoteId: "missing" }, NOW_ISO)).toBe(state);
  });

  it("updates status and bounded notes", () => {
    const state = run(undefined, { type: "vendor/status", typeId: "venue", status: "shortlisting" }, { type: "vendor/notes", typeId: "venue", notes: "x".repeat(5000) });
    const track = state.vendors.find((v) => v.typeId === "venue")!;
    expect(track.status).toBe("shortlisting");
    expect(track.notes.length).toBe(LIMITS.noteMax * 4);
    expect(reduce(state, { type: "vendor/status", typeId: "venue", status: "shortlisting" }, NOW_ISO)).toBe(state);
  });
});

describe("direction, personalisation and log", () => {
  it("chooses and clears a direction", () => {
    const chosen = run(undefined, { type: "direction/choose", direction: { title: "Garden", summary: "Green." } });
    expect(chosen.direction?.title).toBe("Garden");
    expect(chosen.log[0]!.text).toContain("Garden");
    expect(reduce(chosen, { type: "direction/choose", direction: null }, NOW_ISO).direction).toBeNull();
  });

  it("updates personalisation", () => {
    const state = samplePlan();
    const next = reduce(state, { type: "personalisation/update", value: { ...state.brief.personalisation, atmosphere: "cozy" } }, NOW_ISO);
    expect(next.brief.personalisation.atmosphere).toBe("cozy");
  });

  it("bounds the change log", () => {
    let state = samplePlan();
    for (let i = 0; i < 60; i++) state = reduce(state, { type: "budget/rebalance" }, NOW_ISO);
    expect(state.log).toHaveLength(LIMITS.logEntries);
  });

  it("never mutates its input", () => {
    const state = samplePlan();
    const snapshot = JSON.stringify(state);
    run(state, { type: "task/done", id: "budget-guests", on: TODAY }, { type: "budget/rebalance" }, { type: "vendor/saveQuote", typeId: "caterer", quote: quote("a") });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
