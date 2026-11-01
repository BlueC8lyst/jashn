import type { ReactNode } from "react";

type Tone = "ok" | "warn" | "bad" | "info" | "plain";

/** Status pill. Always carries text, so meaning never depends on colour alone. */
export function Badge({ tone = "plain", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/**
 * A horizontal bar drawn as SVG (presentation attributes, so it works under a
 * strict CSP with no inline styles). Decorative: the figures it illustrates are
 * always printed as text beside it.
 */
export function MeterBar({ value, max, over = false }: { value: number; max: number; over?: boolean }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <svg className="bar-svg" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <rect className="bar-track" width="100" height="4" rx="2" />
      <rect className={over ? "bar-fill over" : "bar-fill"} width={percent} height="4" rx="2" />
    </svg>
  );
}
