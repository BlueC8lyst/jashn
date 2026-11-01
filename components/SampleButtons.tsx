"use client";

import { useRouter } from "next/navigation";
import { EVENT_TYPE_LABELS } from "@/lib/domain/catalog/labels";
import { todayIso } from "@/lib/domain/dates";
import { createPlan } from "@/lib/domain/plan";
import { sampleFor } from "@/lib/domain/samples";
import { EVENT_TYPES, type EventType } from "@/lib/domain/types";
import { startPlan } from "@/lib/client/store";

/** One click to a fully worked example, so the app can be explored without typing anything. */
export function SampleButtons() {
  const router = useRouter();
  function load(type: EventType) {
    const { brief, priorities } = sampleFor(type, todayIso());
    startPlan(createPlan(brief, priorities));
    router.push("/plan");
  }
  return (
    <div className="row" role="group" aria-label="Try a worked example">
      {EVENT_TYPES.map((type) => (
        <button key={type} type="button" className="btn btn-quiet" onClick={() => load(type)}>
          Try the sample {EVENT_TYPE_LABELS[type].label.toLowerCase()}
        </button>
      ))}
    </div>
  );
}
