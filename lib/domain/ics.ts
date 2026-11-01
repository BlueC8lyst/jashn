import { fromDay, toDay } from "./dates";
import type { ScheduledTask } from "./schedule";
import type { IsoDate } from "./types";

/**
 * Minimal RFC 5545 calendar export: one all-day entry per open task, plus the
 * event itself. Written by hand (about 60 lines) instead of pulling in a
 * library, which keeps the client bundle and dependency surface small.
 */

const encoder = new TextEncoder();

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line at 75 octets, never splitting a multi-byte character. */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const compactDate = (iso: IsoDate) => iso.replace(/-/g, "");

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

interface IcsInput {
  title: string;
  eventDate: IsoDate;
  tasks: readonly ScheduledTask[];
  now: Date;
}

export function buildIcs({ title, eventDate, tasks, now }: IcsInput): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jashn//Event Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(`${title} plan`)}`,
  ];
  const entry = (uid: string, date: IsoDate, summary: string, description: string) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}@jashn.app`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${compactDate(date)}`,
      `DTEND;VALUE=DATE:${compactDate(fromDay(toDay(date) + 1))}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(description)}`,
      "END:VEVENT",
    );
  };

  entry("event", eventDate, title, "The big day.");
  for (const task of tasks) {
    if (task.status === "done") continue;
    entry(`task-${task.id}`, task.due, `Due: ${task.title}`, task.detail);
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
