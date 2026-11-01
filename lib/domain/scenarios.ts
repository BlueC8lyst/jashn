import { CONTINGENCY_ID, categoryDef } from "./catalog/categories";
import { formatMoney, allocateByWeights } from "./money";
import type { CategoryPlan, Currency, EventType, Priority } from "./types";

/**
 * What-if and trade-off engine.
 *
 * A scenario changes the guest count, the total budget and/or the spend on
 * individual categories. The engine works out what each category would need
 * (`required`), the resulting gap, and a small set of clearly explained ways to
 * close it. It never decides for the user: it returns options, each a complete
 * proposed plan, and the user picks one.
 *
 * Complexity: every step is O(c) or O(c log c) in the number of categories
 * (at most 9), so a scenario evaluates in microseconds.
 */

export interface ScenarioChange {
  total?: number;
  guests?: number;
  /** Extra (or reduced) spend per category, applied before any rebalancing. */
  categoryDeltas?: Readonly<Record<string, number>>;
}

export interface ScenarioBase {
  type: EventType;
  currency: Currency;
  total: number;
  guests: number;
  allocations: readonly CategoryPlan[];
}

export interface ScenarioRow {
  id: string;
  label: string;
  priority: Priority;
  planned: number;
  required: number;
}

export type OptionId =
  | "protect-priorities"
  | "spread-evenly"
  | "fewer-guests"
  | "raise-budget"
  | "keep-buffer"
  | "reinvest"
  | "as-is";

export interface TradeoffOption {
  id: OptionId;
  label: string;
  summary: string;
  total: number;
  guests: number;
  allocations: CategoryPlan[];
  /** Amounts removed from categories relative to what they required. */
  cuts: Array<{ id: string; amount: number }>;
  /** Shortfall still left after this option (0 when the plan balances). */
  unresolved: number;
}

export interface ScenarioResult {
  total: number;
  guests: number;
  rows: ScenarioRow[];
  requiredTotal: number;
  /** Positive: the scenario needs more than the budget. Negative: surplus. */
  gap: number;
  options: TradeoffOption[];
}

/**
 * The most each kind of category can be trimmed, as a fraction of what it needs.
 * These are planning assumptions about how far a line can shrink before the
 * experience changes materially: a "keep simple" line has far more give than one
 * the host marked as a priority.
 */
const MAX_CUT: Record<Priority, number> = { flexible: 0.5, normal: 0.3, protect: 0.15 };
const MAX_CONTINGENCY_CUT = 0.6;

/**
 * Splits `amount` across entries in proportion to `weights`, never exceeding
 * each entry's `cap`. When an entry hits its cap the remainder is re-spread
 * over the others (water-filling), so the loop runs at most n times.
 * Returns integers; the sum is `min(amount, sum(caps))`.
 */
export function distributeCapped(amount: number, caps: readonly number[], weights: readonly number[]): number[] {
  const n = caps.length;
  const out = new Array<number>(n).fill(0);
  let remaining = amount;
  let active: number[] = [];
  for (let i = 0; i < n; i++) if ((caps[i] as number) > 0 && (weights[i] as number) > 0) active.push(i);

  for (let guard = 0; guard <= n && remaining > 0 && active.length > 0; guard++) {
    const shares = allocateByWeights(
      remaining,
      active.map((i) => weights[i] as number),
    );
    const stillActive: number[] = [];
    let clipped = false;
    active.forEach((i, k) => {
      const room = (caps[i] as number) - (out[i] as number);
      if ((shares[k] as number) >= room) {
        out[i] = (out[i] as number) + room;
        remaining -= room;
        clipped = true;
      } else {
        stillActive.push(i);
      }
    });
    if (!clipped) {
      active.forEach((i, k) => {
        out[i] = (out[i] as number) + (shares[k] as number);
      });
      remaining = 0;
      break;
    }
    active = stillActive;
  }
  return out;
}

type Phase = (row: ScenarioRow) => boolean;

