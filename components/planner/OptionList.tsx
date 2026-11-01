"use client";

import { useId } from "react";
import { formatMoney } from "@/lib/domain/money";
import type { OptionId, TradeoffOption } from "@/lib/domain/scenarios";
import type { Currency } from "@/lib/domain/types";
import { Badge } from "@/components/ui/primitives";

interface OptionListProps {
  legend: string;
  options: readonly TradeoffOption[];
  currency: Currency;
  value: OptionId | null;
  onChange: (id: OptionId) => void;
}

/** The ways to close a budget gap (or place a surplus), as a radio group. The user decides; nothing is applied automatically. */
export function OptionList({ legend, options, currency, value, onChange }: OptionListProps) {
  const name = useId();
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="stack">
        {options.map((option) => (
          <label className="choice" key={option.id}>
            <input type="radio" name={name} checked={value === option.id} onChange={() => onChange(option.id)} />
            <span>
              <strong>{option.label}</strong>{" "}
              {option.unresolved > 0 ? <Badge tone="bad">Still {formatMoney(option.unresolved, currency)} over</Badge> : <Badge tone="ok">Balances</Badge>}
              <span className="hint">{option.summary}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
