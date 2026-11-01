import type { Currency } from "./types";

const LOCALES: Record<Currency, string> = { INR: "en-IN", USD: "en-US", GBP: "en-GB", EUR: "en-IE" };

// Bounded by the Currency union (4 entries): creating an Intl.NumberFormat is
// far more expensive than formatting with one, so each is built once.
const standardFormats = new Map<Currency, Intl.NumberFormat>();
const compactFormats = new Map<Currency, Intl.NumberFormat>();

function build(currency: Currency, compact: boolean): Intl.NumberFormat {
  return new Intl.NumberFormat(LOCALES[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: compact ? 1 : 0,
    ...(compact ? { notation: "compact" as const } : {}),
  });
}

export function formatMoney(amount: number, currency: Currency): string {
  let format = standardFormats.get(currency);
  if (!format) {
    format = build(currency, false);
    standardFormats.set(currency, format);
  }
  return format.format(amount);
}

/** `₹8L`, `$12K`: for tight spaces where the exact figure is shown nearby. */
export function formatMoneyCompact(amount: number, currency: Currency): string {
  let format = compactFormats.get(currency);
  if (!format) {
    format = build(currency, true);
    compactFormats.set(currency, format);
  }
  return format.format(amount);
}

/** `part` as a whole percentage of `whole` (0 when `whole` is 0). */
export function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Splits `total` across `weights` so the integer parts always add up to exactly
 * `total` (largest-remainder method). Ties break towards the earlier index, so
 * the result is deterministic. O(n log n) in the number of weights.
 *
 * With all-zero weights the total is split evenly.
 */
export function allocateByWeights(total: number, weights: readonly number[]): number[] {
  const count = weights.length;
  if (count === 0) return [];
  if (!Number.isInteger(total) || total < 0) throw new RangeError("total must be a non-negative integer");

  let weightSum = 0;
  for (const weight of weights) {
    if (!Number.isFinite(weight) || weight < 0) throw new RangeError("weights must be finite and non-negative");
    weightSum += weight;
  }
  const effective = weightSum > 0 ? weights : weights.map(() => 1);
  const effectiveSum = weightSum > 0 ? weightSum : count;

  const shares = new Array<number>(count);
  const remainders = new Array<number>(count);
  let assigned = 0;
  for (let i = 0; i < count; i++) {
    const exact = (total * (effective[i] as number)) / effectiveSum;
    const floor = Math.floor(exact);
    shares[i] = floor;
    remainders[i] = exact - floor;
    assigned += floor;
  }

  // Floating-point error can leave the floors a unit over or under; the
  // largest-remainder pass below corrects either direction.
  let leftover = total - assigned;
  if (leftover !== 0) {
    const order = Array.from({ length: count }, (_, i) => i);
    const step = leftover > 0 ? 1 : -1;
    order.sort((a, b) => {
      const diff = (remainders[a] as number) - (remainders[b] as number);
      return (step > 0 ? -diff : diff) || a - b;
    });
    for (let k = 0; leftover !== 0 && k < order.length * 2; k++) {
      const index = order[k % order.length] as number;
      if (step < 0 && (shares[index] as number) === 0) continue;
      shares[index] = (shares[index] as number) + step;
      leftover -= step;
    }
  }
  return shares;
}
