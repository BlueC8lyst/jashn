"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { buildIcs } from "@/lib/domain/ics";
import { announce } from "@/lib/client/announce";
import { downloadText, safeFilename } from "@/lib/client/download";
import { usePlanView } from "@/lib/client/hooks";
import { resetPlan } from "@/lib/client/store";
import { ChangePlanDialog } from "./ChangePlanDialog";

const LINKS = [
  { href: "/plan", label: "Overview" },
  { href: "/plan/budget", label: "Budget" },
  { href: "/plan/timeline", label: "Timeline" },
  { href: "/plan/vendors", label: "Vendors" },
  { href: "/plan/ideas", label: "Ideas" },
] as const;

export function PlannerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const view = usePlanView();
  const [changing, setChanging] = useState(false);

  if (view === undefined) {
    return (
      <main id="main" tabIndex={-1} className="container">
        <p role="status">Loading your plan…</p>
      </main>
    );
  }
  if (view === null) {
    return (
      <main id="main" tabIndex={-1} className="container narrow stack">
        <h1>No plan yet</h1>
        <p>Start with a few questions, or open a worked example.</p>
        <Link href="/start" className="btn">
          Plan my event
        </Link>
      </main>
    );
  }

  const { state, schedule } = view;

  function exportCalendar() {
    const ics = buildIcs({ title: state.brief.title, eventDate: state.brief.date, tasks: schedule.tasks, now: new Date() });
    downloadText(`${safeFilename(state.brief.title)}-plan.ics`, ics, "text/calendar");
    announce("Calendar file downloaded.");
  }

  return (
    <>
      <header className="site-header">
        <div className="bar">
          <Link href="/" className="brand">
            Jashn
          </Link>
          <nav aria-label="Plan sections">
            <ul className="nav">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} {...(pathname === link.href ? { "aria-current": "page" as const } : {})}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="bar-end">
            <button type="button" className="btn btn-small" onClick={() => setChanging(true)}>
              Change the plan
            </button>
            <button type="button" className="btn btn-small btn-quiet" onClick={exportCalendar}>
              Export calendar
            </button>
            <button type="button" className="btn btn-small btn-quiet" onClick={() => window.print()}>
              Print
            </button>
            <button
              type="button"
              className="btn btn-small btn-quiet"
              onClick={() => {
                if (window.confirm("Delete this plan from your browser? This cannot be undone.")) resetPlan();
              }}
            >
              Start over
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="container">
        {children}
      </main>
      <p className="footer">Planning estimates, not quotes. Always confirm prices and availability with each vendor.</p>
      <ChangePlanDialog open={changing} onClose={() => setChanging(false)} view={view} />
    </>
  );
}
