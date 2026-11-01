import { describe, expect, it } from "vitest";
import {
  addDays,
  describeDaysFromNow,
  diffDays,
  formatDate,
  formatDateLong,
  fromDay,
  isValidIsoDate,
  toDay,
  todayIso,
} from "@/lib/domain/dates";

describe("dates", () => {
  it("validates real calendar dates only", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("26-01-01")).toBe(false);
    expect(isValidIsoDate("1999-12-31")).toBe(false);
    expect(isValidIsoDate("not a date")).toBe(false);
  });

  it("round-trips between ISO dates and day numbers", () => {
    expect(fromDay(toDay("2026-12-05"))).toBe("2026-12-05");
    expect(toDay("2000-01-02") - toDay("2000-01-01")).toBe(1);
  });

  it("adds and diffs days across month, year and leap boundaries", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(diffDays("2026-10-27", "2027-02-26")).toBe(122);
    expect(diffDays("2026-12-05", "2026-11-21")).toBe(-14);
  });

  it("throws on invalid input", () => {
    expect(() => toDay("2026-02-30")).toThrow(RangeError);
  });

  it("derives today from the local calendar", () => {
    expect(todayIso(new Date(2026, 9, 27, 23, 59))).toBe("2026-10-27");
    expect(todayIso(new Date(2026, 0, 5, 0, 1))).toBe("2026-01-05");
  });

  it("formats dates in en-IN", () => {
    expect(formatDate("2026-12-05")).toBe("5 Dec 2026");
    expect(formatDateLong("2026-12-05")).toBe("Saturday, 5 December 2026");
  });

  it("describes relative days", () => {
    expect(describeDaysFromNow(0)).toBe("today");
    expect(describeDaysFromNow(1)).toBe("in 1 day");
    expect(describeDaysFromNow(12)).toBe("in 12 days");
    expect(describeDaysFromNow(-3)).toBe("3 days ago");
  });
});
