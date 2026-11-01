"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES, CONTINGENCY_ID } from "@/lib/domain/catalog/categories";
import {
  ACCESS_NEED_LABELS,
  AGE_GROUP_LABELS,
  ATMOSPHERE_LABELS,
  CURRENCY_LABELS,
  EVENT_TYPE_LABELS,
  FEEL_LABELS,
  PRIORITY_LABELS,
} from "@/lib/domain/catalog/labels";
import { diffDays, isValidIsoDate } from "@/lib/domain/dates";
import { createPlan } from "@/lib/domain/plan";
import { EventBriefSchema } from "@/lib/domain/schemas";
import {
  ACCESS_NEEDS,
  AGE_GROUPS,
  ATMOSPHERES,
  CURRENCIES,
  EVENT_TYPES,
  FEELS,
  LIMITS,
  type AccessNeed,
  type AgeGroup,
  type Atmosphere,
  type Currency,
  type EventBrief,
  type EventType,
  type Feel,
  type Priority,
} from "@/lib/domain/types";
import { announce } from "@/lib/client/announce";
import { useToday } from "@/lib/client/hooks";
import { startPlan } from "@/lib/client/store";
import { ChoiceGroup, Field } from "@/components/ui/form";

interface Draft {
  type: EventType;
  title: string;
  date: string;
  city: string;
  currency: Currency;
  budget: string;
  guests: string;
  feel: Feel;
  priorities: Record<string, Priority>;
  mustHaves: string;
  atmosphere: Atmosphere | "";
  ageGroups: AgeGroup[];
  accessNeeds: AccessNeed[];
  interests: string;
  culturalNotes: string;
  venueNotes: string;
}

const INITIAL: Draft = {
  type: "wedding",
  title: "",
  date: "",
  city: "",
  currency: "INR",
  budget: "",
  guests: "",
  feel: "balanced",
  priorities: {},
  mustHaves: "",
  atmosphere: "",
  ageGroups: [],
  accessNeeds: [],
  interests: "",
  culturalNotes: "",
  venueNotes: "",
};

const STEPS = ["Occasion", "Budget and guests", "What matters most", "Personal touches"] as const;
type Errors = Record<string, string>;

const toInt = (value: string): number => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN);
const mustHaveList = (text: string): string[] => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

function validate(step: number, draft: Draft, today: string | null): Errors {
  const errors: Errors = {};
  if (step === 0) {
    if (!draft.title.trim()) errors.title = "Give your event a name, for example “Riya and Arjun's wedding”.";
    else if (draft.title.trim().length > LIMITS.titleMax) errors.title = `Keep the name under ${LIMITS.titleMax} characters.`;
    if (!isValidIsoDate(draft.date)) errors.date = "Choose the event date.";
    else if (today && diffDays(today, draft.date) < 0) errors.date = "The date cannot be in the past.";
  }
  if (step === 1) {
    const budget = toInt(draft.budget);
    const guests = toInt(draft.guests);
    if (!Number.isInteger(budget) || budget < 1 || budget > LIMITS.budgetMax) errors.budget = "Enter your total budget as a whole number.";
    if (!Number.isInteger(guests) || guests < 1 || guests > LIMITS.guestsMax) errors.guests = `Enter the number of guests, from 1 to ${LIMITS.guestsMax}.`;
  }
  if (step === 2) {
    const values = Object.values(draft.priorities);
    if (values.filter((value) => value === "protect").length > 3) errors.priorities = "Protect at most three categories, so there is room to trade off.";
    else if (values.filter((value) => value === "flexible").length > 3) errors.priorities = "Choose at most three categories to keep simple.";
    const items = mustHaveList(draft.mustHaves);
    if (items.length > LIMITS.mustHaveCount) errors.mustHaves = `List up to ${LIMITS.mustHaveCount} must-haves.`;
    else if (items.some((item) => item.length > LIMITS.mustHaveMax)) errors.mustHaves = `Keep each must-have under ${LIMITS.mustHaveMax} characters.`;
  }
  if (step === 3) {
    for (const key of ["interests", "culturalNotes", "venueNotes"] as const) {
      if (draft[key].length > LIMITS.noteMax) errors[key] = `Keep this under ${LIMITS.noteMax} characters.`;
    }
  }
  return errors;
}

