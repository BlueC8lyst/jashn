import { rebalanceAllocations } from "./budget";
import { LIMITS } from "./types";
import type {
  CategoryPlan,
  ChosenDirection,
  EventBrief,
  IsoDate,
  PlannerState,
  Personalisation,
  Priority,
  Quote,
  VendorStatus,
  VendorTrack,
} from "./types";

/**
 * Pure state transitions for the planner. Every action returns a new state
 * object (structurally sharing whatever did not change), so React can rely on
 * reference equality and the store can persist cheaply.
 */

export type Action =
  | { type: "task/done"; id: string; on: IsoDate }
  | { type: "task/reopen"; id: string }
  | { type: "task/delay"; id: string; to: IsoDate | null }
  | { type: "budget/priority"; id: string; priority: Priority }
  | { type: "budget/rebalance" }
  | { type: "plan/revise"; brief: EventBrief; allocations: CategoryPlan[]; note: string }
  | { type: "vendor/status"; typeId: string; status: VendorStatus }
  | { type: "vendor/notes"; typeId: string; notes: string }
  | { type: "vendor/saveQuote"; typeId: string; quote: Quote }
  | { type: "vendor/removeQuote"; typeId: string; quoteId: string }
  | { type: "vendor/book"; typeId: string; quoteId: string | null }
  | { type: "direction/choose"; direction: ChosenDirection | null }
  | { type: "personalisation/update"; value: Personalisation };

/** A copy of `record` without `key` (records here are small, so O(n) is fine). */
function without<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}

function withLog(state: PlannerState, nowIso: string, text: string | null): Pick<PlannerState, "log" | "updatedAt"> {
  if (text === null) return { log: state.log, updatedAt: nowIso };
  return { log: [{ at: nowIso, text }, ...state.log].slice(0, LIMITS.logEntries), updatedAt: nowIso };
}

function updateVendor(state: PlannerState, typeId: string, change: (track: VendorTrack) => VendorTrack): VendorTrack[] | null {
  const index = state.vendors.findIndex((track) => track.typeId === typeId);
  if (index < 0) return null;
  const next = change(state.vendors[index] as VendorTrack);
  if (next === state.vendors[index]) return null;
  return state.vendors.map((track, i) => (i === index ? next : track));
}

export function reduce(state: PlannerState, action: Action, nowIso: string): PlannerState {
  switch (action.type) {
    case "task/done": {
      const progress = { ...state.progress, [action.id]: { status: "done" as const, doneOn: action.on } };
      return { ...state, progress, ...withLog(state, nowIso, null) };
    }
    case "task/reopen": {
      if (!(action.id in state.progress)) return state;
      return { ...state, progress: without(state.progress, action.id), ...withLog(state, nowIso, null) };
    }
    case "task/delay": {
      const current = state.progress[action.id];
      if (current?.status === "done") return state;
      if (action.to === null) {
        if (!current) return state;
        return { ...state, progress: without(state.progress, action.id), ...withLog(state, nowIso, null) };
      }
      return {
        ...state,
        progress: { ...state.progress, [action.id]: { status: "todo" as const, delayedTo: action.to } },
        ...withLog(state, nowIso, null),
      };
    }
    case "budget/priority": {
      const target = state.allocations.find((plan) => plan.id === action.id);
      if (!target || target.priority === action.priority || action.id === "contingency") return state;
      return {
        ...state,
        allocations: state.allocations.map((plan) => (plan.id === action.id ? { ...plan, priority: action.priority } : plan)),
        ...withLog(state, nowIso, null),
      };
    }
    case "budget/rebalance":
      return {
        ...state,
        allocations: rebalanceAllocations(state.brief, state.allocations),
        ...withLog(state, nowIso, "Re-split the budget using your current priorities."),
      };
    case "plan/revise":
      return {
        ...state,
        brief: action.brief,
        allocations: action.allocations,
        ...withLog(state, nowIso, action.note),
      };
    case "vendor/status": {
      const vendors = updateVendor(state, action.typeId, (track) =>
        track.status === action.status ? track : { ...track, status: action.status },
      );
      return vendors ? { ...state, vendors, ...withLog(state, nowIso, null) } : state;
    }
    case "vendor/notes": {
      const notes = action.notes.slice(0, LIMITS.noteMax * 4);
      const vendors = updateVendor(state, action.typeId, (track) => (track.notes === notes ? track : { ...track, notes }));
      return vendors ? { ...state, vendors, ...withLog(state, nowIso, null) } : state;
    }
    case "vendor/saveQuote": {
      const vendors = updateVendor(state, action.typeId, (track) => {
        const exists = track.quotes.some((quote) => quote.id === action.quote.id);
        if (!exists && track.quotes.length >= LIMITS.quotesPerVendor) return track;
        const quotes = exists
          ? track.quotes.map((quote) => (quote.id === action.quote.id ? action.quote : quote))
          : [...track.quotes, action.quote];
        const status: VendorStatus = track.status === "booked" ? "booked" : "quotes_in";
        return { ...track, quotes, status };
      });
      return vendors ? { ...state, vendors, ...withLog(state, nowIso, null) } : state;
    }
    case "vendor/removeQuote": {
      const vendors = updateVendor(state, action.typeId, (track) => {
        if (!track.quotes.some((quote) => quote.id === action.quoteId)) return track;
        const quotes = track.quotes.filter((quote) => quote.id !== action.quoteId);
        const wasBooked = track.bookedQuoteId === action.quoteId;
        const status: VendorStatus = wasBooked ? (quotes.length > 0 ? "quotes_in" : "shortlisting") : track.status;
        return { ...track, quotes, bookedQuoteId: wasBooked ? null : track.bookedQuoteId, status };
      });
      return vendors ? { ...state, vendors, ...withLog(state, nowIso, null) } : state;
    }
    case "vendor/book": {
      const vendors = updateVendor(state, action.typeId, (track) => {
        if (action.quoteId === null) {
          if (track.bookedQuoteId === null) return track;
          return { ...track, bookedQuoteId: null, status: track.quotes.length > 0 ? "quotes_in" : "shortlisting" };
        }
        if (!track.quotes.some((quote) => quote.id === action.quoteId)) return track;
        return { ...track, bookedQuoteId: action.quoteId, status: "booked" };
      });
      if (!vendors) return state;
      const quote = vendors.find((t) => t.typeId === action.typeId)?.quotes.find((q) => q.id === action.quoteId);
      const note = action.quoteId === null ? null : `Marked ${quote?.vendorName || "a vendor"} as booked.`;
      return { ...state, vendors, ...withLog(state, nowIso, note) };
    }
    case "direction/choose":
      return {
        ...state,
        direction: action.direction,
        ...withLog(state, nowIso, action.direction ? `Chose the direction “${action.direction.title}”.` : null),
      };
    case "personalisation/update":
      return {
        ...state,
        brief: { ...state.brief, personalisation: action.value },
        ...withLog(state, nowIso, null),
      };
  }
}
