import { diffDays, formatDate } from "./dates";
import { formatMoney } from "./money";
import { tasksFor } from "./plan";
import { computeSchedule, type Schedule, type ScheduledTask } from "./schedule";
import { evaluateScenario, type OptionId, type ScenarioResult } from "./scenarios";
import { LIMITS } from "./types";
import type { CategoryPlan, EventBrief, IsoDate, PlannerState } from "./types";

/**
 * Re-planning. When the date, guest count or budget changes the plan is
 * REVISED, not rebuilt: completed tasks, delays, quotes, bookings and the chosen
 * direction all survive, and the user gets a readable account of what moved.
 */

export interface RevisionChange {
  date?: IsoDate;
  guests?: number;
  budget?: number;
}

export interface TaskMove {
  id: string;
  title: string;
  from: IsoDate;
  to: IsoDate;
  /** Negative = earlier. */
  shiftDays: number;
}

export interface RevisionPreview {
  brief: EventBrief;
  scheduleBefore: Schedule;
  scheduleAfter: Schedule;
  moves: TaskMove[];
  newlyAtRisk: ScheduledTask[];
  scenario: ScenarioResult | null;
  summary: string[];
}

export function validateRevision(change: RevisionChange, today: IsoDate): string[] {
  const errors: string[] = [];
  if (change.date !== undefined && diffDays(today, change.date) < 0) errors.push("The event date cannot be in the past.");
  if (change.guests !== undefined && (!Number.isInteger(change.guests) || change.guests < 1 || change.guests > LIMITS.guestsMax)) {
    errors.push(`Guests must be a whole number from 1 to ${LIMITS.guestsMax}.`);
  }
  if (change.budget !== undefined && (!Number.isInteger(change.budget) || change.budget < 1 || change.budget > LIMITS.budgetMax)) {
    errors.push("Budget must be a positive whole number.");
  }
  return errors;
}

function summarise(
  state: PlannerState,
  brief: EventBrief,
  before: Schedule,
  after: Schedule,
  moves: readonly TaskMove[],
  newlyAtRisk: readonly ScheduledTask[],
  scenario: ScenarioResult | null,
): string[] {
  const lines: string[] = [];
  const money = (value: number) => formatMoney(value, brief.currency);

  if (brief.date !== state.brief.date) {
    const shift = diffDays(state.brief.date, brief.date);
    lines.push(
      `The event moves from ${formatDate(state.brief.date)} to ${formatDate(brief.date)} (${Math.abs(shift)} day${Math.abs(shift) === 1 ? "" : "s"} ${shift < 0 ? "earlier" : "later"}).`,
    );
  }
  if (after.compressed && !before.compressed) {
    lines.push(
      `Time is tighter, so the usual lead times are compressed to ${Math.round(after.compression * 100)}% of normal. You have ${after.daysAvailable} days.`,
    );
  } else if (after.compressed && after.compression < before.compression) {
    lines.push(
      `Time is tighter still: lead times are now compressed to ${Math.round(after.compression * 100)}% of normal (it was ${Math.round(before.compression * 100)}%). You have ${after.daysAvailable} days.`,
    );
  } else if (!after.compressed && before.compressed) {
    lines.push("There is enough time again for the full recommended lead times.");
  } else if (after.compressed && after.compression > before.compression) {
    lines.push(
      `You gain some breathing room: lead times are now ${Math.round(after.compression * 100)}% of normal (it was ${Math.round(before.compression * 100)}%).`,
    );
  }
  if (after.compressed && after.compression < 0.35 && !after.eventPassed) {
    lines.push("That is a very tight runway: expect to book vendors on availability rather than price, and decide quickly.");
  }
  if (moves.length > 0) {
    const earlier = moves.filter((move) => move.shiftDays < 0);
    const later = moves.filter((move) => move.shiftDays > 0);
    if (earlier.length > 0) {
      const biggest = earlier.reduce((a, b) => (b.shiftDays < a.shiftDays ? b : a));
      lines.push(
        `${earlier.length} open task${earlier.length === 1 ? "" : "s"} get earlier deadlines; the biggest move is “${biggest.title}”, ${Math.abs(biggest.shiftDays)} days sooner.`,
      );
    }
    if (later.length > 0) lines.push(`${later.length} open task${later.length === 1 ? "" : "s"} get more time.`);
  }
  if (newlyAtRisk.length > 0) {
    const names = newlyAtRisk.slice(0, 3).map((task) => `“${task.title}”`).join(", ");
    lines.push(
      `${newlyAtRisk.length} task${newlyAtRisk.length === 1 ? " is" : "s are"} now at risk or overdue: ${names}${newlyAtRisk.length > 3 ? " and more" : ""}. Start these first.`,
    );
  }
  if (brief.guests !== state.brief.guests) {
    lines.push(`Guests change from ${state.brief.guests} to ${brief.guests}.`);
  }
  if (brief.budget !== state.brief.budget) {
    lines.push(`Budget changes from ${money(state.brief.budget)} to ${money(brief.budget)}.`);
  }
  if (scenario) {
    if (scenario.gap > 0) lines.push(`Against the new numbers the plan needs ${money(scenario.gap)} more than the budget. Choose how to close the gap below.`);
    else if (scenario.gap < 0) lines.push(`The new numbers leave ${money(-scenario.gap)} unallocated. Choose where it goes below.`);
  }
  if (lines.length === 0) lines.push("Nothing changes in the plan.");
  return lines;
}

