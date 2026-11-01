"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/primitives";
import { useAiCall } from "@/lib/client/useAiCall";
import type { EventBrief } from "@/lib/domain/types";

interface VendorQuestionsPanelProps {
  brief: EventBrief;
  vendorTypeId: string;
  vendorLabel: string;
  baseQuestions: readonly string[];
}

export function VendorQuestionsPanel({
  brief,
  vendorTypeId,
  vendorLabel,
  baseQuestions,
}: VendorQuestionsPanelProps) {
  const { state, run } = useAiCall<"vendor_questions">();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (q: string) => {
    setChecked((prev) => ({ ...prev, [q]: !prev[q] }));
  };

  const handleFetch = () => {
    run({ task: "vendor_questions", input: { brief, vendorTypeId } });
  };

  const questions = state.data?.questions ?? baseQuestions;
  const mustConfirm = state.data?.mustConfirm ?? [
    "Date, time and address in writing.",
    "Exactly what is included and what costs extra.",
    "Payment schedule and cancellation terms.",
  ];

  return (
    <div className="card stack" aria-live="polite">
      <div className="row-between">
        <h4>Questions to ask {vendorLabel}</h4>
        <button
          type="button"
          className="btn btn-small btn-quiet"
          disabled={state.status === "loading"}
          onClick={handleFetch}
        >
          {state.status === "loading"
            ? "Thinking…"
            : state.data
              ? "Refresh tailored questions"
              : "Tailor with AI"}
        </button>
      </div>

      {state.source ? (
        <p>
          <Badge tone={state.source === "ai" ? "info" : "plain"}>
            {state.source === "ai" ? "AI tailored" : "Built-in checklist"}
          </Badge>
        </p>
      ) : null}

      {state.status === "error" ? <p className="error">{state.error}</p> : null}

      <ul className="plain-list stack">
        {questions.map((question) => {
          const isDone = !!checked[question];
          return (
            <li key={question} className="row">
              <label className="choice" style={{ width: "100%" }}>
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => toggle(question)}
                />
                <span className={isDone ? "muted" : ""}>{question}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <details>
        <summary>What to confirm in writing before paying a deposit</summary>
        <ul className="stack">
          {mustConfirm.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
