import { z } from "zod";
import { CATEGORIES } from "./catalog/categories";
import { TASKS } from "./catalog/tasks";
import { VENDOR_TYPES } from "./catalog/vendors";
import { isValidIsoDate } from "./dates";
import {
  ACCESS_NEEDS,
  AGE_GROUPS,
  ATMOSPHERES,
  CURRENCIES,
  EVENT_TYPES,
  FEELS,
  LIMITS,
  PRIORITIES,
  STATE_VERSION,
  VENDOR_STATUSES,
} from "./types";

/**
 * Runtime schemas. They guard the two places untrusted data enters the app:
 * the browser's stored plan (which a user or an extension could have edited)
 * and the API request bodies. Objects are strict (unknown keys are rejected)
 * and every string and array has an explicit bound.
 */

const isoDate = z.string().refine(isValidIsoDate, "Must be a real date (YYYY-MM-DD)");
const text = (max: number) => z.string().max(max);
const wholeNumber = (min: number, max: number) => z.number().int().min(min).max(max);

export const PersonalisationSchema = z.strictObject({
  atmosphere: z.enum(ATMOSPHERES).nullable(),
  ageGroups: z.array(z.enum(AGE_GROUPS)).max(AGE_GROUPS.length),
  accessNeeds: z.array(z.enum(ACCESS_NEEDS)).max(ACCESS_NEEDS.length),
  interests: text(LIMITS.noteMax),
  culturalNotes: text(LIMITS.noteMax),
  venueNotes: text(LIMITS.noteMax),
});

export const EventBriefSchema = z.strictObject({
  type: z.enum(EVENT_TYPES),
  title: z.string().trim().min(1).max(LIMITS.titleMax),
  date: isoDate,
  guests: wholeNumber(1, LIMITS.guestsMax),
  budget: wholeNumber(1, LIMITS.budgetMax),
  currency: z.enum(CURRENCIES),
  city: text(LIMITS.cityMax),
  feel: z.enum(FEELS),
  mustHaves: z.array(z.string().trim().min(1).max(LIMITS.mustHaveMax)).max(LIMITS.mustHaveCount),
  personalisation: PersonalisationSchema,
});

const QuoteExtraSchema = z.strictObject({
  label: z.string().min(1).max(LIMITS.quoteLineMax),
  amount: wholeNumber(0, LIMITS.budgetMax).optional(),
});

export const QuoteSchema = z.strictObject({
  id: z.string().min(1).max(64),
  vendorName: text(LIMITS.titleMax),
  pricing: z.enum(["per_guest", "flat", "per_hour"]),
  amount: wholeNumber(0, LIMITS.budgetMax),
  hours: z.number().min(0.5).max(240).optional(),
  guestsCovered: wholeNumber(1, LIMITS.guestsMax).optional(),
  inclusions: z.array(z.string().min(1).max(LIMITS.quoteLineMax)).max(LIMITS.quoteListMax),
  exclusions: z.array(z.string().min(1).max(LIMITS.quoteLineMax)).max(LIMITS.quoteListMax),
  extras: z.array(QuoteExtraSchema).max(LIMITS.quoteListMax),
});

const TaskProgressSchema = z.strictObject({
  status: z.enum(["todo", "done"]),
  doneOn: isoDate.optional(),
  delayedTo: isoDate.optional(),
});

const VendorTrackSchema = z.strictObject({
  typeId: z.string().min(1).max(40),
  status: z.enum(VENDOR_STATUSES),
  notes: text(LIMITS.noteMax * 4),
  quotes: z.array(QuoteSchema).max(LIMITS.quotesPerVendor),
  bookedQuoteId: z.string().max(64).nullable(),
});

export const PlannerStateSchema = z
  .strictObject({
    version: z.literal(STATE_VERSION),
    createdAt: z.string().max(40),
    updatedAt: z.string().max(40),
    brief: EventBriefSchema,
    allocations: z
      .array(z.strictObject({ id: z.string().max(40), planned: wholeNumber(0, LIMITS.budgetMax * 2), priority: z.enum(PRIORITIES) }))
      .max(16),
    progress: z.record(z.string().max(60), TaskProgressSchema),
    vendors: z.array(VendorTrackSchema).max(16),
    direction: z.strictObject({ title: text(120), summary: text(600) }).nullable(),
    log: z.array(z.strictObject({ at: z.string().max(40), text: text(300) })).max(LIMITS.logEntries),
  })
  .refine(
    (state) => {
      const categoryIds = new Set(CATEGORIES[state.brief.type].map((def) => def.id));
      const vendorIds = new Set(VENDOR_TYPES[state.brief.type].map((def) => def.id));
      const taskIds = new Set(TASKS[state.brief.type].map((def) => def.id));
      return (
        state.allocations.every((plan) => categoryIds.has(plan.id)) &&
        state.vendors.every((track) => vendorIds.has(track.typeId)) &&
        Object.keys(state.progress).every((id) => taskIds.has(id))
      );
    },
    { message: "Stored plan does not match its event type" },
  );

// ----- API request schemas (see lib/server/ai) -------------------------------

export const AI_TASKS = ["ideas", "alternatives", "vendor_questions", "parse_quote"] as const;
export type AiTaskName = (typeof AI_TASKS)[number];
