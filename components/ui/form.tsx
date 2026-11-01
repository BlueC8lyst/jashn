"use client";

import { useId, type ReactNode } from "react";

interface ControlProps {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | undefined;
  children: (control: ControlProps) => ReactNode;
}

/** Label + hint + error wired to a control with proper ids, `aria-describedby` and `aria-invalid`. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <p id={hintId} className="hint">
          {hint}
        </p>
      ) : null}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={errorId} className="error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface ChoiceGroupProps<T extends string> {
  legend: string;
  hint?: string;
  error?: string | undefined;
  name: string;
  mode: "radio" | "checkbox";
  options: readonly ChoiceOption<T>[];
  value: readonly T[];
  onChange: (next: T[]) => void;
}

/** A fieldset of radio buttons or checkboxes drawn as large, tappable cards. */
export function ChoiceGroup<T extends string>({ legend, hint, error, name, mode, options, value, onChange }: ChoiceGroupProps<T>) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset aria-describedby={describedBy}>
      <legend>{legend}</legend>
      {hint ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
      <div className="choices">
        {options.map((option) => (
          <label className="choice" key={option.value}>
            <input
              type={mode}
              name={name}
              value={option.value}
              checked={value.includes(option.value)}
              onChange={(event) => {
                if (mode === "radio") onChange([option.value]);
                else onChange(event.target.checked ? [...value, option.value] : value.filter((item) => item !== option.value));
              }}
            />
            <span>
              {option.label}
              {option.hint ? <span className="hint">{option.hint}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p id={`${id}-error`} className="error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
