import { describe, test } from "vitest";
import { summariseBudget } from "@/lib/domain/budget";
import { TASKS } from "@/lib/domain/catalog/tasks";
import { addDays, diffDays, toDay } from "@/lib/domain/dates";
import { compareQuotes, heuristicParseQuote } from "@/lib/domain/quotes";
import { evaluateScenario } from "@/lib/domain/scenarios";
import { computeSchedule } from "@/lib/domain/schedule";
import type { EventBrief, Quote } from "@/lib/domain/types";

describe("Domain engine benchmarks", () => {
  const weddingTasks = TASKS.wedding;
  const today = "2026-10-27";
  const eventDate = "2027-02-27";

  const allocations = [
    { id: "venue", planned: 240000, priority: "protect" as const },
    { id: "food", planned: 280000, priority: "protect" as const },
    { id: "decor", planned: 100000, priority: "normal" as const },
    { id: "photo", planned: 80000, priority: "normal" as const },
    { id: "entertainment", planned: 40000, priority: "flexible" as const },
    { id: "contingency", planned: 60000, priority: "protect" as const },
  ];

  const brief: EventBrief = {
    type: "wedding",
    title: "Priya & Rahul",
    date: eventDate,
    guests: 200,
    city: "Jaipur",
    currency: "INR",
    budget: 800000,
    feel: "balanced",
    mustHaves: ["Outdoor lawn"],
    personalisation: {
      atmosphere: "festive",
      ageGroups: ["adults", "seniors"],
      accessNeeds: ["step-free"],
      interests: "",
      culturalNotes: "",
      venueNotes: "",
    },
  };

  const quotes: Quote[] = [
    {
      id: "q1",
      vendorName: "Grand Palace",
      pricing: "flat",
      amount: 250000,
      guestsCovered: 200,
      inclusions: ["Chairs", "Lighting"],
      exclusions: ["Generator"],
      extras: [{ label: "AC", amount: 20000 }],
    },
    {
      id: "q2",
      vendorName: "Heritage Lawn",
      pricing: "per_guest",
      amount: 1100,
      guestsCovered: 200,
      inclusions: ["Catering setup"],
      exclusions: [],
      extras: [{ label: "Taxes extra" }],
    },
  ];

  const rawQuoteText =
    "Sharma Caterers\n₹950 per plate for 200 guests\nIncludes: crockery, serving staff, cleanup\nGST extra\nTent hire: 15,000";

  test("runs all microsecond benchmarks", async ({ bench }) => {
    await bench("computeSchedule (wedding template: 22 tasks)", () => {
      computeSchedule(weddingTasks, { eventDate, today, progress: {} });
    }).run();

    await bench("summariseBudget", () => {
      summariseBudget({ brief, allocations, vendors: [] });
    }).run();

    await bench("evaluateScenario (+50 guests, 10% budget cut)", () => {
      evaluateScenario(
        { type: "wedding", currency: "INR", total: 800000, guests: 200, allocations },
        { total: 720000, guests: 250 },
      );
    }).run();

    await bench("compareQuotes", () => {
      compareQuotes(quotes, 200, 240000);
    }).run();

    await bench("heuristicParseQuote", () => {
      heuristicParseQuote(rawQuoteText);
    }).run();

    await bench("date maths (toDay, diffDays, addDays)", () => {
      toDay(today);
      diffDays(today, eventDate);
      addDays(today, 60);
    }).run();
  });
});
