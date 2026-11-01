"use client";

import { useState } from "react";
import type { Concept } from "@/lib/ai-contract";
import {
  ACCESS_NEED_LABELS,
  AGE_GROUP_LABELS,
  ATMOSPHERE_LABELS,
} from "@/lib/domain/catalog/labels";
import {
  ACCESS_NEEDS,
  AGE_GROUPS,
  ATMOSPHERES,
  type AccessNeed,
  type AgeGroup,
  type Atmosphere,
  type Personalisation,
} from "@/lib/domain/types";
import { announce } from "@/lib/client/announce";
import { usePlanView } from "@/lib/client/hooks";
import { dispatch } from "@/lib/client/store";
import { useAiCall } from "@/lib/client/useAiCall";
import { ChoiceGroup, Field } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";

const COST_TONE = {
  low: "ok",
  medium: "plain",
  high: "warn",
} as const;

export default function IdeasPage() {
  const view = usePlanView();
  const { state, run } = useAiCall<"ideas">();
  const [feedback, setFeedback] = useState("");
  const [lastConcepts, setLastConcepts] = useState<Concept[]>([]);
  const [editingPrefs, setEditingPrefs] = useState(false);
  const [prefs, setPrefs] = useState<Personalisation | null>(null);

  const brief = view?.state.brief;
  const allocations = view?.state.allocations;
  const direction = view?.state.direction;

  if (!view || !brief || !allocations) return null;

  const protect = allocations.filter((a) => a.priority === "protect").map((a) => a.id);
  const flexible = allocations.filter((a) => a.priority === "flexible").map((a) => a.id);

  const handleGenerate = async (withFeedback = false) => {
    const prev = withFeedback && lastConcepts.length > 0
      ? lastConcepts.map((c) => ({ title: c.title, summary: c.description }))
      : undefined;

    const result = await run({
      task: "ideas",
      input: {
        brief,
        protect,
        flexible,
        feedback: withFeedback && feedback.trim() ? feedback.trim() : undefined,
        previous: prev,
      },
    });

    if (result?.concepts && result.concepts.length > 0) {
      setLastConcepts(result.concepts);
      announce(`Generated ${result.concepts.length} celebration concepts.`);
    }
  };

  const handleChooseDirection = (concept: Concept) => {
    const nextDirection = { title: concept.title, summary: concept.description };
    dispatch({ type: "direction/choose", direction: nextDirection });
    announce(`Chose direction: ${concept.title}.`);
  };

  const handleClearDirection = () => {
    dispatch({ type: "direction/choose", direction: null });
    announce("Cleared chosen direction.");
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prefs) return;
    dispatch({ type: "personalisation/update", value: prefs });
    setEditingPrefs(false);
    announce("Personalisation preferences updated.");
  };

  const concepts = state.data?.concepts ?? lastConcepts;
  const questions = state.data?.questions ?? [];

  return (
    <div className="stack">
      <div>
        <h1>Personalised Celebration Ideas</h1>
        <p className="muted">
          Ideas that reflect your family, guests, and what you care about most. Generated concepts consider your budget constraints, accessibility needs, and traditions.
        </p>
      </div>

      {direction ? (
        <section className="card banner-ok stack" aria-labelledby="active-dir-title">
          <div className="row-between">
            <h2 id="active-dir-title">Your chosen direction</h2>
            <Badge tone="ok">Active</Badge>
          </div>
          <div>
            <h3>{direction.title}</h3>
            <p>{direction.summary}</p>
          </div>
          <div className="row">
            <button type="button" className="btn btn-small btn-quiet" onClick={handleClearDirection}>
              Clear this direction
            </button>
          </div>
        </section>
      ) : (
        <section className="card banner-info" aria-labelledby="no-dir-title">
          <h2 id="no-dir-title" className="small">No direction chosen yet</h2>
          <p className="small muted">
            Explore the concepts below and choose one to anchor your planning. It will guide your timeline and vendor choices.
          </p>
        </section>
      )}

      <div className="card stack">
        <div className="row-between">
          <div>
            <h2>Explore Concepts</h2>
            <p className="small muted">
              Click below to generate concepts tailored to your {brief.type} for {brief.guests} guests in {brief.city || "your city"}.
            </p>
          </div>
          <button
            type="button"
            className="btn"
            disabled={state.status === "loading"}
            onClick={() => handleGenerate(false)}
          >
            {state.status === "loading" ? "Thinking…" : concepts.length > 0 ? "Regenerate concepts" : "Generate ideas"}
          </button>
        </div>

        {state.source ? (
          <p>
            <Badge tone={state.source === "ai" ? "info" : "plain"}>
              {state.source === "ai" ? "AI suggestions" : "Built-in suggestions"}
            </Badge>
          </p>
        ) : null}

        {state.status === "error" ? <p className="error">{state.error}</p> : null}

        {questions.length > 0 ? (
          <div className="banner banner-warn stack">
            <strong>To help shape your ideas, consider:</strong>
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              {questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {concepts.length > 0 ? (
          <div className="grid grid-3">
            {concepts.map((concept) => {
              const isSelected = direction?.title === concept.title;
              return (
                <article
                  key={concept.title}
                  className={`card stack ${isSelected ? "banner-ok" : ""}`}
                  style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
                >
                  <div className="stack">
                    <div className="row-between">
                      <Badge tone={COST_TONE[concept.costLevel]}>{concept.costLevel} cost</Badge>
                      {isSelected ? <Badge tone="ok">Selected</Badge> : null}
                    </div>
                    <div>
                      <h3 style={{ margin: "0.2rem 0" }}>{concept.title}</h3>
                      <p className="small muted">
                        <em>{concept.tagline}</em>
                      </p>
                      <p>{concept.description}</p>
                    </div>

                    <div>
                      <h4 className="small">Highlights:</h4>
                      <ul className="small">
                        {concept.highlights.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="small">
                      <strong>Best for:</strong> {concept.goodFor}
                    </div>

                    {concept.adaptations.length > 0 ? (
                      <div className="small banner-info banner" style={{ padding: "0.5rem" }}>
                        <strong>Family adaptations:</strong>
                        <ul style={{ margin: "0.2rem 0 0", paddingLeft: "1rem" }}>
                          {concept.adaptations.map((a) => (
                            <li key={a}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <div style={{ marginTop: "1rem" }}>
                    <button
                      type="button"
                      className={`btn btn-small ${isSelected ? "btn-quiet" : ""}`}
                      style={{ width: "100%" }}
                      onClick={() => handleChooseDirection(concept)}
                    >
                      {isSelected ? "Selected direction" : "Choose this direction"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {concepts.length > 0 ? (
          <div className="card stack banner-info" style={{ marginTop: "1rem" }}>
            <h3>Refine these concepts</h3>
            <p className="small muted">
              Ask for changes (e.g. “We need activities for both children and seniors”, “Make it more intimate and food-focused”, “Something more casual”).
            </p>
            <div className="row">
              <input
                type="text"
                placeholder="How would you like to refine the ideas?"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                style={{ flex: "1 1 18rem" }}
              />
              <button
                type="button"
                className="btn btn-small"
                disabled={!feedback.trim() || state.status === "loading"}
                onClick={() => handleGenerate(true)}
              >
                {state.status === "loading" ? "Adapting…" : "Refine ideas with AI"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <section className="card stack" aria-labelledby="personalisation-heading">
        <div className="row-between">
          <div>
            <h2 id="personalisation-heading">Event Preferences</h2>
            <p className="small muted">Atmosphere, accessibility needs, and family traditions shaping this event.</p>
          </div>
          <button
            type="button"
            className="btn btn-small btn-quiet"
            onClick={() => {
              if (!editingPrefs) setPrefs({ ...brief.personalisation });
              setEditingPrefs(!editingPrefs);
            }}
          >
            {editingPrefs ? "Hide editor" : "Edit preferences"}
          </button>
        </div>

        {!editingPrefs ? (
          <div className="grid grid-3 small">
            <div>
              <strong>Atmosphere:</strong>{" "}
              {brief.personalisation.atmosphere ? ATMOSPHERE_LABELS[brief.personalisation.atmosphere] : "Not set"}
            </div>
            <div>
              <strong>Age groups:</strong>{" "}
              {brief.personalisation.ageGroups.length > 0
                ? brief.personalisation.ageGroups.map((g) => AGE_GROUP_LABELS[g]).join(", ")
                : "All ages"}
            </div>
            <div>
              <strong>Accessibility:</strong>{" "}
              {brief.personalisation.accessNeeds.length > 0
                ? brief.personalisation.accessNeeds.map((a) => ACCESS_NEED_LABELS[a]).join(", ")
                : "None specified"}
            </div>
            {brief.personalisation.culturalNotes ? (
              <div style={{ gridColumn: "1 / -1" }}>
                <strong>Traditions:</strong> {brief.personalisation.culturalNotes}
              </div>
            ) : null}
            {brief.personalisation.venueNotes ? (
              <div style={{ gridColumn: "1 / -1" }}>
                <strong>Venue limits:</strong> {brief.personalisation.venueNotes}
              </div>
            ) : null}
          </div>
        ) : prefs ? (
          <form onSubmit={handleSavePreferences} className="stack">
            <ChoiceGroup
              legend="Desired atmosphere"
              name="atmosphere"
              mode="radio"
              options={ATMOSPHERES.map((value) => ({
                value,
                label: ATMOSPHERE_LABELS[value],
              }))}
              value={prefs.atmosphere ? [prefs.atmosphere] : []}
              onChange={(value) => setPrefs({ ...prefs, atmosphere: (value[0] as Atmosphere) ?? null })}
            />

            <ChoiceGroup
              legend="Guest age groups"
              name="ageGroups"
              mode="checkbox"
              options={AGE_GROUPS.map((value) => ({ value, label: AGE_GROUP_LABELS[value] }))}
              value={prefs.ageGroups}
              onChange={(value) => setPrefs({ ...prefs, ageGroups: value as AgeGroup[] })}
            />

            <ChoiceGroup
              legend="Accessibility and comfort"
              name="accessNeeds"
              mode="checkbox"
              options={ACCESS_NEEDS.map((value) => ({ value, label: ACCESS_NEED_LABELS[value] }))}
              value={prefs.accessNeeds}
              onChange={(value) => setPrefs({ ...prefs, accessNeeds: value as AccessNeed[] })}
            />

            <Field label="Interests and themes">
              {(c) => (
                <textarea
                  rows={2}
                  {...c}
                  value={prefs.interests}
                  onChange={(e) => setPrefs({ ...prefs, interests: e.target.value })}
                />
              )}
            </Field>

            <Field label="Cultural or family traditions">
              {(c) => (
                <textarea
                  rows={2}
                  {...c}
                  value={prefs.culturalNotes}
                  onChange={(e) => setPrefs({ ...prefs, culturalNotes: e.target.value })}
                />
              )}
            </Field>

            <Field label="Venue limits or preferences">
              {(c) => (
                <textarea
                  rows={2}
                  {...c}
                  value={prefs.venueNotes}
                  onChange={(e) => setPrefs({ ...prefs, venueNotes: e.target.value })}
                />
              )}
            </Field>

            <div className="row">
              <button type="submit" className="btn btn-small">
                Save preferences
              </button>
              <button
                type="button"
                className="btn btn-small btn-quiet"
                onClick={() => setEditingPrefs(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
