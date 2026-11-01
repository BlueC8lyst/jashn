import { fromDay, toDay } from "./dates";
import type { Importance, IsoDate, TaskDef, TaskProgress } from "./types";

/**
 * Dependency-aware scheduling (critical-path method).
 *
 * 1. The template's task graph is validated and topologically sorted once and
 *    cached (templates are static), so repeated recomputation after a user
 *    action never re-validates.
 * 2. If there is less time than the template assumes, lead times and efforts
 *    are compressed proportionally rather than producing impossible dates.
 * 3. A BACKWARD pass from the event date gives each task's latest finish such
 *    that nothing a task depends on is due after the task needs it.
 * 4. A FORWARD pass from today (honouring completed and delayed tasks) gives
 *    the earliest each task could realistically finish. The difference is the
 *    slack; negative slack means "cannot make it at this pace": at risk.
 *
 * All passes are O(V + E) and operate on integer day numbers, so a delay or a
 * completed task re-plans the whole timeline in well under a millisecond for
 * real templates (and stays linear for thousands of tasks).
 */

export type ScheduleStatus = "done" | "overdue" | "at_risk" | "ready" | "waiting";

export interface ScheduledTask {
  id: string;
  title: string;
  detail: string;
  importance: Importance;
  dependsOn: readonly string[];
  categoryId?: string;
  vendorTypeId?: string;
  /** Latest finish date that still keeps the event on track. */
  due: IsoDate;
  /** Latest start date given the task's effort. */
  start: IsoDate;
  /** Days of breathing room; negative means it cannot finish by `due` at this pace. */
  slackDays: number;
  /** Days from today to `due` (negative when past). */
  daysLeft: number;
  status: ScheduleStatus;
  /** Titles of unfinished tasks this one is waiting on. */
  waitingOn: string[];
  /** True when the task has no slack and is not done: any slip moves the event. */
  critical: boolean;
  doneOn?: IsoDate;
  delayedTo?: IsoDate;
}

export interface Schedule {
  tasks: ScheduledTask[];
  daysAvailable: number;
  eventPassed: boolean;
  /** 1 when the full template fits; below 1 when lead times were compressed. */
  compression: number;
  compressed: boolean;
  nextUp: ScheduledTask[];
  overdue: ScheduledTask[];
  atRisk: ScheduledTask[];
  /** Tasks pushed into trouble by the user's delays (not by the plan itself). */
  impactedByDelays: string[];
  doneCount: number;
}

export class ScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleError";
  }
}

interface Topology {
  index: Map<string, number>;
  deps: number[][];
  dependents: number[][];
  order: number[];
}

const topologyCache = new WeakMap<readonly TaskDef[], Topology>();

/** Kahn's algorithm. @throws ScheduleError on an unknown dependency or a cycle. */
function topologyOf(defs: readonly TaskDef[]): Topology {
  const cached = topologyCache.get(defs);
  if (cached) return cached;

  const index = new Map<string, number>();
  defs.forEach((def, i) => {
    if (index.has(def.id)) throw new ScheduleError(`Duplicate task id: ${def.id}`);
    index.set(def.id, i);
  });
  const deps: number[][] = defs.map(() => []);
  const dependents: number[][] = defs.map(() => []);
  const indegree = new Array<number>(defs.length).fill(0);
  defs.forEach((def, i) => {
    for (const depId of def.dependsOn) {
      const depIndex = index.get(depId);
      if (depIndex === undefined) throw new ScheduleError(`Task ${def.id} depends on unknown task ${depId}`);
      (deps[i] as number[]).push(depIndex);
      (dependents[depIndex] as number[]).push(i);
      indegree[i] = (indegree[i] as number) + 1;
    }
  });

  const order: number[] = [];
  const queue: number[] = [];
  indegree.forEach((count, i) => {
    if (count === 0) queue.push(i);
  });
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head] as number;
    order.push(node);
    for (const next of dependents[node] as number[]) {
      indegree[next] = (indegree[next] as number) - 1;
      if (indegree[next] === 0) queue.push(next);
    }
  }
  if (order.length !== defs.length) throw new ScheduleError("Task dependencies contain a cycle");

  const topology = { index, deps, dependents, order };
  topologyCache.set(defs, topology);
  return topology;
}

export interface ScheduleInput {
  eventDate: IsoDate;
  today: IsoDate;
  progress: Readonly<Record<string, TaskProgress>>;
}

/** Earliest-finish day for every task, optionally ignoring the user's delay overrides. */
function forwardPass(
  defs: readonly TaskDef[],
  topology: Topology,
  effort: readonly number[],
  todayDay: number,
  progress: Readonly<Record<string, TaskProgress>>,
  honourDelays: boolean,
): Int32Array {
  const earliestFinish = new Int32Array(defs.length);
  for (const i of topology.order) {
    const def = defs[i] as TaskDef;
    const state = progress[def.id];
    if (state?.status === "done") {
      earliestFinish[i] = state.doneOn ? Math.min(toDay(state.doneOn), todayDay) : todayDay;
      continue;
    }
    let start = todayDay;
    for (const dep of topology.deps[i] as number[]) start = Math.max(start, earliestFinish[dep] as number);
    let finish = start + (effort[i] as number);
    if (honourDelays && state?.delayedTo) finish = Math.max(finish, toDay(state.delayedTo));
    earliestFinish[i] = finish;
  }
  return earliestFinish;
}

