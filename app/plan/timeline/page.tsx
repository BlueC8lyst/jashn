"use client";

import { memo, useState } from "react";
import { describeDaysFromNow, formatDate } from "@/lib/domain/dates";
import type { ScheduledTask } from "@/lib/domain/schedule";
import { announce } from "@/lib/client/announce";
import { usePlanView } from "@/lib/client/hooks";
import { dispatch } from "@/lib/client/store";
import { Badge } from "@/components/ui/primitives";

const STATUS_BADGE = {
  done: ["ok", "Done"],
  overdue: ["bad", "Overdue"],
  at_risk: ["bad", "At risk"],
  ready: ["info", "Ready to start"],
  waiting: ["plain", "Waiting"],
} as const;

interface TaskItemProps {
  task: ScheduledTask;
  today: string;
}

const TaskItem = memo(function TaskItem({ task, today }: TaskItemProps) {
  const [delaying, setDelaying] = useState(false);
  const [lateTo, setLateTo] = useState(task.delayedTo ?? "");
  const [tone, label] = STATUS_BADGE[task.status];
  const done = task.status === "done";

  return (
    <li className={done ? "task is-done" : "task"}>
      <div className="row-between">
        <h3>{task.title}</h3>
        <span>
          <Badge tone={tone}>{label}</Badge>{" "}
          {task.critical && !done ? <Badge tone="warn">No slack</Badge> : null}
        </span>
      </div>
      <p className="small muted">
        {done
          ? `Completed ${task.doneOn ? formatDate(task.doneOn) : ""}`
          : `Due ${formatDate(task.due)} (${describeDaysFromNow(task.daysLeft)})`}
        {task.delayedTo && !done ? `. You expect it by ${formatDate(task.delayedTo)}` : ""}
      </p>
      <p>{task.detail}</p>
      {task.waitingOn.length > 0 && !done ? <p className="small">Waiting on: {task.waitingOn.join(", ")}</p> : null}
      <div className="row">
        {done ? (
          <button type="button" className="btn btn-small btn-quiet" onClick={() => { dispatch({ type: "task/reopen", id: task.id }); announce(`Reopened: ${task.title}`); }}>
            Reopen<span className="sr-only">: {task.title}</span>
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-small" onClick={() => { dispatch({ type: "task/done", id: task.id, on: today }); announce(`Marked done: ${task.title}`); }}>
              Mark done<span className="sr-only">: {task.title}</span>
            </button>
            <button type="button" className="btn btn-small btn-quiet" aria-expanded={delaying} onClick={() => setDelaying((v) => !v)}>
              Running late<span className="sr-only">: {task.title}</span>
            </button>
          </>
        )}
      </div>
      {delaying && !done ? (
        <form
          className="row"
          onSubmit={(event) => {
            event.preventDefault();
            dispatch({ type: "task/delay", id: task.id, to: lateTo || null });
            announce(lateTo ? "Delay recorded. The timeline was updated." : "Delay cleared.");
            setDelaying(false);
          }}
        >
          <label className="field">
            <span className="label">New expected finish</span>
            <input type="date" min={today} value={lateTo} onChange={(e) => setLateTo(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-small">
            Save
          </button>
        </form>
      ) : null}
    </li>
  );
});

function Group({ title, tasks, today }: { title: string; tasks: ScheduledTask[]; today: string }) {
  if (tasks.length === 0) return null;
  return (
    <section aria-label={title} className="stack">
      <h2>{title}</h2>
      <ul className="tasks">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} today={today} />
        ))}
      </ul>
    </section>
  );
}

export default function TimelinePage() {
  const view = usePlanView();
  if (!view) return null;
  const { schedule, today } = view;
  const open = schedule.tasks.filter((t) => t.status !== "done");
  const attention = open.filter((t) => t.status === "overdue" || t.status === "at_risk");
  const rest = open.filter((t) => t.status !== "overdue" && t.status !== "at_risk");
  const soon = rest.filter((t) => t.daysLeft <= 30);
  const later = rest.filter((t) => t.daysLeft > 30);
  const done = schedule.tasks.filter((t) => t.status === "done");
  const impacted = schedule.tasks.filter((t) => schedule.impactedByDelays.includes(t.id));

  return (
    <div className="stack">
      <div>
        <h1>Timeline</h1>
        <p className="muted">
          Deadlines are worked back from the event date and respect what depends on what: you cannot pay a caterer before the venue is locked.
          {schedule.compressed ? ` With ${schedule.daysAvailable} days to go, the usual lead times are compressed to ${Math.round(schedule.compression * 100)}%.` : ""}
        </p>
      </div>
      {impacted.length > 0 ? (
        <div className="banner banner-warn" role="note">
          <strong>Because of a delay you recorded,</strong> these tasks now need attention: {impacted.map((t) => t.title).join("; ")}.
        </div>
      ) : null}
      <Group title="Needs attention" tasks={attention} today={today} />
      <Group title="Coming up in the next 30 days" tasks={soon} today={today} />
      <Group title="Later" tasks={later} today={today} />
      {done.length > 0 ? (
        <details>
          <summary>Completed ({done.length})</summary>
          <ul className="tasks">
            {done.map((task) => (
              <TaskItem key={task.id} task={task} today={today} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
