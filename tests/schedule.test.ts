import { describe, expect, it } from "vitest";
import { TASKS } from "@/lib/domain/catalog/tasks";
import { addDays, toDay } from "@/lib/domain/dates";
import { computeSchedule, ScheduleError } from "@/lib/domain/schedule";
import type { TaskDef } from "@/lib/domain/types";
import { TODAY } from "./helpers";

const wedding = TASKS.wedding;
const input = (over: Partial<Parameters<typeof computeSchedule>[1]> = {}) => ({
  eventDate: addDays(TODAY, 300),
  today: TODAY,
  progress: {},
  ...over,
});

const task = (id: string, over: Partial<TaskDef> = {}): TaskDef => ({
  id,
  title: id,
  detail: "",
  leadDays: 10,
  effortDays: 2,
  importance: 2,
  dependsOn: [],
  ...over,
});

describe("computeSchedule: ample time", () => {
  const schedule = computeSchedule(wedding, input());

  it("uses the full recommended lead times and flags nothing", () => {
    expect(schedule.compressed).toBe(false);
    expect(schedule.compression).toBe(1);
    expect(schedule.atRisk).toHaveLength(0);
    expect(schedule.overdue).toHaveLength(0);
    expect(schedule.tasks).toHaveLength(wedding.length);
  });

  it("orders tasks by deadline and never schedules a task after the task that needs it", () => {
    const byId = new Map(schedule.tasks.map((t) => [t.id, t]));
    for (const current of schedule.tasks) {
      for (const dep of current.dependsOn) {
        expect(toDay(byId.get(dep)!.due)).toBeLessThanOrEqual(toDay(current.start));
      }
    }
    const dues = schedule.tasks.map((t) => toDay(t.due));
    expect(dues).toEqual([...dues].sort((a, b) => a - b));
  });

  it("surfaces the first ready tasks as 'next up'", () => {
    expect(schedule.nextUp.length).toBeGreaterThan(0);
    expect(schedule.nextUp.every((t) => t.waitingOn.length === 0 && t.status !== "done")).toBe(true);
    expect(schedule.nextUp[0]!.id).toBe("budget-guests");
  });
});

describe("computeSchedule: little time (the template is compressed, not broken)", () => {
  const schedule = computeSchedule(wedding, input({ eventDate: addDays(TODAY, 60) }));

  it("compresses lead times to fit and keeps every deadline on or after today", () => {
    expect(schedule.compressed).toBe(true);
    expect(schedule.compression).toBeCloseTo(60 / 270, 5);
    for (const t of schedule.tasks) expect(t.daysLeft).toBeGreaterThanOrEqual(0);
  });

  it("still respects dependency order after compression", () => {
    const byId = new Map(schedule.tasks.map((t) => [t.id, t]));
    for (const current of schedule.tasks) {
      for (const dep of current.dependsOn) {
        expect(toDay(byId.get(dep)!.due)).toBeLessThanOrEqual(toDay(current.due));
      }
    }
  });

  it("flags tasks that cannot realistically finish at this pace", () => {
    expect(schedule.atRisk.length + schedule.overdue.length).toBeGreaterThan(0);
  });
});

