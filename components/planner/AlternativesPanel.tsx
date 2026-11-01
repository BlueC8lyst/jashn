"use client";

import { Badge } from "@/components/ui/primitives";
import { useAiCall } from "@/lib/client/useAiCall";
import type { EventBrief } from "@/lib/domain/types";

/** "How do I keep the experience while spending less here?": AI suggestions for one trimmed category. */
export function AlternativesPanel({ brief, categoryId, label, cutPercent }: { brief: EventBrief; categoryId: string; label: string; cutPercent: number }) {
  const { state, run } = useAiCall<"alternatives">();
  return (
    <div className="card stack" aria-live="polite">
      <h3>Keeping {label} special on less</h3>
      <button
        type="button"
        className="btn btn-small"
        disabled={state.status === "loading"}
        onClick={() => run({ task: "alternatives", input: { brief, categoryId, cutPercent: Math.max(1, Math.min(90, cutPercent)) } })}
      >
        {state.status === "loading" ? "Thinking…" : `Suggest ways to cut about ${cutPercent}%`}
      </button>
      {state.status === "error" ? <p className="error">{state.error}</p> : null}
      {state.data ? (
        <>
          <p>
            <Badge tone={state.source === "ai" ? "info" : "plain"}>{state.source === "ai" ? "AI suggestions" : "Built-in suggestions"}</Badge>
          </p>
          <ul>
            {state.data.options.map((option) => (
              <li key={option.title}>
                <strong>{option.title}.</strong> {option.description} <span className="muted">What changes: {option.whatChanges}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
