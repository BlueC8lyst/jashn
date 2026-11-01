import { LIMITS } from "./types";
import type { PricingKind, Quote, QuoteExtra } from "./types";

/**
 * Vendor quotes: normalising what a vendor said into a comparable figure and
 * flagging what is still unclear.
 *
 * Everything here is "what the vendor told the user", entered or confirmed by
 * the user, and is always treated as UNVERIFIED. Nothing in this module claims a
 * vendor is available or that a price is confirmed; it only does arithmetic and
 * points out gaps, which is the part a person finds tedious to do by hand.
 */

export interface QuoteAssessment {
  quoteId: string;
  vendorName: string;
  /** Comparable estimate for the planned guest count, or null when it cannot be worked out. */
  total: number | null;
  /** Sum of extra charges that came with a figure. */
  knownExtras: number;
  /** Charges the vendor mentioned without a price. */
  unpricedExtras: string[];
  /** Plain-language flags to read before relying on the figure. */
  warnings: string[];
  /** What to ask the vendor to turn this into a firm comparison. */
  missing: string[];
}

export interface QuoteRow extends QuoteAssessment {
  /** Comparable total minus the planned amount (positive = over). Null when no total. */
  versusPlanned: number | null;
  /** 1 = lowest comparable total; equal totals share a rank. Null when no total. */
  rank: number | null;
}

const TAX_WORDS = /\b(gst|vat|tax(?:es)?|service charge)\b/i;

function baseCost(quote: Quote, guests: number): number | null {
  switch (quote.pricing) {
    case "per_guest":
      return quote.amount * guests;
    case "flat":
      return quote.amount;
    case "per_hour":
      return quote.hours && quote.hours > 0 ? quote.amount * quote.hours : null;
  }
}

/** Comparable cost for `guests` people, including extras that carry a figure. Null if not computable. */
export function estimateQuoteTotal(quote: Quote, guests: number): number | null {
  const base = baseCost(quote, guests);
  if (base === null) return null;
  const extras = quote.extras.reduce((sum, extra) => sum + (extra.amount ?? 0), 0);
  return Math.round(base + extras);
}

export function assessQuote(quote: Quote, guests: number): QuoteAssessment {
  const warnings: string[] = [];
  const missing: string[] = [];
  const unpricedExtras = quote.extras.filter((extra) => extra.amount === undefined).map((extra) => extra.label);
  const knownExtras = quote.extras.reduce((sum, extra) => sum + (extra.amount ?? 0), 0);

  if (quote.pricing === "per_hour" && !(quote.hours && quote.hours > 0)) {
    missing.push("How many hours the price covers.");
  }
  if (quote.guestsCovered === undefined && quote.pricing !== "per_hour") {
    missing.push(
      quote.pricing === "flat" ? "How many guests the flat price covers." : "How many guests the per-person price applies to.",
    );
  }
  if (quote.guestsCovered !== undefined && quote.guestsCovered < guests) {
    warnings.push(
      quote.pricing === "flat"
        ? `The flat price covers ${quote.guestsCovered} of your ${guests} guests, so expect to pay more for the rest.`
        : `This quote was given for ${quote.guestsCovered} guests; the total below scales it to your ${guests}.`,
    );
    if (quote.pricing === "flat") missing.push(`The price for the remaining ${guests - quote.guestsCovered} guests.`);
  }
  if (unpricedExtras.length > 0) {
    warnings.push(
      `${unpricedExtras.length} charge${unpricedExtras.length === 1 ? " has" : "s have"} no figure yet (${unpricedExtras.join("; ")}).`,
    );
    missing.push("A written figure for each extra charge.");
  }
  const mentionsTax = [...quote.extras.map((e) => e.label), ...quote.exclusions].some((text) => TAX_WORDS.test(text));
  if (mentionsTax && !quote.extras.some((e) => TAX_WORDS.test(e.label) && e.amount !== undefined)) {
    warnings.push("Taxes or service charges may be on top of this price.");
    missing.push("Whether taxes and service charges are included.");
  }
  if (quote.inclusions.length === 0) missing.push("What exactly is included.");
  if (quote.exclusions.length > 0) warnings.push(`Not included: ${quote.exclusions.join("; ")}.`);

  return {
    quoteId: quote.id,
    vendorName: quote.vendorName,
    total: estimateQuoteTotal(quote, guests),
    knownExtras,
    unpricedExtras,
    warnings,
    missing: [...new Set(missing)],
  };
}

