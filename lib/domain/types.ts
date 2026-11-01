/** Shared domain vocabulary. Pure types and constants: no behaviour lives here. */

export const EVENT_TYPES = ["wedding", "birthday", "community"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const CURRENCIES = ["INR", "USD", "GBP", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const FEELS = ["simple", "balanced", "premium"] as const;
export type Feel = (typeof FEELS)[number];

export const PRIORITIES = ["protect", "normal", "flexible"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ATMOSPHERES = ["cozy", "festive", "elegant", "playful", "traditional"] as const;
export type Atmosphere = (typeof ATMOSPHERES)[number];

export const AGE_GROUPS = ["children", "teens", "adults", "seniors"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const ACCESS_NEEDS = ["step-free", "seating", "quiet-space", "dietary"] as const;
export type AccessNeed = (typeof ACCESS_NEEDS)[number];

/** Calendar date as `YYYY-MM-DD`. Never carries a time zone. */
export type IsoDate = string;

/** Hard limits shared by the UI, the persisted-state guard and the API schemas. */
export const LIMITS = {
  titleMax: 80,
  cityMax: 60,
  noteMax: 200,
  mustHaveMax: 60,
  mustHaveCount: 5,
  guestsMax: 5000,
  budgetMax: 1_000_000_000,
  quotesPerVendor: 8,
  quoteListMax: 12,
  quoteLineMax: 120,
  logEntries: 30,
} as const;

export interface Personalisation {
  atmosphere: Atmosphere | null;
  ageGroups: AgeGroup[];
  accessNeeds: AccessNeed[];
  interests: string;
  culturalNotes: string;
  venueNotes: string;
}

export interface EventBrief {
  type: EventType;
  title: string;
  date: IsoDate;
  guests: number;
  /** Total budget in whole currency units. */
  budget: number;
  currency: Currency;
  city: string;
  feel: Feel;
  mustHaves: string[];
  personalisation: Personalisation;
}

/** One budget line. `planned` is a planning assumption, never a vendor price. */
export interface CategoryPlan {
  id: string;
  planned: number;
  priority: Priority;
}

export type Importance = 1 | 2 | 3;

/** A task in a template. Deadlines are expressed relative to the event date. */
export interface TaskDef {
  id: string;
  title: string;
  detail: string;
  /** Recommended deadline, in days before the event. */
  leadDays: number;
  /** Working time the task needs, in days. */
  effortDays: number;
  importance: Importance;
  dependsOn: readonly string[];
  categoryId?: string;
  vendorTypeId?: string;
}

export interface TaskProgress {
  status: "todo" | "done";
  doneOn?: IsoDate;
  /** The user's revised expected finish date when a task is running late. */
  delayedTo?: IsoDate;
}

export const VENDOR_STATUSES = ["not_started", "shortlisting", "quotes_in", "booked"] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export type PricingKind = "per_guest" | "flat" | "per_hour";

export interface QuoteExtra {
  label: string;
  /** Absent when the vendor named a charge without a figure. */
  amount?: number;
}

/** What a vendor said, as entered or confirmed by the user. Always unverified. */
export interface Quote {
  id: string;
  vendorName: string;
  pricing: PricingKind;
  amount: number;
  hours?: number;
  guestsCovered?: number;
  inclusions: string[];
  exclusions: string[];
  extras: QuoteExtra[];
}

export interface VendorTrack {
  typeId: string;
  status: VendorStatus;
  notes: string;
  quotes: Quote[];
  bookedQuoteId: string | null;
}

export interface ChosenDirection {
  title: string;
  summary: string;
}

export interface LogEntry {
  at: string;
  text: string;
}

export const STATE_VERSION = 1 as const;

/** Everything the app persists. The schedule and budget summaries are derived, never stored. */
export interface PlannerState {
  version: typeof STATE_VERSION;
  createdAt: string;
  updatedAt: string;
  brief: EventBrief;
  allocations: CategoryPlan[];
  progress: Record<string, TaskProgress>;
  vendors: VendorTrack[];
  direction: ChosenDirection | null;
  log: LogEntry[];
}