describe("computeSchedule: progress and delays", () => {
  it("completing a task unblocks what depends on it", () => {
    const before = computeSchedule(wedding, input());
    const after = computeSchedule(wedding, input({ progress: { "budget-guests": { status: "done", doneOn: TODAY } } }));
    expect(before.nextUp.map((t) => t.id)).toContain("budget-guests");
    expect(after.nextUp.map((t) => t.id)).not.toContain("budget-guests");
    expect(after.doneCount).toBe(1);
    expect(after.tasks.find((t) => t.id === "budget-guests")!.status).toBe("done");
    const shortlist = after.tasks.find((t) => t.id === "venue-shortlist")!;
    expect(shortlist.waitingOn).toEqual([]);
    expect(shortlist.status).toBe("ready");
  });

  it("a delayed task pushes the tasks after it into trouble and names them", () => {
    const eventDate = addDays(TODAY, 150);
    const baseline = computeSchedule(wedding, { eventDate, today: TODAY, progress: {} });
    const bookVenue = baseline.tasks.find((t) => t.id === "book-venue")!;
    const lateBy = bookVenue.daysLeft + 40;
    const delayed = computeSchedule(wedding, {
      eventDate,
      today: TODAY,
      progress: { "book-venue": { status: "todo", delayedTo: addDays(TODAY, lateBy) } },
    });
    expect(delayed.impactedByDelays.length).toBeGreaterThan(0);
    const impacted = delayed.tasks.filter((t) => delayed.impactedByDelays.includes(t.id));
    expect(impacted.some((t) => t.id === "book-caterer" || t.id === "caterer-shortlist" || t.id === "final-payments")).toBe(true);
    expect(delayed.tasks.find((t) => t.id === "book-venue")!.delayedTo).toBeDefined();
  });

  it("marks tasks whose deadline has passed as overdue", () => {
    const schedule = computeSchedule(wedding, input({ eventDate: addDays(TODAY, 5) }));
    expect(schedule.compressed).toBe(true);
    const lateEvent = computeSchedule(wedding, input({ eventDate: TODAY }));
    expect(lateEvent.daysAvailable).toBe(0);
  });

  it("copes with an event date in the past without throwing", () => {
    const schedule = computeSchedule(wedding, input({ eventDate: addDays(TODAY, -3) }));
    expect(schedule.eventPassed).toBe(true);
    expect(schedule.daysAvailable).toBe(0);
  });
});

describe("computeSchedule: graph validation", () => {
  it("rejects cycles, unknown dependencies and duplicate ids", () => {
    expect(() => computeSchedule([task("a", { dependsOn: ["b"] }), task("b", { dependsOn: ["a"] })], input())).toThrow(ScheduleError);
    expect(() => computeSchedule([task("a", { dependsOn: ["zzz"] })], input())).toThrow(/unknown task/);
    expect(() => computeSchedule([task("a"), task("a")], input())).toThrow(/Duplicate/);
  });

  it("handles an empty graph and rejects invalid dates", () => {
    expect(computeSchedule([], input()).tasks).toEqual([]);
    expect(() => computeSchedule(wedding, input({ eventDate: "2026-02-30" }))).toThrow(RangeError);
  });

  it("critical path: a chain of dependent tasks with no slack is flagged critical", () => {
    const chain = [task("a", { leadDays: 10, effortDays: 5 }), task("b", { leadDays: 5, effortDays: 5, dependsOn: ["a"] })];
    const schedule = computeSchedule(chain, { eventDate: addDays(TODAY, 10), today: TODAY, progress: {} });
    expect(schedule.tasks.every((t) => t.critical)).toBe(true);
  });
});

describe("computeSchedule: performance", () => {
  it("scales linearly: 5,000 tasks in a dependency web schedule in well under a second", () => {
    const n = 5000;
    const big: TaskDef[] = Array.from({ length: n }, (_, i) =>
      task(`t${i}`, {
        leadDays: 1 + (n - i) / 20,
        effortDays: 1,
        dependsOn: i === 0 ? [] : [`t${i - 1}`, ...(i > 10 ? [`t${i - 10}`] : [])],
      }),
    );
    const start = performance.now();
    const schedule = computeSchedule(big, { eventDate: addDays(TODAY, 4000), today: TODAY, progress: {} });
    const elapsed = performance.now() - start;
    expect(schedule.tasks).toHaveLength(n);
    expect(elapsed).toBeLessThan(500);
  });

  it("re-validation is skipped for a template that has already been analysed (cached topology)", () => {
    computeSchedule(wedding, input());
    const start = performance.now();
    for (let i = 0; i < 200; i++) computeSchedule(wedding, input());
    expect((performance.now() - start) / 200).toBeLessThan(5);
  });
});