/** Assesses every quote and ranks the computable ones, cheapest first. O(q log q). */
export function compareQuotes(quotes: readonly Quote[], guests: number, planned: number): QuoteRow[] {
  const rows: QuoteRow[] = quotes.map((quote) => {
    const assessment = assessQuote(quote, guests);
    return {
      ...assessment,
      versusPlanned: assessment.total === null ? null : assessment.total - planned,
      rank: null,
    };
  });

  const ranked = rows
    .filter((row): row is QuoteRow & { total: number } => row.total !== null)
    .sort((a, b) => a.total - b.total);
  let rank = 0;
  let previous: number | null = null;
  ranked.forEach((row, index) => {
    if (row.total !== previous) rank = index + 1;
    row.rank = rank;
    previous = row.total;
  });

  return [...rows].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
}

// ----- Free-text helpers -----------------------------------------------------

/** One item per non-empty line, trimmed and bounded. */
export function splitLines(text: string, maxItems: number = LIMITS.quoteListMax, maxLength: number = LIMITS.quoteLineMax): string[] {
  const items: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cleaned = line.replace(/^[\s\-*•\d.)]+/, "").trim().slice(0, maxLength);
    if (cleaned) items.push(cleaned);
    if (items.length >= maxItems) break;
  }
  return items;
}

/** Parses lines like `Tent hire: 15,000` or `GST extra` into extras with or without a figure. */
export function parseExtras(text: string): QuoteExtra[] {
  return splitLines(text).map((line) => {
    const match = /^(.*?)[\s:\-–=]*(?:₹|rs\.?|inr|\$|£|€)?\s*([\d][\d,]*(?:\.\d+)?)\s*(?:\/-)?$/i.exec(line);
    if (match && match[1] && match[2]) {
      const amount = Number(match[2].replace(/,/g, ""));
      if (Number.isFinite(amount) && amount >= 0) return { label: match[1].trim() || line, amount: Math.round(amount) };
    }
    return { label: line };
  });
}

export interface DraftQuote {
  vendorName: string;
  pricing: PricingKind;
  amount?: number;
  hours?: number;
  guestsCovered?: number;
  inclusions: string[];
  exclusions: string[];
  extras: QuoteExtra[];
  ambiguities: string[];
}

const MONEY = /(?:₹|rs\.?|inr|\$|usd|£|gbp|€|eur)\s*([\d][\d,]*(?:\.\d+)?)|([\d][\d,]*(?:\.\d+)?)\s*(?:\/-|rupees|rs\b|inr\b)/gi;
// A non-global twin for `.test()`: a global regex keeps `lastIndex` state between calls.
const HAS_MONEY = new RegExp(MONEY.source, "i");
// "Tent hire: 15000": a short label, a separator and a bare number is a priced line item.
const LABELLED_AMOUNT = /^[^\d₹$£€]{2,60}[:\-–=]\s*(?:₹|rs\.?|inr|\$|£|€)?\s*\d[\d,]*(?:\.\d+)?\s*(?:\/-)?$/i;
const PER_GUEST = /per\s*(?:plate|head|guest|person|pax)|\/\s*(?:plate|head|guest|person|pax)|\bpp\b/i;
const PER_HOUR = /per\s*(?:hour|hr)|\/\s*(?:hour|hr)|hourly/i;

function toNumber(raw: string): number {
  return Math.round(Number(raw.replace(/,/g, "")));
}

/**
 * Best-effort, rule-based reading of a pasted quote. This is the offline
 * fallback for the AI parser: it handles the common "₹950 per plate for 200
 * guests, GST extra" shape and leaves anything it is unsure of to the user,
 * who always reviews the draft before it is saved.
 */
