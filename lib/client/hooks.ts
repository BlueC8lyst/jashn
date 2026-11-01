"use client";

import { useMemo, useSyncExternalStore } from "react";
import { summariseBudget, type BudgetSummary } from "@/lib/domain/budget";
import { todayIso } from "@/lib/domain/dates";
import { scheduleFor } from "@/lib/domain/plan";
import type { Schedule } from "@/lib/domain/schedule";
import type { IsoDate, PlannerState } from "@/lib/domain/types";
import { getServerSnapshot, getSnapshot, subscribe } from "./store";

const noopSubscribe = () => () => {};

/** The user's local date, or null during server render. Strings compare by value, so this is stable between renders. */
export function useToday(): IsoDate | null {
  return useSyncExternalStore(noopSubscribe, () => todayIso(), () => null);
}

/** The stored plan: `undefined` while loading, `null` when there is none. */
export function usePlanner(): PlannerState | null | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export interface PlanView {
  state: PlannerState;
  today: IsoDate;
  schedule: Schedule;
  budget: BudgetSummary;
}

/**
 * The plan plus its derived views. Derived data is recomputed only when the
 * slice of state it depends on changes (the store keeps unchanged slices
 * referentially equal), never on unrelated edits.
 */
export function usePlanView(): PlanView | null | undefined {
  const state = usePlanner();
  const today = useToday();
  const date = state?.brief.date;
  const type = state?.brief.type;
  const progress = state?.progress;
  const schedule = useMemo(
    () => (state && today ? scheduleFor({ brief: state.brief, progress: state.progress }, today) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only these slices affect the schedule
    [date, type, progress, today],
  );
  const brief = state?.brief;
  const allocations = state?.allocations;
  const vendors = state?.vendors;
  const budget = useMemo(
    () => (state ? summariseBudget({ brief: state.brief, allocations: state.allocations, vendors: state.vendors }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only these slices affect the budget
    [brief, allocations, vendors],
  );
  if (state === undefined || today === null) return undefined;
  if (state === null) return null;
  if (!schedule || !budget) return undefined;
  return { state, today, schedule, budget };
}
