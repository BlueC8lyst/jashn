import type { IsoDate } from "./types";

/**
 * Calendar maths on integer "day numbers" (days since 1970-01-01, UTC).
 * Working in integers keeps scheduling O(1) per operation, allocation-free and
 * immune to daylight-saving and time-zone surprises.
 */

const MS_PER_DAY = 86_400_000;
const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIN_YEAR = 2000;
const MAX_YEAR = 2200;

export function isValidIsoDate(value: string): boolean {
  const match = ISO_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

/** @throws RangeError when `value` is not a real calendar date. */
export function toDay(value: IsoDate): number {
  if (!isValidIsoDate(value)) throw new RangeError(`Invalid ISO date: ${value}`);
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function fromDay(day: number): IsoDate {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return fromDay(toDay(value) + days);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return toDay(to) - toDay(from);
}

/** The user's local calendar date, which is what "today" means when planning. */
export function todayIso(now: Date = new Date()): IsoDate {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

let dateFormat: Intl.DateTimeFormat | undefined;
let longDateFormat: Intl.DateTimeFormat | undefined;

/** `5 Dec 2026`. The formatter is created once and reused. */
export function formatDate(value: IsoDate): string {
  dateFormat ??= new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return dateFormat.format(new Date(toDay(value) * MS_PER_DAY));
}

/** `Saturday, 5 December 2026`. */
export function formatDateLong(value: IsoDate): string {
  longDateFormat ??= new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return longDateFormat.format(new Date(toDay(value) * MS_PER_DAY));
}

/** Human wording for a day count relative to today: "in 12 days", "today", "3 days ago". */
export function describeDaysFromNow(days: number): string {
  if (days === 0) return "today";
  const abs = Math.abs(days);
  const unit = abs === 1 ? "day" : "days";
  return days > 0 ? `in ${abs} ${unit}` : `${abs} ${unit} ago`;
}