export function heuristicParseQuote(text: string): DraftQuote {
  const source = text.slice(0, 4000);
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const ambiguities: string[] = [];

  const amounts: Array<{ value: number; index: number }> = [];
  for (const match of source.matchAll(MONEY)) {
    const raw = match[1] ?? match[2];
    if (raw) amounts.push({ value: toNumber(raw), index: match.index ?? 0 });
  }

  const pricing: PricingKind = PER_GUEST.test(source) ? "per_guest" : PER_HOUR.test(source) ? "per_hour" : "flat";
  const primary =
    amounts.find((entry) => (pricing === "flat" ? true : /per|\/|pp/i.test(source.slice(entry.index, entry.index + 40)))) ??
    amounts[0];

  const guestMatch = /(\d{2,4})\s*(?:guests?|pax|people|persons?|plates?|heads?)/i.exec(source);
  const hourMatch = /(\d{1,2})\s*(?:hours?|hrs?)\b/i.exec(source);
  const first = lines[0] ?? "";
  const colonPrefix = first.includes(":") ? first.slice(0, first.indexOf(":")).trim() : first;
  const nameCandidate = first.length <= 40 ? first : colonPrefix;
  const vendorName =
    nameCandidate.length > 0 && nameCandidate.length <= 40 && !/\d/.test(nameCandidate)
      ? nameCandidate.replace(/[:\-–]+$/, "").trim()
      : colonPrefix.length <= 40 && !/\d/.test(colonPrefix)
        ? colonPrefix
        : "";

  // The line that carries the headline price; other priced lines are extras.
  let offset = 0;
  let primaryLine = -1;
  lines.forEach((line, i) => {
    const start = source.indexOf(line, offset);
    if (primary && primaryLine < 0 && primary.index >= start && primary.index <= start + line.length) primaryLine = i;
    offset = start + line.length;
  });

  const inclusions: string[] = [];
  const exclusions: string[] = [];
  const extras: QuoteExtra[] = [];
  lines.forEach((line, i) => {
    const lower = line.toLowerCase();
    const afterColon = line.includes(":") ? line.slice(line.indexOf(":") + 1) : line;
    const chargeWords = /\b(extra|additional|charges?|surcharge)\b/.test(lower) || TAX_WORDS.test(line);
    if (/\b(includes?|inclusive of|included)\b/.test(lower) && !/not included/.test(lower)) {
      inclusions.push(...afterColon.split(/,|\band\b/).map((part) => part.trim()).filter(Boolean));
    } else if (/(not included|excludes?|excluding|exclusive of)/.test(lower)) {
      exclusions.push(...afterColon.split(/,|\band\b/).map((part) => part.trim()).filter(Boolean));
    } else if (i === primaryLine) {
      const tax = TAX_WORDS.exec(line);
      if (tax && /extra|additional|not included|excluded/.test(lower)) extras.push({ label: `${tax[0]} extra` });
    } else if (chargeWords || HAS_MONEY.test(line) || LABELLED_AMOUNT.test(line)) {
      extras.push(...parseExtras(line));
    }
  });

  if (!primary) ambiguities.push("No price was found. Please enter the amount.");
  if (amounts.length > 1) ambiguities.push("More than one amount was found. Check that the main price is the right one.");
  if (!guestMatch && pricing !== "per_hour") ambiguities.push("The number of guests the price covers is not stated.");
  if (pricing === "per_hour" && !hourMatch) ambiguities.push("The number of hours is not stated.");

  return {
    vendorName,
    pricing,
    ...(primary ? { amount: primary.value } : {}),
    ...(pricing === "per_hour" && hourMatch ? { hours: Number(hourMatch[1]) } : {}),
    ...(guestMatch ? { guestsCovered: Number(guestMatch[1]) } : {}),
    inclusions: inclusions.slice(0, LIMITS.quoteListMax).map((s) => s.slice(0, LIMITS.quoteLineMax)),
    exclusions: exclusions.slice(0, LIMITS.quoteListMax).map((s) => s.slice(0, LIMITS.quoteLineMax)),
    extras: extras.slice(0, LIMITS.quoteListMax),
    ambiguities,
  };
}
