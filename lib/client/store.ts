import { PlannerStateSchema } from "@/lib/domain/schemas";
import { reduce, type Action } from "@/lib/domain/reducer";
import type { PlannerState } from "@/lib/domain/types";

/**
 * The browser-side planner store: a tiny external store (no state library)
 * that React reads with `useSyncExternalStore`.
 *
 * - The whole plan lives in `localStorage`; the server never sees it, so there
 *   is nothing to leak, no database to run and no server memory to grow.
 * - Reads are validated against the schema, so a corrupted or tampered value
 *   starts a fresh plan instead of crashing the app.
 * - Writes are debounced and flushed when the page is hidden, so rapid edits
 *   cost one write.
 * - `undefined` means "not loaded yet" (server render); `null` means "no plan".
 */

const STORAGE_KEY = "jashn:plan:v1";
const PERSIST_DELAY_MS = 250;

let state: PlannerState | null | undefined;
let persistTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function read(): PlannerState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = PlannerStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as PlannerState) : null;
  } catch {
    return null;
  }
}

function persistNow(): void {
  clearTimeout(persistTimer);
  persistTimer = undefined;
  try {
    if (state) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage full or blocked: the in-memory plan keeps working */
  }
}

function commit(next: PlannerState | null): void {
  state = next;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, PERSIST_DELAY_MS);
  listeners.forEach((listener) => listener());
}

export function getSnapshot(): PlannerState | null | undefined {
  if (state === undefined) state = read();
  return state;
}

export function getServerSnapshot(): undefined {
  return undefined;
}

let wired = false;
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!wired && typeof window !== "undefined") {
    wired = true;
    window.addEventListener("pagehide", persistNow);
    // Keep several open tabs in step.
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY) return;
      state = read();
      listeners.forEach((l) => l());
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

export function dispatch(action: Action): void {
  const current = getSnapshot();
  if (!current) return;
  const next = reduce(current, action, new Date().toISOString());
  if (next !== current) commit(next);
}

export function startPlan(plan: PlannerState): void {
  commit(plan);
}

export function resetPlan(): void {
  commit(null);
  persistNow();
}

/** Test helper: forget the in-memory copy so the next read goes back to storage. */
export function __resetStoreForTests(): void {
  state = undefined;
  clearTimeout(persistTimer);
  listeners.clear();
}
