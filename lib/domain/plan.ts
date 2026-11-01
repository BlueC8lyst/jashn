import { VENDOR_TYPES } from "./catalog/vendors";
import { TASKS } from "./catalog/tasks";
import { initialAllocations } from "./budget";
import { computeSchedule, type Schedule } from "./schedule";
import { STATE_VERSION } from "./types";
import type { EventBrief, IsoDate, PlannerState, Priority, TaskDef } from "./types";

export function tasksFor(brief: EventBrief): readonly TaskDef[] {
  return TASKS[brief.type];
}

/** Builds a fresh plan from a brief: first-pass budget, empty progress, one tracker per vendor type. */
export function createPlan(
  brief: EventBrief,
  priorities: Readonly<Record<string, Priority>> = {},
  nowIso: string = new Date().toISOString(),
): PlannerState {
  return {
    version: STATE_VERSION,
    createdAt: nowIso,
    updatedAt: nowIso,
    brief,
    allocations: initialAllocations(brief.type, brief.budget, brief.feel, priorities),
    progress: {},
    vendors: VENDOR_TYPES[brief.type].map((def) => ({
      typeId: def.id,
      status: "not_started" as const,
      notes: "",
      quotes: [],
      bookedQuoteId: null,
    })),
    direction: null,
    log: [{ at: nowIso, text: "Plan created." }],
  };
}

/** The live timeline for a plan as of `today`. */
export function scheduleFor(state: Pick<PlannerState, "brief" | "progress">, today: IsoDate): Schedule {
  return computeSchedule(tasksFor(state.brief), {
    eventDate: state.brief.date,
    today,
    progress: state.progress,
  });
}
