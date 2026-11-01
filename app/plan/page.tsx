"use client";

import Link from "next/link";
import { describeDaysFromNow, formatDateLong } from "@/lib/domain/dates";
import { formatMoney, percentOf } from "@/lib/domain/money";
import { usePlanView } from "@/lib/client/hooks";
import { Badge, MeterBar } from "@/components/ui/primitives";

export default function OverviewPage() {
  const view = usePlanView();
  if (!view) return null;
  const { state, schedule, budget } = view;
  const { brief } = state;
  const money = (value: number) => formatMoney(value, brief.currency);
  const trouble = schedule.overdue.length + schedule.atRisk.length;

  return (
    <div className="stack">
      <div>
        <h1>{brief.title}</h1>
        <p className="muted">
          {formatDateLong(brief.date)} ({schedule.eventPassed ? "this date has passed" : describeDaysFromNow(schedule.daysAvailable)})
          {brief.city ? `, ${brief.city}` : ""}
        </p>
      </div>

      {schedule.eventPassed ? <div className="banner banner-info">This event date has passed. Use “Change the plan” to set a new date.</div> : null}
      {schedule.compressed && schedule.compression < 0.5 && !schedule.eventPassed ? (
        <div className="banner banner-warn" role="note">
          <strong>Tight runway.</strong> You have {schedule.daysAvailable} days, so lead times are compressed to {Math.round(schedule.compression * 100)}% of normal.
          Decide quickly and expect to book on availability rather than price.
        </div>
      ) : null}
      {trouble > 0 ? (
        <div className="banner banner-bad" role="note">
          <strong>
            {trouble} task{trouble === 1 ? " needs" : "s need"} attention.
          </strong>{" "}
          <Link href="/plan/timeline">See the timeline</Link>.
        </div>
      ) : null}
      {budget.headroom < 0 ? (
        <div className="banner banner-bad" role="note">
          <strong>Projected {money(-budget.headroom)} over budget.</strong> Your quotes and bookings add up to more than your total.{" "}
          <Link href="/plan/budget">Review the budget</Link>.
        </div>
      ) : null}

      <section aria-label="Key figures" className="grid grid-3">
        <div className="card">
          <p className="muted">Budget</p>
          <p className="stat">{money(brief.budget)}</p>
          <p className="small muted">About {money(budget.perGuestPlanned)} per guest</p>
        </div>
        <div className="card">
          <p className="muted">Guests</p>
          <p className="stat">{brief.guests}</p>
        </div>
        <div className="card">
          <p className="muted">Tasks done</p>
          <p className="stat">
            {schedule.doneCount} of {schedule.tasks.length}
          </p>
        </div>
      </section>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="next-title">
          <h2 id="next-title">Next up</h2>
          {schedule.nextUp.length === 0 ? (
            <p>Everything that can be done now is done. 🎉</p>
          ) : (
            <ol className="stack">
              {schedule.nextUp.map((task) => (
                <li key={task.id}>
                  <strong>{task.title}</strong>
                  <br />
                  <span className="small muted">Due {describeDaysFromNow(task.daysLeft)}</span>{" "}
                  {task.critical ? <Badge tone="warn">No slack</Badge> : null}
                </li>
              ))}
            </ol>
          )}
          <p>
            <Link href="/plan/timeline">Open the full timeline</Link>
          </p>
        </section>

        <section className="card" aria-labelledby="where-title">
          <h2 id="where-title">Where the money goes</h2>
          <ul className="stack plain-list">
            {budget.rows.slice(0, 6).map((row) => (
              <li key={row.id}>
                <div className="row-between small">
                  <span>{row.label}</span>
                  <span>
                    {money(row.projected)} <span className="muted">({percentOf(row.projected, budget.total)}%)</span>
                  </span>
                </div>
                <MeterBar value={row.projected} max={Math.max(...budget.rows.map((r) => r.projected))} />
              </li>
            ))}
          </ul>
          <p>
            <Link href="/plan/budget">Open the budget</Link>
          </p>
        </section>
      </div>

      <div className="grid grid-2">
        <section className="card" aria-labelledby="dir-title">
          <h2 id="dir-title">Your direction</h2>
          {state.direction ? (
            <>
              <p>
                <strong>{state.direction.title}</strong>
              </p>
              <p>{state.direction.summary}</p>
            </>
          ) : (
            <p>
              You have not chosen a direction yet. <Link href="/plan/ideas">Explore ideas that fit your family</Link>.
            </p>
          )}
        </section>
        <section className="card" aria-labelledby="log-title">
          <h2 id="log-title">Recent changes</h2>
          <ul>
            {state.log.slice(0, 5).map((entry) => (
              <li key={entry.at + entry.text}>{entry.text}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