function toBrief(draft: Draft): EventBrief {
  return {
    type: draft.type,
    title: draft.title.trim(),
    date: draft.date,
    guests: toInt(draft.guests),
    budget: toInt(draft.budget),
    currency: draft.currency,
    city: draft.city.trim(),
    feel: draft.feel,
    mustHaves: mustHaveList(draft.mustHaves),
    personalisation: {
      atmosphere: draft.atmosphere === "" ? null : draft.atmosphere,
      ageGroups: draft.ageGroups,
      accessNeeds: draft.accessNeeds,
      interests: draft.interests.trim(),
      culturalNotes: draft.culturalNotes.trim(),
      venueNotes: draft.venueNotes.trim(),
    },
  };
}

export function Wizard() {
  const router = useRouter();
  const today = useToday();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    announce(`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`);
  }, [step]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const errorList = Object.values(errors);

  function next() {
    const found = validate(step, draft, today);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    const brief = toBrief(draft);
    const checked = EventBriefSchema.safeParse(brief);
    if (!checked.success) {
      setErrors({ form: "Something in your answers does not look right. Please review the earlier steps." });
      return;
    }
    startPlan(createPlan(checked.data as EventBrief, draft.priorities));
    announce("Your plan is ready.");
    router.push("/plan");
  }

  const categories = CATEGORIES[draft.type].filter((def) => def.id !== CONTINGENCY_ID);

  return (
    <div className="stack">
      <div>
        <h1>Let&apos;s plan your event</h1>
        <p className="muted">A few practical questions first. Everything can be changed later.</p>
      </div>
      <ol className="stepper" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li key={label} {...(index === step ? { "aria-current": "step" as const } : {})}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      <form
        noValidate
        className="card"
        onSubmit={(event) => {
          event.preventDefault();
          next();
        }}
      >
        <h2 ref={headingRef} tabIndex={-1}>
          {STEPS[step]}
        </h2>

        {errorList.length > 0 ? (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="banner banner-bad">
            <p>
              <strong>Please fix {errorList.length === 1 ? "this" : "these"} before continuing:</strong>
            </p>
            <ul>
              {errorList.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {step === 0 ? (
          <>
            <ChoiceGroup
              legend="What are you celebrating?"
              name="type"
              mode="radio"
              options={EVENT_TYPES.map((value) => ({ value, label: EVENT_TYPE_LABELS[value].label, hint: EVENT_TYPE_LABELS[value].blurb }))}
              value={[draft.type]}
              onChange={([value]) => setDraft((current) => ({ ...current, type: value ?? current.type, priorities: {} }))}
            />
            <Field label="Event name" error={errors.title}>
              {(control) => (
                <input type="text" {...control} maxLength={LIMITS.titleMax + 20} autoComplete="off" value={draft.title} onChange={(e) => set("title", e.target.value)} />
              )}
            </Field>
            <Field label="Event date" hint="The main day. Everything is scheduled backwards from here." error={errors.date}>
              {(control) => <input type="date" {...control} min={today ?? undefined} value={draft.date} onChange={(e) => set("date", e.target.value)} />}
            </Field>
            <Field label="City or town (optional)" hint="Helps tailor ideas to where you are." error={errors.city}>
              {(control) => <input type="text" {...control} maxLength={LIMITS.cityMax} autoComplete="address-level2" value={draft.city} onChange={(e) => set("city", e.target.value)} />}
            </Field>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field label="Currency">
              {(control) => (
                <select {...control} value={draft.currency} onChange={(e) => set("currency", e.target.value as Currency)}>
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {CURRENCY_LABELS[code]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Total budget" hint="The most you are comfortable spending in total, as a whole number." error={errors.budget}>
              {(control) => <input type="number" inputMode="numeric" min={1} step={1} {...control} value={draft.budget} onChange={(e) => set("budget", e.target.value)} />}
            </Field>
            <Field label="Number of guests" hint="A rough number is fine. You can refine it later." error={errors.guests}>
              {(control) => <input type="number" inputMode="numeric" min={1} step={1} {...control} value={draft.guests} onChange={(e) => set("guests", e.target.value)} />}
            </Field>
            <ChoiceGroup
              legend="What kind of experience do you want?"
              name="feel"
              mode="radio"
              options={FEELS.map((value) => ({ value, label: FEEL_LABELS[value].label, hint: FEEL_LABELS[value].blurb }))}
              value={[draft.feel]}
              onChange={([value]) => set("feel", value ?? draft.feel)}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="muted">
              Mark where you want to invest, and where you are happy to keep things simple. When the budget is tight, Jashn trims the simple
              categories first and protects the rest.
            </p>
            <fieldset aria-describedby={errors.priorities ? "prio-error" : undefined}>
              <legend>Budget priorities</legend>
              {categories.map((def) => (
                <Field key={def.id} label={def.label} hint={def.blurb}>
                  {(control) => (
                    <select
                      {...control}
                      value={draft.priorities[def.id] ?? "normal"}
                      onChange={(e) => set("priorities", { ...draft.priorities, [def.id]: e.target.value as Priority })}
                    >
                      {(["protect", "normal", "flexible"] as const).map((value) => (
                        <option key={value} value={value}>
                          {PRIORITY_LABELS[value].label}: {PRIORITY_LABELS[value].blurb}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              ))}
              {errors.priorities ? (
                <p id="prio-error" className="error">
                  {errors.priorities}
                </p>
              ) : null}
            </fieldset>
            <Field label="Must-haves (optional)" hint="One per line, up to five. For example “live music” or “pure vegetarian menu”." error={errors.mustHaves}>
              {(control) => <textarea {...control} value={draft.mustHaves} onChange={(e) => set("mustHaves", e.target.value)} />}
            </Field>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <p className="muted">Optional, but it makes the ideas and vendor questions far more relevant. You can skip straight to creating the plan.</p>
            <ChoiceGroup
              legend="The atmosphere you want"
              name="atmosphere"
              mode="radio"
              options={ATMOSPHERES.map((value) => ({ value, label: ATMOSPHERE_LABELS[value] }))}
              value={draft.atmosphere ? [draft.atmosphere] : []}
              onChange={([value]) => set("atmosphere", value ?? "")}
            />
            <ChoiceGroup
              legend="Who will be there?"
              name="ages"
              mode="checkbox"
              options={AGE_GROUPS.map((value) => ({ value, label: AGE_GROUP_LABELS[value] }))}
              value={draft.ageGroups}
              onChange={(value) => set("ageGroups", value)}
            />
            <ChoiceGroup
              legend="Accessibility and comfort"
              name="access"
              mode="checkbox"
              options={ACCESS_NEEDS.map((value) => ({ value, label: ACCESS_NEED_LABELS[value] }))}
              value={draft.accessNeeds}
              onChange={(value) => set("accessNeeds", value)}
            />
            <Field label="Interests and themes" error={errors.interests}>
              {(control) => <textarea {...control} value={draft.interests} onChange={(e) => set("interests", e.target.value)} />}
            </Field>
            <Field label="Cultural or family traditions" error={errors.culturalNotes}>
              {(control) => <textarea {...control} value={draft.culturalNotes} onChange={(e) => set("culturalNotes", e.target.value)} />}
            </Field>
            <Field label="Venue limits or preferences" error={errors.venueNotes}>
              {(control) => <textarea {...control} value={draft.venueNotes} onChange={(e) => set("venueNotes", e.target.value)} />}
            </Field>
          </>
        ) : null}

        {errors.form ? <p className="error">{errors.form}</p> : null}

        <div className="row-between">
          {step > 0 ? (
            <button type="button" className="btn btn-quiet" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn">
            {step === STEPS.length - 1 ? "Create my plan" : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
