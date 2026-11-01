import { describe, expect, it } from "vitest";
import { createPlan } from "@/lib/domain/plan";
import { EventBriefSchema, PersonalisationSchema, PlannerStateSchema, QuoteSchema } from "@/lib/domain/schemas";
import { sampleFor } from "@/lib/domain/samples";
import { EVENT_TYPES } from "@/lib/domain/types";
import { NOW_ISO, TODAY, samplePlan } from "./helpers";

describe("PlannerStateSchema", () => {
  it.each(EVENT_TYPES)("accepts a freshly created %s plan", (type) => {
    expect(PlannerStateSchema.safeParse(samplePlan(type)).success).toBe(true);
  });

  it("survives a JSON round trip (what localStorage does)", () => {
    const state = samplePlan();
    expect(PlannerStateSchema.safeParse(JSON.parse(JSON.stringify(state))).success).toBe(true);
  });

  it("rejects tampered or corrupted state", () => {
    const state = samplePlan();
    const bad = (mutate: (draft: Record<string, unknown>) => void) => {
      const draft = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
      mutate(draft);
      return PlannerStateSchema.safeParse(draft).success;
    };
    expect(bad((d) => (d.version = 2))).toBe(false);
    expect(bad((d) => ((d.brief as Record<string, unknown>).guests = -5))).toBe(false);
    expect(bad((d) => ((d.brief as Record<string, unknown>).date = "2026-02-30"))).toBe(false);
    expect(bad((d) => ((d.brief as Record<string, unknown>).type = "funeral"))).toBe(false);
    expect(bad((d) => (d.extra = "unexpected key"))).toBe(false);
    expect(bad((d) => (d.progress = { "not-a-task": { status: "done" } }))).toBe(false);
    expect(bad((d) => ((d.allocations as Array<Record<string, unknown>>)[0]!.id = "bogus"))).toBe(false);
    expect(bad((d) => ((d.vendors as Array<Record<string, unknown>>)[0]!.typeId = "bogus"))).toBe(false);
    expect(bad((d) => ((d.brief as Record<string, unknown>).title = "x".repeat(500)))).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(PlannerStateSchema.safeParse(null).success).toBe(false);
    expect(PlannerStateSchema.safeParse("hello").success).toBe(false);
  });
});

describe("EventBriefSchema", () => {
  const { brief } = sampleFor("birthday", TODAY);
  it("trims and bounds free text and must-haves", () => {
    expect(EventBriefSchema.safeParse({ ...brief, title: "  Party  " }).data?.title).toBe("Party");
    expect(EventBriefSchema.safeParse({ ...brief, title: "   " }).success).toBe(false);
    expect(EventBriefSchema.safeParse({ ...brief, mustHaves: Array(6).fill("a") }).success).toBe(false);
    expect(EventBriefSchema.safeParse({ ...brief, budget: 1.5 }).success).toBe(false);
    expect(EventBriefSchema.safeParse({ ...brief, currency: "JPY" }).success).toBe(false);
  });
});

describe("PersonalisationSchema and QuoteSchema", () => {
  it("limit note length and reject unknown keys", () => {
    const { personalisation } = sampleFor("wedding", TODAY).brief;
    expect(PersonalisationSchema.safeParse({ ...personalisation, interests: "x".repeat(201) }).success).toBe(false);
    expect(PersonalisationSchema.safeParse({ ...personalisation, hack: 1 }).success).toBe(false);
  });
  it("accepts a normal quote and rejects absurd numbers", () => {
    const ok = { id: "q", vendorName: "V", pricing: "flat", amount: 1000, inclusions: [], exclusions: [], extras: [] };
    expect(QuoteSchema.safeParse(ok).success).toBe(true);
    expect(QuoteSchema.safeParse({ ...ok, amount: -1 }).success).toBe(false);
    expect(QuoteSchema.safeParse({ ...ok, hours: 5000 }).success).toBe(false);
  });
});

describe("createPlan", () => {
  it("creates one tracker per vendor type and starts empty", () => {
    const { brief } = sampleFor("community", TODAY);
    const state = createPlan(brief, {}, NOW_ISO);
    expect(state.vendors).toHaveLength(6);
    expect(state.vendors.every((v) => v.status === "not_started" && v.quotes.length === 0)).toBe(true);
    expect(state.progress).toEqual({});
    expect(state.log).toEqual([{ at: NOW_ISO, text: "Plan created." }]);
  });
});