/** Computes the effect of a change without committing it. O(V + E) for the two schedules. */
export function previewRevision(state: PlannerState, change: RevisionChange, today: IsoDate): RevisionPreview {
  const errors = validateRevision(change, today);
  if (errors.length > 0) throw new RangeError(errors.join(" "));

  const brief: EventBrief = {
    ...state.brief,
    date: change.date ?? state.brief.date,
    guests: change.guests ?? state.brief.guests,
    budget: change.budget ?? state.brief.budget,
  };

  const defs = tasksFor(brief);
  const scheduleBefore = computeSchedule(defs, { eventDate: state.brief.date, today, progress: state.progress });
  const scheduleAfter = computeSchedule(defs, { eventDate: brief.date, today, progress: state.progress });

  const beforeById = new Map(scheduleBefore.tasks.map((task) => [task.id, task]));
  const moves: TaskMove[] = [];
  for (const task of scheduleAfter.tasks) {
    const previous = beforeById.get(task.id);
    if (!previous || task.status === "done") continue;
    const shiftDays = diffDays(previous.due, task.due);
    if (shiftDays !== 0) moves.push({ id: task.id, title: task.title, from: previous.due, to: task.due, shiftDays });
  }
  const wasTroubled = new Set(
    [...scheduleBefore.atRisk, ...scheduleBefore.overdue].map((task) => task.id),
  );
  const newlyAtRisk = [...scheduleAfter.overdue, ...scheduleAfter.atRisk].filter((task) => !wasTroubled.has(task.id));

  const budgetChanged = brief.budget !== state.brief.budget || brief.guests !== state.brief.guests;
  const scenario = budgetChanged
    ? evaluateScenario(
        { type: state.brief.type, currency: state.brief.currency, total: state.brief.budget, guests: state.brief.guests, allocations: state.allocations },
        { total: brief.budget, guests: brief.guests },
      )
    : null;

  return {
    brief,
    scheduleBefore,
    scheduleAfter,
    moves,
    newlyAtRisk,
    scenario,
    summary: summarise(state, brief, scheduleBefore, scheduleAfter, moves, newlyAtRisk, scenario),
  };
}

export interface AppliedRevision {
  brief: EventBrief;
  allocations: CategoryPlan[];
  note: string;
}

/**
 * Resolves a preview into the brief, allocations and log note to commit.
 * `optionId` picks one of the scenario's options; when omitted the first
 * (recommended) option is used.
 */
export function resolveRevision(preview: RevisionPreview, state: PlannerState, optionId?: OptionId): AppliedRevision {
  let brief = preview.brief;
  let allocations = state.allocations;
  let chosenLabel = "";
  if (preview.scenario) {
    const option = preview.scenario.options.find((o) => o.id === optionId) ?? preview.scenario.options[0];
    if (option) {
      brief = { ...brief, budget: option.total, guests: option.guests };
      allocations = option.allocations;
      chosenLabel = option.label;
    }
  }
  const parts: string[] = [];
  if (brief.date !== state.brief.date) parts.push(`date to ${formatDate(brief.date)}`);
  if (brief.guests !== state.brief.guests) parts.push(`guests to ${brief.guests}`);
  if (brief.budget !== state.brief.budget) parts.push(`budget to ${formatMoney(brief.budget, brief.currency)}`);
  const note =
    parts.length === 0
      ? "Reviewed the plan; nothing changed."
      : `Changed ${parts.join(", ")}${chosenLabel ? ` (“${chosenLabel}”)` : ""}.`;
  return { brief, allocations, note };
}
