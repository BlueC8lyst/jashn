"use client";

import { useMemo, useState } from "react";
import { CONTINGENCY_ID } from "@/lib/domain/catalog/categories";
import { PRIORITY_LABELS } from "@/lib/domain/catalog/labels";
import { formatMoney, percentOf } from "@/lib/domain/money";
import { evaluateScenario, type OptionId } from "@/lib/domain/scenarios";
import { PRIORITIES, type Priority } from "@/lib/domain/types";
import { announce } from "@/lib/client/announce";
import { usePlanView } from "@/lib/client/hooks";
import { dispatch } from "@/lib/client/store";
import { AlternativesPanel } from "@/components/planner/AlternativesPanel";
import { OptionList } from "@/components/planner/OptionList";
import { Field } from "@/components/ui/form";
import { Badge, MeterBar } from "@/components/ui/primitives";

const BASIS = { estimate: ["plain", "Planning estimate"], quote: ["info", "Vendor quote (unverified)"], booked: ["ok", "Booked"] } as const;
const toInt = (value: string): number => (/^-?\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN);

export default function BudgetPage() {
  const view = usePlanView();
  const [guests, setGuests] = useState("");
  const [total, setTotal] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [extra, setExtra] = useState("");
  const [chosen, setChosen] = useState<OptionId | null>(null);

  const brief = view?.state.brief;
  const allocations = view?.state.allocations;

  const scenario = useMemo(() => {
    if (!brief || !allocations) return null;
    const g = guests === "" ? brief.guests : toInt(guests);
    const t = total === "" ? brief.budget : toInt(total);
    const delta = toInt(extra);
    if (!Number.isInteger(g) || g < 1 || !Number.isInteger(t) || t < 1) return null;
    const categoryDeltas = categoryId && Number.isInteger(delta) && delta !== 0 ? { [categoryId]: delta } : undefined;
    const unchanged = g === brief.guests && t === brief.budget && !categoryDeltas;
    if (unchanged) return null;
    return evaluateScenario(
      { type: brief.type, currency: brief.currency, total: brief.budget, guests: brief.guests, allocations },
      { total: t, guests: g, ...(categoryDeltas ? { categoryDeltas } : {}) },
    );
  }, [brief, allocations, guests, total, categoryId, extra]);

  if (!view) return null;
  const { state, budget } = view;
  const money = (value: number) => formatMoney(value, state.brief.currency);
  const option = scenario?.options.find((o) => o.id === chosen) ?? scenario?.options[0] ?? null;
  const biggestCut = option?.cuts.slice().sort((a, b) => b.amount - a.amount)[0];
  const biggestRow = biggestCut ? scenario?.rows.find((r) => r.id === biggestCut.id) : undefined;

  function apply() {
    if (!option || !scenario) return;
    dispatch({
      type: "plan/revise",
      brief: { ...state.brief, budget: option.total, guests: option.guests },
      allocations: option.allocations,
      note: `Applied a what-if: “${option.label}”.`,
    });
    setGuests("");
    setTotal("");
    setExtra("");
    setChosen(null);
    announce("Budget updated.");
  }

  return (
    <div className="stack">
      <div>
        <h1>Budget</h1>
        <p className="muted">
          These are <strong>planning estimates</strong> based on typical spending patterns and your priorities, not vendor prices. Real prices appear only when you add a vendor quote.
        </p>
      </div>
      {budget.headroom < 0 ? (
        <div className="banner banner-bad" role="note">
          Projected spend is {money(-budget.headroom)} over your {money(budget.total)} budget.
        </div>
      ) : (
        <div className="banner banner-ok" role="note">
          Projected spend leaves {money(budget.headroom)} of your {money(budget.total)} budget unused.
        </div>
      )}

      <section className="card scroll" aria-label="Budget by category">
        <table>
          <caption>Budget by category</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Priority</th>
              <th scope="col" className="num">Planned</th>
              <th scope="col" className="num">Projected</th>
              <th scope="col">Based on</th>
            </tr>
          </thead>
          <tbody>
            {budget.rows.map((row) => {
              const [tone, text] = BASIS[row.basis];
              return (
                <tr key={row.id}>
                  <th scope="row">
                    {row.label}
                    <MeterBar value={row.projected} max={Math.max(...budget.rows.map((r) => r.projected), 1)} over={row.projected > row.planned && row.basis !== "estimate"} />
                  </th>
                  <td>
                    {row.id === CONTINGENCY_ID ? (
                      "Buffer"
                    ) : (
                      <select
                        aria-label={`Priority for ${row.label}`}
                        value={row.priority}
                        onChange={(e) => dispatch({ type: "budget/priority", id: row.id, priority: e.target.value as Priority })}
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {PRIORITY_LABELS[p].label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="num">{money(row.planned)}</td>
                  <td className="num">
                    {money(row.projected)} <span className="muted small">({percentOf(row.projected, budget.total)}%)</span>
                  </td>
                  <td>
                    <Badge tone={tone}>{text}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td />
              <td className="num">{money(budget.plannedTotal)}</td>
              <td className="num">{money(budget.projectedTotal)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        <p>
          <button type="button" className="btn btn-small btn-quiet" onClick={() => { dispatch({ type: "budget/rebalance" }); announce("Budget re-split using your priorities."); }}>
            Re-split using my priorities
          </button>
        </p>
      </section>

      <section className="card stack" aria-labelledby="whatif-title">
        <h2 id="whatif-title">What if…?</h2>
        <p className="muted">Try a change and see what it would cost and what you would have to give up. Nothing changes until you apply it.</p>
        <div className="grid grid-3">
          <Field label="Guests">
            {(c) => <input type="number" inputMode="numeric" min={1} {...c} placeholder={String(state.brief.guests)} value={guests} onChange={(e) => setGuests(e.target.value)} />}
          </Field>
          <Field label="Total budget">
            {(c) => <input type="number" inputMode="numeric" min={1} {...c} placeholder={String(state.brief.budget)} value={total} onChange={(e) => setTotal(e.target.value)} />}
          </Field>
          <Field label="Spend more or less on" hint="Pick a category and an amount (use a minus sign to spend less).">
            {(c) => (
              <select {...c} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">None</option>
                {budget.rows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        {categoryId ? (
          <Field label="Extra amount">
            {(c) => <input type="number" inputMode="numeric" {...c} value={extra} onChange={(e) => setExtra(e.target.value)} />}
          </Field>
        ) : null}

        <div aria-live="polite" className="stack">
          {scenario ? (
            <>
              <p>
                {scenario.gap > 0 ? (
                  <strong>This needs {money(scenario.gap)} more than the budget.</strong>
                ) : scenario.gap < 0 ? (
                  <strong>This leaves {money(-scenario.gap)} unallocated.</strong>
                ) : (
                  <strong>This fits the budget exactly.</strong>
                )}
              </p>
              <OptionList legend="Your options" options={scenario.options} currency={state.brief.currency} value={option?.id ?? null} onChange={setChosen} />
              <div className="row">
                <button type="button" className="btn" onClick={apply}>
                  Apply “{option?.label}”
                </button>
              </div>
              {biggestCut && biggestRow ? (
                <AlternativesPanel
                  key={`${option?.id}-${biggestCut.id}`}
                  brief={state.brief}
                  categoryId={biggestCut.id}
                  label={biggestRow.label}
                  cutPercent={Math.round((biggestCut.amount / Math.max(1, biggestRow.required)) * 100)}
                />
              ) : null}
            </>
          ) : (
            <p className="muted">Change a number above to see the effect.</p>
          )}
        </div>
      </section>
    </div>
  );
}
