import { createPlan } from "@/lib/domain/plan";
import { sampleFor } from "@/lib/domain/samples";
import type { EventType, PlannerState } from "@/lib/domain/types";

export const TODAY = "2026-10-27";
export const NOW_ISO = "2026-10-27T09:00:00.000Z";

export function samplePlan(type: EventType = "wedding"): PlannerState {
  const { brief, priorities } = sampleFor(type, TODAY);
  return createPlan(brief, priorities, NOW_ISO);
}
