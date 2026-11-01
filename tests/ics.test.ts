import { describe, expect, it } from "vitest";
import { buildIcs, foldLine } from "@/lib/domain/ics";
import { scheduleFor } from "@/lib/domain/plan";
import { reduce } from "@/lib/domain/reducer";
import { NOW_ISO, TODAY, samplePlan } from "./helpers";

describe("foldLine", () => {
  it("leaves short lines alone and folds long ones at 75 octets", () => {
    expect(foldLine("short")).toBe("short");
    const folded = foldLine("A".repeat(200));
    const parts = folded.split("\r\n");
    expect(parts[0]).toHaveLength(75);
    expect(parts.slice(1).every((p) => p.startsWith(" ") && p.length <= 75)).toBe(true);
    expect(parts.join("").replace(/ /g, "")).toBe("A".repeat(200));
  });

  it("never splits a multi-byte character", () => {
    const folded = foldLine("₹".repeat(60));
    expect(folded.split("\r\n").join("").replace(/ /g, "")).toBe("₹".repeat(60));
  });
});

describe("buildIcs", () => {
  const state = reduce(samplePlan(), { type: "task/done", id: "budget-guests", on: TODAY }, NOW_ISO);
  const schedule = scheduleFor(state, TODAY);
  const ics = buildIcs({ title: "Riya & Arjun's wedding, Pune", eventDate: state.brief.date, tasks: schedule.tasks, now: new Date(NOW_ISO) });

  it("is a well-formed calendar with CRLF line endings", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(ics.match(/END:VEVENT/g)?.length);
    expect(ics.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });

  it("contains the event and every open task, but not completed ones", () => {
    const open = schedule.tasks.filter((t) => t.status !== "done").length;
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(open + 1);
    expect(ics).not.toContain("UID:task-budget-guests@");
    expect(ics).toContain("UID:event@jashn.app");
    expect(ics).toContain("DTSTAMP:20261027T090000Z");
  });

  it("escapes commas and semicolons in text", () => {
    expect(ics).toContain("X-WR-CALNAME:Riya & Arjun's wedding\\, Pune plan");
  });

  it("uses all-day dates", () => {
    expect(ics).toMatch(/DTSTART;VALUE=DATE:\d{8}\r\n/);
    expect(ics).toMatch(/DTEND;VALUE=DATE:\d{8}\r\n/);
  });
});
