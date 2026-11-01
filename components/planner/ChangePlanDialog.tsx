"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { diffDays, formatDate } from "@/lib/domain/dates";
import { previewRevision, resolveRevision, validateRevision, type RevisionChange } from "@/lib/domain/revise";
import type { OptionId } from "@/lib/domain/scenarios";
import { LIMITS } from "@/lib/domain/types";
import { announce } from "@/lib/client/announce";
import type { PlanView } from "@/lib/client/hooks";
import { dispatch } from "@/lib/client/store";
import { Field } from "@/components/ui/form";
import { OptionList } from "./OptionList";

const toInt = (value: string): number => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN);

/**
 * "Change the plan": edit the date, guest count or budget and see exactly what
 * would move BEFORE anything is committed. Uses the native <dialog>, which
 * provides focus trapping, Escape-to-close and a backdrop with no extra code.
 */
export function ChangePlanDialog({ open, onClose, view }: { open: boolean; onClose: () => void; view: PlanView }) {
  const { state, today } = view;
  const ref = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(state.brief.date);
  const [guests, setGuests] = useState(String(state.brief.guests));
  const [budget, setBudget] = useState(String(state.brief.budget));
  const [chosen, setChosen] = useState<OptionId | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setDate(state.brief.date);
      setGuests(String(state.brief.guests));
      setBudget(String(state.brief.budget));
      setChosen(null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, state.brief.date, state.brief.guests, state.brief.budget]);

  const change = useMemo<RevisionChange>(() => {
    const next: RevisionChange = {};
    if (date !== state.brief.date) next.date = date;
    const g = toInt(guests);
    const b = toInt(budget);
    if (g !== state.brief.guests) next.guests = g;
    if (b !== state.brief.budget) next.budget = b;
    return next;
  }, [date, guests, budget, state.brief]);

  const problems = useMemo(() => validateRevision(change, today), [change, today]);
  const preview = useMemo(() => {
    if (problems.length > 0 || Object.keys(change).length === 0) return null;
    try {
      return previewRevision(state, change, today);
    } catch {
      return null;
    }
  }, [problems, change, state, today]);

  const options = preview?.scenario?.options ?? [];
  const selected = options.find((o) => o.id === chosen)?.id ?? options[0]?.id ?? null;
  const canApply = preview !== null && (options.length === 0 || selected !== null);

  function apply() {
    if (!preview) return;
    const applied = resolveRevision(preview, state, selected ?? undefined);
    dispatch({ type: "plan/revise", ...applied });
    announce("Plan updated. Completed tasks and bookings were kept.");
    onClose();
  }

  return (
    <dialog ref={ref} aria-labelledby="change-title" onClose={onClose}>
      <form
        method="dialog"
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (canApply) apply();
        }}
      >
        <h2 id="change-title">Change the plan</h2>
        <p className="muted">
          Tell Jashn what changed. Finished tasks, quotes and bookings are kept, and you will see what moves before anything is applied.
        </p>
        <div className="grid grid-3">
          <Field label="Event date" error={problems.find((p) => p.includes("date"))}>
            {(control) => <input type="date" {...control} min={today} value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Guests" error={problems.find((p) => p.includes("Guests"))}>
            {(control) => <input type="number" inputMode="numeric" min={1} max={LIMITS.guestsMax} {...control} value={guests} onChange={(e) => setGuests(e.target.value)} />}
          </Field>
          <Field label="Total budget" error={problems.find((p) => p.includes("Budget"))}>
            {(control) => <input type="number" inputMode="numeric" min={1} {...control} value={budget} onChange={(e) => setBudget(e.target.value)} />}
          </Field>
        </div>

        <div aria-live="polite" className="stack">
          {preview ? (
            <section aria-labelledby="impact-title" className="card">
              <h3 id="impact-title">What this changes</h3>
              <ul>
                {preview.summary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {preview.moves.length > 0 ? (
                <details>
                  <summary>See the {preview.moves.length} moved deadlines</summary>
                  <ul>
                    {preview.moves.slice(0, 12).map((move) => (
                      <li key={move.id}>
                        {move.title}: {formatDate(move.from)} to {formatDate(move.to)} ({Math.abs(move.shiftDays)} days {move.shiftDays < 0 ? "earlier" : "later"})
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </section>
          ) : Object.keys(change).length === 0 ? (
            <p className="muted">Change one of the fields above to preview the impact.</p>
          ) : null}
          {preview && options.length > 0 ? (
            <OptionList
              legend={preview.scenario && preview.scenario.gap > 0 ? "How do you want to close the budget gap?" : "Where should the extra budget go?"}
              options={options}
              currency={state.brief.currency}
              value={selected}
              onChange={setChosen}
            />
          ) : null}
        </div>

        <div className="row-between">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={!canApply} aria-disabled={!canApply}>
            Apply changes{preview && date !== state.brief.date ? ` (${Math.abs(diffDays(state.brief.date, date))} days ${date < state.brief.date ? "earlier" : "later"})` : ""}
          </button>
        </div>
      </form>
    </dialog>
  );
}
