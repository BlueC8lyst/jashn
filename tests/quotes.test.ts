import { describe, expect, it } from "vitest";
import {
  assessQuote,
  compareQuotes,
  estimateQuoteTotal,
  heuristicParseQuote,
  parseExtras,
  splitLines,
} from "@/lib/domain/quotes";
import type { Quote } from "@/lib/domain/types";

const quote = (over: Partial<Quote> = {}): Quote => ({
  id: "q",
  vendorName: "Vendor",
  pricing: "per_guest",
  amount: 950,
  guestsCovered: 200,
  inclusions: ["Crockery"],
  exclusions: [],
  extras: [],
  ...over,
});

describe("estimateQuoteTotal", () => {
  it("per-guest quotes are scaled to the planned guest count, plus priced extras", () => {
    expect(estimateQuoteTotal(quote({ extras: [{ label: "Tent", amount: 15000 }] }), 200)).toBe(205_000);
    expect(estimateQuoteTotal(quote(), 250)).toBe(237_500);
  });
  it("flat quotes are a floor and per-hour quotes need hours", () => {
    expect(estimateQuoteTotal(quote({ pricing: "flat", amount: 80_000 }), 200)).toBe(80_000);
    expect(estimateQuoteTotal(quote({ pricing: "per_hour", amount: 5000 }), 200)).toBeNull();
    expect(estimateQuoteTotal(quote({ pricing: "per_hour", amount: 5000, hours: 6 }), 200)).toBe(30_000);
  });
});

describe("assessQuote", () => {
  it("flags a quote that covers fewer guests than needed", () => {
    const a = assessQuote(quote({ guestsCovered: 150 }), 200);
    expect(a.warnings.join(" ")).toContain("150 guests");
    expect(a.total).toBe(190_000);
  });

  it("flags a flat price that covers fewer guests and asks for the rest", () => {
    const a = assessQuote(quote({ pricing: "flat", amount: 100_000, guestsCovered: 120 }), 200);
    expect(a.warnings.join(" ")).toContain("120 of your 200 guests");
    expect(a.missing.join(" ")).toContain("remaining 80 guests");
  });

  it("flags unpriced extras and possible taxes, and asks for what is missing", () => {
    const a = assessQuote(quote({ extras: [{ label: "GST extra" }, { label: "Tent hire" }], inclusions: [] }), 200);
    expect(a.unpricedExtras).toEqual(["GST extra", "Tent hire"]);
    expect(a.warnings.join(" ")).toMatch(/2 charges have no figure/);
    expect(a.warnings.join(" ")).toMatch(/Taxes or service charges may be on top/);
    expect(a.missing).toContain("What exactly is included.");
    expect(a.missing).toContain("A written figure for each extra charge.");
  });

  it("does not warn about tax when a tax figure is included", () => {
    const a = assessQuote(quote({ extras: [{ label: "GST 18%", amount: 30_000 }] }), 200);
    expect(a.warnings.join(" ")).not.toMatch(/Taxes or service charges/);
  });

  it("lists exclusions and a per-hour quote without hours as missing information", () => {
    const a = assessQuote(quote({ pricing: "per_hour", exclusions: ["Travel"], guestsCovered: undefined }), 100);
    expect(a.total).toBeNull();
    expect(a.missing).toContain("How many hours the price covers.");
    expect(a.warnings.join(" ")).toContain("Not included: Travel");
  });
});

describe("compareQuotes", () => {
  const rows = compareQuotes(
    [
      quote({ id: "high", vendorName: "High", amount: 1200 }),
      quote({ id: "low", vendorName: "Low", amount: 900 }),
      quote({ id: "tie", vendorName: "Tie", amount: 900 }),
      quote({ id: "unknown", vendorName: "Unknown", pricing: "per_hour", amount: 100 }),
    ],
    200,
    200_000,
  );

  it("ranks by comparable total with ties sharing a rank, and puts unpriceable quotes last", () => {
    expect(rows.map((r) => [r.vendorName, r.rank])).toEqual([["Low", 1], ["Tie", 1], ["High", 3], ["Unknown", null]]);
  });
  it("reports each quote against the planned amount", () => {
    expect(rows.find((r) => r.vendorName === "Low")!.versusPlanned).toBe(-20_000);
    expect(rows.find((r) => r.vendorName === "High")!.versusPlanned).toBe(40_000);
    expect(rows.find((r) => r.vendorName === "Unknown")!.versusPlanned).toBeNull();
  });
});

describe("text helpers", () => {
  it("splitLines trims bullets, drops blanks and enforces limits", () => {
    expect(splitLines("- Tent\n\n• Lights\n3) Staff")).toEqual(["Tent", "Lights", "Staff"]);
    expect(splitLines("a\nb\nc", 2)).toEqual(["a", "b"]);
    expect(splitLines("x".repeat(500))[0]).toHaveLength(120);
  });

  it("parseExtras reads priced and unpriced lines", () => {
    expect(parseExtras("Tent hire: 15,000\nGST extra\nGenerator - Rs. 4500")).toEqual([
      { label: "Tent hire", amount: 15000 },
      { label: "GST extra" },
      { label: "Generator", amount: 4500 },
    ]);
  });
});

describe("heuristicParseQuote", () => {
  it("reads the common per-plate shape", () => {
    const draft = heuristicParseQuote(
      "Sharma Caterers\n₹950 per plate for 200 guests\nIncludes: crockery, serving staff and cleanup\nGST extra\nTent hire: 15000",
    );
    expect(draft.vendorName).toBe("Sharma Caterers");
    expect(draft.pricing).toBe("per_guest");
    expect(draft.amount).toBe(950);
    expect(draft.guestsCovered).toBe(200);
    expect(draft.inclusions).toEqual(["crockery", "serving staff", "cleanup"]);
    expect(draft.extras.map((e) => e.label)).toEqual(expect.arrayContaining(["GST extra", "Tent hire"]));
    expect(draft.extras.find((e) => e.label === "Tent hire")!.amount).toBe(15000);
  });

  it("reads hourly quotes and asks about missing details instead of guessing", () => {
    const draft = heuristicParseQuote("DJ Rohan: Rs 6,000 per hour, 5 hours");
    expect(draft.pricing).toBe("per_hour");
    expect(draft.amount).toBe(6000);
    expect(draft.hours).toBe(5);
  });

  it("flags when no price can be found", () => {
    const draft = heuristicParseQuote("Call me for a quote!");
    expect(draft.amount).toBeUndefined();
    expect(draft.ambiguities.join(" ")).toMatch(/No price/);
  });

  it("notes ambiguity when several amounts appear and the guest count is missing", () => {
    const draft = heuristicParseQuote("₹80,000 for the hall, ₹10,000 deposit");
    expect(draft.ambiguities.join(" ")).toMatch(/More than one amount/);
    expect(draft.ambiguities.join(" ")).toMatch(/number of guests/);
  });

  it("is safe on huge input", () => {
    const start = performance.now();
    heuristicParseQuote("₹100 ".repeat(50_000));
    expect(performance.now() - start).toBeLessThan(200);
  });
});