/** Applies cuts phase by phase: later phases are only touched if earlier ones cannot cover the gap. */
function planCuts(rows: readonly ScenarioRow[], gap: number, phases: readonly Phase[]): number[] {
  const cuts = new Array<number>(rows.length).fill(0);
  let remaining = gap;
  for (const phase of phases) {
    if (remaining <= 0) break;
    const caps = rows.map((row, i) => {
      if (!phase(row)) return 0;
      const fraction = row.id === CONTINGENCY_ID ? MAX_CONTINGENCY_CUT : MAX_CUT[row.priority];
      return Math.floor(row.required * fraction) - (cuts[i] as number);
    });
    const weights = rows.map((row, i) => ((caps[i] as number) > 0 ? row.required : 0));
    const taken = distributeCapped(remaining, caps, weights);
    taken.forEach((amount, i) => {
      cuts[i] = (cuts[i] as number) + amount;
      remaining -= amount;
    });
  }
  return cuts;
}

const isContingency = (row: ScenarioRow) => row.id === CONTINGENCY_ID;

export function evaluateScenario(base: ScenarioBase, change: ScenarioChange): ScenarioResult {
  const total = change.total ?? base.total;
  const guests = change.guests ?? base.guests;
  const deltas = change.categoryDeltas ?? {};

  const requiredAt = (atGuests: number): number[] =>
    base.allocations.map((plan) => {
      const sensitivity = categoryDef(base.type, plan.id)?.guestSensitivity ?? 0;
      const scaled = plan.planned * (1 + sensitivity * (atGuests / base.guests - 1));
      return Math.max(0, Math.round(scaled + (deltas[plan.id] ?? 0)));
    });

  const required = requiredAt(guests);
  const rows: ScenarioRow[] = base.allocations.map((plan, i) => ({
    id: plan.id,
    label: categoryDef(base.type, plan.id)?.label ?? plan.id,
    priority: plan.priority,
    planned: plan.planned,
    required: required[i] as number,
  }));
  const requiredTotal = required.reduce((sum, value) => sum + value, 0);
  const gap = requiredTotal - total;

  const toPlans = (values: readonly number[]): CategoryPlan[] =>
    base.allocations.map((plan, i) => ({ id: plan.id, priority: plan.priority, planned: values[i] as number }));

  const money = (value: number) => formatMoney(value, base.currency);
  const options: TradeoffOption[] = [];

  const cutOption = (id: OptionId, label: string, phases: readonly Phase[], lead: string): TradeoffOption => {
    const cuts = planCuts(rows, gap, phases);
    const allocations = toPlans(required.map((value, i) => value - (cuts[i] as number)));
    const cutList = rows
      .map((row, i) => ({ id: row.id, label: row.label, amount: cuts[i] as number }))
      .filter((entry) => entry.amount > 0);
    const cutTotal = cutList.reduce((sum, entry) => sum + entry.amount, 0);
    const unresolved = gap - cutTotal;
    const named = cutList.map((entry) => `${entry.label} by ${money(entry.amount)}`).join(", ");
    return {
      id,
      label,
      summary:
        `${lead} Trims ${named || "nothing"}.` +
        (unresolved > 0 ? ` Still ${money(unresolved)} over budget.` : " The plan balances."),
      total,
      guests,
      allocations,
      cuts: cutList.map(({ id: cutId, amount }) => ({ id: cutId, amount })),
      unresolved,
    };
  };

  if (gap > 0) {
    options.push(
      cutOption(
        "protect-priorities",
        "Protect what matters most",
        [
          (row) => row.priority === "flexible" && !isContingency(row),
          (row) => row.priority === "normal" && !isContingency(row),
          isContingency,
          (row) => row.priority === "protect",
        ],
        "Cuts the categories you marked as flexible first, then the rest, and touches your protected ones last.",
      ),
      cutOption(
        "spread-evenly",
        "Share the cut evenly",
        [(row) => row.priority !== "protect" && !isContingency(row), isContingency, (row) => row.priority === "protect"],
        "Trims every unprotected category by the same proportion.",
      ),
    );

    // Closed-form guest limit: the required total is linear in the guest count.
    const fixedPart = base.allocations.reduce((sum, plan) => {
      const s = categoryDef(base.type, plan.id)?.guestSensitivity ?? 0;
      return sum + plan.planned * (1 - s) + (deltas[plan.id] ?? 0);
    }, 0);
    const variablePart = base.allocations.reduce((sum, plan) => {
      return sum + plan.planned * (categoryDef(base.type, plan.id)?.guestSensitivity ?? 0);
    }, 0);
    if (variablePart > 0 && total > fixedPart && guests > 1) {
      let limit = Math.min(guests - 1, Math.floor((base.guests * (total - fixedPart)) / variablePart));
      while (limit >= 1 && requiredAt(limit).reduce((sum, value) => sum + value, 0) > total) limit--;
      if (limit >= 1) {
        const atLimit = requiredAt(limit);
        const spare = total - atLimit.reduce((sum, value) => sum + value, 0);
        const contingencyIndex = base.allocations.findIndex((plan) => plan.id === CONTINGENCY_ID);
        if (contingencyIndex >= 0) atLimit[contingencyIndex] = (atLimit[contingencyIndex] as number) + spare;
        options.push({
          id: "fewer-guests",
          label: "Trim the guest list",
          summary: `Keep every category as planned and invite ${limit} guests instead of ${guests} (${guests - limit} fewer). The plan balances.`,
          total,
          guests: limit,
          allocations: toPlans(atLimit),
          cuts: [],
          unresolved: 0,
        });
      }
    }

    options.push({
      id: "raise-budget",
      label: "Raise the budget",
      summary: `Keep the plan exactly as it needs to be by finding ${money(gap)} more. The total becomes ${money(requiredTotal)}.`,
      total: requiredTotal,
      guests,
      allocations: toPlans(required),
      cuts: [],
      unresolved: 0,
    });
  } else {
    const surplus = -gap;
    const buffered = [...required];
    const contingencyIndex = base.allocations.findIndex((plan) => plan.id === CONTINGENCY_ID);
    if (surplus === 0) {
      options.push({
        id: "as-is",
        label: "Keep the plan as it is",
        summary: "Everything fits the budget exactly.",
        total,
        guests,
        allocations: toPlans(required),
        cuts: [],
        unresolved: 0,
      });
    } else {
      if (contingencyIndex >= 0) buffered[contingencyIndex] = (buffered[contingencyIndex] as number) + surplus;
      options.push({
        id: "keep-buffer",
        label: "Keep it as a safety buffer",
        summary: `Adds the extra ${money(surplus)} to your contingency buffer.`,
        total,
        guests,
        allocations: toPlans(buffered),
        cuts: [],
        unresolved: 0,
      });
      const protectedRows = rows.filter((row) => row.priority === "protect" && !isContingency(row));
      const targets = protectedRows.length > 0 ? protectedRows : rows.filter((row) => !isContingency(row));
      const extra = allocateByWeights(
        surplus,
        targets.map((row) => row.required),
      );
      const reinvested = [...required];
      const rowIndex = new Map(rows.map((row, i) => [row.id, i]));
      targets.forEach((row, k) => {
        const index = rowIndex.get(row.id) as number;
        reinvested[index] = (reinvested[index] as number) + (extra[k] as number);
      });
      options.push({
        id: "reinvest",
        label: protectedRows.length > 0 ? "Invest it in your priorities" : "Spread it across the plan",
        summary: `Puts the extra ${money(surplus)} into ${targets.map((row) => row.label).join(", ")}.`,
        total,
        guests,
        allocations: toPlans(reinvested),
        cuts: [],
        unresolved: 0,
      });
    }
  }

  return { total, guests, rows, requiredTotal, gap, options };
}