export function computeSchedule(defs: readonly TaskDef[], input: ScheduleInput): Schedule {
  const topology = topologyOf(defs);
  const eventDay = toDay(input.eventDate);
  const todayDay = toDay(input.today);
  const rawAvailable = eventDay - todayDay;
  const daysAvailable = Math.max(0, rawAvailable);

  // Compress the template when there is less time than it assumes.
  const horizon = defs.reduce((max, def) => Math.max(max, def.leadDays), 0);
  const compression = horizon > daysAvailable && horizon > 0 ? daysAvailable / horizon : 1;
  const compressed = compression < 1;
  const lead = defs.map((def) => (compressed ? Math.min(daysAvailable, Math.round(def.leadDays * compression)) : def.leadDays));
  const effort = defs.map((def) => (compressed ? Math.max(1, Math.round(def.effortDays * compression)) : def.effortDays));

  // Backward pass: latest finish respecting dependents' latest starts.
  const latestFinish = new Int32Array(defs.length);
  const latestStart = new Int32Array(defs.length);
  for (let k = topology.order.length - 1; k >= 0; k--) {
    const i = topology.order[k] as number;
    let finish = eventDay - (lead[i] as number);
    for (const dependent of topology.dependents[i] as number[]) finish = Math.min(finish, latestStart[dependent] as number);
    latestFinish[i] = finish;
    latestStart[i] = finish - (effort[i] as number);
  }

  const earliestFinish = forwardPass(defs, topology, effort, todayDay, input.progress, true);
  const hasDelays = defs.some((def) => input.progress[def.id]?.delayedTo !== undefined);
  const baselineFinish = hasDelays ? forwardPass(defs, topology, effort, todayDay, input.progress, false) : earliestFinish;

  const scheduled: ScheduledTask[] = new Array(defs.length);
  const impactedByDelays: string[] = [];
  let doneCount = 0;
  defs.forEach((def, i) => {
    const state = input.progress[def.id];
    const done = state?.status === "done";
    const slack = (latestFinish[i] as number) - (earliestFinish[i] as number);
    const unfinishedDeps = (topology.deps[i] as number[]).filter(
      (dep) => input.progress[(defs[dep] as TaskDef).id]?.status !== "done",
    );
    let status: ScheduleStatus;
    if (done) status = "done";
    else if ((latestFinish[i] as number) < todayDay) status = "overdue";
    else if (slack < 0) status = "at_risk";
    else status = unfinishedDeps.length === 0 ? "ready" : "waiting";

    if (done) doneCount++;
    if (hasDelays && !done && slack < 0 && (latestFinish[i] as number) - (baselineFinish[i] as number) >= 0) {
      impactedByDelays.push(def.id);
    }

    scheduled[i] = {
      id: def.id,
      title: def.title,
      detail: def.detail,
      importance: def.importance,
      dependsOn: def.dependsOn,
      ...(def.categoryId ? { categoryId: def.categoryId } : {}),
      ...(def.vendorTypeId ? { vendorTypeId: def.vendorTypeId } : {}),
      due: fromDay(latestFinish[i] as number),
      start: fromDay(latestStart[i] as number),
      slackDays: slack,
      daysLeft: (latestFinish[i] as number) - todayDay,
      status,
      waitingOn: unfinishedDeps.map((dep) => (defs[dep] as TaskDef).title),
      critical: !done && slack <= 0,
      ...(state?.doneOn ? { doneOn: state.doneOn } : {}),
      ...(state?.delayedTo ? { delayedTo: state.delayedTo } : {}),
    };
  });

  // Sort indices on integer keys (no date parsing inside the comparator).
  const sortedIndexes = Array.from(defs.keys()).sort(
    (a, b) =>
      (latestFinish[a] as number) - (latestFinish[b] as number) ||
      (defs[b] as TaskDef).importance - (defs[a] as TaskDef).importance ||
      a - b,
  );
  const tasks = sortedIndexes.map((i) => scheduled[i] as ScheduledTask);
  const open = tasks.filter((task) => task.status !== "done");
  return {
    tasks,
    daysAvailable,
    eventPassed: rawAvailable < 0,
    compression,
    compressed,
    nextUp: open.filter((task) => task.waitingOn.length === 0).slice(0, 3),
    overdue: open.filter((task) => task.status === "overdue"),
    atRisk: open.filter((task) => task.status === "at_risk"),
    impactedByDelays,
    doneCount,
  };
}
