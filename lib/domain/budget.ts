import { CATEGORIES, CONTINGENCY_ID, categoryDef } from "./catalog/categories";
import { VENDOR_TYPES } from "./catalog/vendors";
import { allocateByWeights } from "./money";
import { estimateQuoteTotal } from "./quotes";
import type { CategoryPlan, EventBrief, EventType, Feel, PlannerState, Priority } from "./types";

/**
 * Budget allocation and projection. Everything here is arithmetic over the
 * categories and the user's own numbers; no figure is ever presented as a
 * vendor price unless the user entered it as a quote.
 */

const PRIORITY_WEIGHT: Record<Priority, number> = { protect: 1.35, normal: 1, flexible: 0.7 };
const AMBIENCE_WEIGHT: Record<Feel, number> = { simple: 0.85, balanced: 1, premium: 1.2 };

/**
 * First-pass allocation of `total` across the categories of an event type.
 *
 * The contingency buffer is set aside first (a fixed share of the total); the
 * rest is split by `share x priority x feel` weights using largest-remainder
 * rounding, so the allocations always add up to exactly `total`. O(c log c) in
 * the number of categories.
 */
export function initialAllocations(
  type: EventType,
  total: number,
  feel: Feel,
  priorities: Readonly<Record<string, Priority>> = {},
): CategoryPlan[] {
  const defs = CATEGORIES[type];
  const reserve = Math.min(total, Math.round((total * (categoryDef(type, CONTINGENCY_ID)?.share ?? 0)) / 100));
  const spendable = defs.filter((def) => def.id !== CONTINGENCY_ID);
  const weights = spendable.map((def) => {
    const priority = priorities[def.id] ?? "normal";
    return def.share * PRIORITY_WEIGHT[priority] * (def.ambience ? AMBIENCE_WEIGHT[feel] : 1);
  });
  const shares = allocateByWeights(total - reserve, weights);

  const plans: CategoryPlan[] = [];
  let spendIndex = 0;
  for (const def of defs) {
    if (def.id === CONTINGENCY_ID) {
      plans.push({ id: def.id, planned: reserve, priority: "normal" });
    } else {
      plans.push({ id: def.id, planned: shares[spendIndex++] as number, priority: priorities[def.id] ?? "normal" });
    }
  }
  return plans;
}

/** Re-runs the first-pass allocation using the priorities already chosen. */
export function rebalanceAllocations(brief: EventBrief, current: readonly CategoryPlan[]): CategoryPlan[] {
  const priorities: Record<string, Priority> = {};
  for (const plan of current) priorities[plan.id] = plan.priority;
  return initialAllocations(brief.type, brief.budget, brief.feel, priorities);
}

export type FigureBasis = "estimate" | "quote" | "booked";

export interface CategoryProjection {
  id: string;
  label: string;
  planned: number;
  /** What the plan expects to spend, given any quotes or bookings. */
  projected: number;
  basis: FigureBasis;
  priority: Priority;
}

export interface BudgetSummary {
  total: number;
  plannedTotal: number;
  projectedTotal: number;
  /** Budget left after the projected spend; negative means over budget. */
  headroom: number;
  perGuestPlanned: number;
  rows: CategoryProjection[];
}

/**
 * Compares the plan with what the user has actually learnt from vendors.
 *
 * Per category: a booked quote wins, otherwise the lowest comparable quote,
 * otherwise the planning estimate. Quotes feed back into the plan, but are only
 * ever labelled "quote" (unverified) or "booked" (the user's own confirmation).
 */
export function summariseBudget(
  state: Pick<PlannerState, "brief" | "allocations" | "vendors">,
): BudgetSummary {
  const { brief, allocations, vendors } = state;
  const vendorByType = new Map(vendors.map((track) => [track.typeId, track]));
  const typesByCategory = new Map<string, string[]>();
  for (const def of VENDOR_TYPES[brief.type]) {
    const list = typesByCategory.get(def.categoryId);
    if (list) list.push(def.id);
    else typesByCategory.set(def.categoryId, [def.id]);
  }

  let plannedTotal = 0;
  let projectedTotal = 0;
  const rows: CategoryProjection[] = [];

  for (const plan of allocations) {
    const typeIds = typesByCategory.get(plan.id) ?? [];
    let known = 0;
    let withFigure = 0;
    let booked = 0;
    for (const typeId of typeIds) {
      const track = vendorByType.get(typeId);
      if (!track) continue;
      const bookedQuote = track.bookedQuoteId ? track.quotes.find((q) => q.id === track.bookedQuoteId) : undefined;
      const bookedTotal = bookedQuote ? estimateQuoteTotal(bookedQuote, brief.guests) : null;
      if (bookedTotal !== null) {
        known += bookedTotal;
        withFigure++;
        booked++;
        continue;
      }
      let lowest: number | null = null;
      for (const quote of track.quotes) {
        const total = estimateQuoteTotal(quote, brief.guests);
        if (total !== null && (lowest === null || total < lowest)) lowest = total;
      }
      if (lowest !== null) {
        known += lowest;
        withFigure++;
      }
    }

    const missing = typeIds.length - withFigure;
    const projected =
      withFigure === 0 ? plan.planned : known + (typeIds.length > 0 ? Math.round((plan.planned * missing) / typeIds.length) : 0);
    const basis: FigureBasis = withFigure === 0 ? "estimate" : booked === withFigure && missing === 0 ? "booked" : "quote";

    plannedTotal += plan.planned;
    projectedTotal += projected;
    rows.push({
      id: plan.id,
      label: categoryDef(brief.type, plan.id)?.label ?? plan.id,
      planned: plan.planned,
      projected,
      basis,
      priority: plan.priority,
    });
  }

  return {
    total: brief.budget,
    plannedTotal,
    projectedTotal,
    headroom: brief.budget - projectedTotal,
    perGuestPlanned: brief.guests > 0 ? Math.round(brief.budget / brief.guests) : 0,
    rows,
  };
}
