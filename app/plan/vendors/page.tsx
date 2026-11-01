"use client";

import { useId, useState } from "react";
import { vendorTypeDef } from "@/lib/domain/catalog/vendors";
import { formatMoney } from "@/lib/domain/money";
import { compareQuotes, heuristicParseQuote, parseExtras, splitLines } from "@/lib/domain/quotes";
import { LIMITS, VENDOR_STATUSES, type PricingKind, type Quote, type VendorStatus, type VendorTrack } from "@/lib/domain/types";
import { announce } from "@/lib/client/announce";
import { usePlanView } from "@/lib/client/hooks";
import { dispatch } from "@/lib/client/store";
import { useAiCall } from "@/lib/client/useAiCall";
import { VendorQuestionsPanel } from "@/components/planner/VendorQuestionsPanel";
import { Field } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";

const STATUS_LABELS: Record<VendorStatus, [tone: "plain" | "info" | "warn" | "ok", label: string]> = {
  not_started: ["plain", "Not started"],
  shortlisting: ["info", "Shortlisting"],
  quotes_in: ["warn", "Quotes in"],
  booked: ["ok", "Booked"],
};

const PRICING_LABELS: Record<PricingKind, string> = {
  per_guest: "Per guest",
  flat: "Flat fee",
  per_hour: "Per hour",
};

interface QuoteFormDraft {
  vendorName: string;
  pricing: PricingKind;
  amount: string;
  hours: string;
  guestsCovered: string;
  inclusions: string;
  exclusions: string;
  extras: string;
}

const emptyDraft = (): QuoteFormDraft => ({
  vendorName: "",
  pricing: "flat",
  amount: "",
  hours: "",
  guestsCovered: "",
  inclusions: "",
  exclusions: "",
  extras: "",
});

function QuoteCard({
  quote,
  track,
  guests,
  currency,
  planned,
}: {
  quote: ReturnType<typeof compareQuotes>[number];
  track: VendorTrack;
  guests: number;
  currency: "INR" | "USD" | "GBP" | "EUR";
  planned: number;
}) {
  const isBooked = track.bookedQuoteId === quote.quoteId;
  const originalQuote = track.quotes.find((q) => q.id === quote.quoteId);
  const money = (val: number) => formatMoney(val, currency);

  const toggleBook = () => {
    dispatch({
      type: "vendor/book",
      typeId: track.typeId,
      quoteId: isBooked ? null : quote.quoteId,
    });
    announce(isBooked ? `Unmarked ${quote.vendorName}.` : `Booked ${quote.vendorName}.`);
  };

  const remove = () => {
    if (window.confirm(`Remove quote from ${quote.vendorName}?`)) {
      dispatch({ type: "vendor/removeQuote", typeId: track.typeId, quoteId: quote.quoteId });
      announce(`Removed quote from ${quote.vendorName}.`);
    }
  };

  return (
    <article className={isBooked ? "card banner-ok stack" : "card stack"}>
      <div className="row-between">
        <div>
          <span className="small muted">Rank #{quote.rank ?? "—"}</span>
          <h4 style={{ margin: "0.2rem 0" }}>{quote.vendorName}</h4>
          {originalQuote ? (
            <span className="small muted">
              {PRICING_LABELS[originalQuote.pricing]} ({money(originalQuote.amount)}
              {originalQuote.pricing === "per_guest"
                ? `/guest for ${guests} guests`
                : originalQuote.pricing === "per_hour"
                  ? "/hour"
                  : " flat"}
              )
            </span>
          ) : null}
        </div>
        <div className="row">
          {isBooked ? <Badge tone="ok">Booked</Badge> : null}
          {quote.versusPlanned !== null ? (
            <Badge tone={quote.versusPlanned <= 0 ? "ok" : "warn"}>
              {quote.versusPlanned <= 0
                ? `${money(Math.abs(quote.versusPlanned))} under planned`
                : `${money(quote.versusPlanned)} over planned`}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="row-between">
        <span className="stat">{quote.total !== null ? money(quote.total) : "Needs details"}</span>
        <span className="small muted">
          {planned > 0 ? `Planned budget: ${money(planned)}` : ""}
        </span>
      </div>

      {quote.warnings.length > 0 ? (
        <div className="banner banner-warn small">
          <strong>Review before booking:</strong>
          <ul style={{ margin: "0.3rem 0 0", paddingLeft: "1.2rem" }}>
            {quote.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {quote.missing.length > 0 ? (
        <div className="banner banner-info small">
          <strong>To get a firm comparison, ask:</strong>
          <ul style={{ margin: "0.3rem 0 0", paddingLeft: "1.2rem" }}>
            {quote.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="row-between small">
        <button type="button" className={`btn btn-small ${isBooked ? "btn-quiet" : ""}`} onClick={toggleBook}>
          {isBooked ? "Cancel booking" : "Mark as booked"}
        </button>
        <button type="button" className="btn btn-small btn-quiet" onClick={remove}>
          Delete quote
        </button>
      </div>
    </article>
  );
}

function VendorTrackSection({
  track,
  brief,
  allocationPlanned,
}: {
  track: VendorTrack;
  brief: ReturnType<typeof usePlanView> extends infer P ? (P extends { state: infer S } ? S extends { brief: infer B } ? B : never : never) : never;
  allocationPlanned: number;
}) {
  const def = vendorTypeDef(brief.type, track.typeId);
  const [openAdd, setOpenAdd] = useState(false);
  const [draft, setDraft] = useState<QuoteFormDraft>(emptyDraft());
  const [pasteText, setPasteText] = useState("");
  const [notes, setNotes] = useState(track.notes);
  const [ambiguities, setAmbiguities] = useState<string[]>([]);
  const parser = useAiCall<"parse_quote">();
  const selectId = useId();

  if (!def) return null;

  const [statusTone, statusLabel] = STATUS_LABELS[track.status];
  const quotesCompared = compareQuotes(track.quotes, brief.guests, allocationPlanned);

  const handleStatusChange = (newStatus: VendorStatus) => {
    dispatch({ type: "vendor/status", typeId: track.typeId, status: newStatus });
    announce(`${def.label} status changed to ${STATUS_LABELS[newStatus][1]}.`);
  };

  const handleNotesBlur = () => {
    if (notes !== track.notes) {
      dispatch({ type: "vendor/notes", typeId: track.typeId, notes });
    }
  };

  const handleParse = async () => {
    if (!pasteText.trim()) return;
    try {
      const parsed = await parser.run({
        task: "parse_quote",
        input: { text: pasteText, currency: brief.currency, guests: brief.guests },
      });
      const data = parsed ?? heuristicParseQuote(pasteText);
      setDraft({
        vendorName: data.vendorName ?? "",
        pricing: data.pricing ?? "flat",
        amount: data.amount ? String(data.amount) : "",
        hours: data.hours ? String(data.hours) : "",
        guestsCovered: data.guestsCovered ? String(data.guestsCovered) : "",
        inclusions: data.inclusions ? data.inclusions.join("\n") : "",
        exclusions: data.exclusions ? data.exclusions.join("\n") : "",
        extras: data.extras
          ? data.extras
              .map((e) => (e.amount !== undefined ? `${e.label}: ${e.amount}` : e.label))
              .join("\n")
          : "",
      });
      setAmbiguities(data.ambiguities ?? []);
      announce("Quote details extracted from pasted message. Please review and save.");
    } catch {
      const fallback = heuristicParseQuote(pasteText);
      setDraft({
        vendorName: fallback.vendorName ?? "",
        pricing: fallback.pricing ?? "flat",
        amount: fallback.amount ? String(fallback.amount) : "",
        hours: fallback.hours ? String(fallback.hours) : "",
        guestsCovered: fallback.guestsCovered ? String(fallback.guestsCovered) : "",
        inclusions: fallback.inclusions.join("\n"),
        exclusions: fallback.exclusions.join("\n"),
        extras: fallback.extras
          .map((e) => (e.amount !== undefined ? `${e.label}: ${e.amount}` : e.label))
          .join("\n"),
      });
      setAmbiguities(fallback.ambiguities);
    }
  };

  const handleSaveQuote = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(draft.amount.replace(/,/g, "").trim());
    if (!draft.vendorName.trim() || Number.isNaN(amountNum) || amountNum <= 0) return;

    const newQuote: Quote = {
      id: crypto.randomUUID().slice(0, 8),
      vendorName: draft.vendorName.trim().slice(0, LIMITS.titleMax),
      pricing: draft.pricing,
      amount: Math.round(amountNum),
      hours: draft.pricing === "per_hour" && draft.hours ? Number(draft.hours) : undefined,
      guestsCovered: draft.guestsCovered ? Number(draft.guestsCovered) : undefined,
      inclusions: splitLines(draft.inclusions),
      exclusions: splitLines(draft.exclusions),
      extras: parseExtras(draft.extras),
    };

    dispatch({ type: "vendor/saveQuote", typeId: track.typeId, quote: newQuote });
    announce(`Saved quote from ${newQuote.vendorName}.`);
    setDraft(emptyDraft());
    setPasteText("");
    setAmbiguities([]);
    setOpenAdd(false);
  };

  return (
    <section className="card stack" aria-labelledby={`vendor-${track.typeId}`}>
      <div className="row-between">
        <div>
          <h2 id={`vendor-${track.typeId}`}>{def.label}</h2>
          <p className="muted small">
            Planned allocation: {formatMoney(allocationPlanned, brief.currency)}
            {allocationPlanned > 0 && brief.guests > 0
              ? ` (~${formatMoney(Math.round(allocationPlanned / brief.guests), brief.currency)}/guest)`
              : ""}
          </p>
        </div>
        <div className="row">
          <Badge tone={statusTone}>{statusLabel}</Badge>
          <label htmlFor={selectId} className="sr-only">
            Update status for {def.label}
          </label>
          <select
            id={selectId}
            value={track.status}
            onChange={(e) => handleStatusChange(e.target.value as VendorStatus)}
            style={{ width: "auto", minHeight: "2.25rem", padding: "0.2rem 0.5rem" }}
          >
            {VENDOR_STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_LABELS[st][1]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card stack">
          <h4>Before you contact anyone</h4>
          <p className="small muted">Decide these internally so each vendor quotes against the same requirements:</p>
          <ul>
            {def.define.map((item) => (
              <li key={item} className="small">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <VendorQuestionsPanel
          brief={brief}
          vendorTypeId={track.typeId}
          vendorLabel={def.label}
          baseQuestions={def.ask}
        />
      </div>

      <div className="stack">
        <div className="row-between">
          <h3>Received Quotes ({track.quotes.length})</h3>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => setOpenAdd(!openAdd)}
          >
            {openAdd ? "Close quote form" : "+ Add quote"}
          </button>
        </div>

        {openAdd ? (
          <div className="card stack banner-info" style={{ border: "2px solid var(--brand)" }}>
            <h4>Add a quote from a vendor</h4>
            <p className="small muted">
              Paste a WhatsApp message, email or note. Our assistant will extract the pricing structure, inclusions and extras for you to verify.
            </p>

            <Field label="Paste vendor message (optional)">
              {(c) => (
                <textarea
                  {...c}
                  rows={3}
                  placeholder="e.g. ₹950 per plate for 200 guests. Includes crockery and staff. GST 18% extra. Tent hire 15,000."
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
              )}
            </Field>

            <div className="row">
              <button
                type="button"
                className="btn btn-small btn-quiet"
                disabled={!pasteText.trim() || parser.state.status === "loading"}
                onClick={handleParse}
              >
                {parser.state.status === "loading" ? "Parsing message…" : "Extract details with AI"}
              </button>
              {parser.state.source ? (
                <Badge tone={parser.state.source === "ai" ? "info" : "plain"}>
                  {parser.state.source === "ai" ? "Extracted by AI" : "Extracted by parser"}
                </Badge>
              ) : null}
            </div>

            {ambiguities.length > 0 ? (
              <div className="banner banner-warn small">
                <strong>Please check:</strong>
                <ul style={{ margin: "0.2rem 0 0", paddingLeft: "1.2rem" }}>
                  {ambiguities.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <form onSubmit={handleSaveQuote} className="stack">
              <div className="grid grid-2">
                <Field label="Vendor name">
                  {(c) => (
                    <input
                      type="text"
                      required
                      {...c}
                      value={draft.vendorName}
                      onChange={(e) => setDraft({ ...draft, vendorName: e.target.value })}
                    />
                  )}
                </Field>

                <Field label="Pricing model">
                  {(c) => (
                    <select
                      {...c}
                      value={draft.pricing}
                      onChange={(e) => setDraft({ ...draft, pricing: e.target.value as PricingKind })}
                    >
                      <option value="flat">Flat fee</option>
                      <option value="per_guest">Per guest</option>
                      <option value="per_hour">Per hour</option>
                    </select>
                  )}
                </Field>
              </div>

              <div className="grid grid-3">
                <Field label={`Amount (${brief.currency})`}>
                  {(c) => (
                    <input
                      type="number"
                      required
                      min={1}
                      {...c}
                      value={draft.amount}
                      onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                    />
                  )}
                </Field>

                {draft.pricing === "per_hour" ? (
                  <Field label="Hours covered">
                    {(c) => (
                      <input
                        type="number"
                        min={1}
                        max={24}
                        {...c}
                        value={draft.hours}
                        onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
                      />
                    )}
                  </Field>
                ) : (
                  <Field label="Guests covered by this rate">
                    {(c) => (
                      <input
                        type="number"
                        min={1}
                        placeholder={String(brief.guests)}
                        {...c}
                        value={draft.guestsCovered}
                        onChange={(e) => setDraft({ ...draft, guestsCovered: e.target.value })}
                      />
                    )}
                  </Field>
                )}
              </div>

              <div className="grid grid-3">
                <Field label="Inclusions (one per line)">
                  {(c) => (
                    <textarea
                      rows={2}
                      {...c}
                      placeholder="e.g. Crockery&#10;Servers&#10;Cleanup"
                      value={draft.inclusions}
                      onChange={(e) => setDraft({ ...draft, inclusions: e.target.value })}
                    />
                  )}
                </Field>

                <Field label="Exclusions (one per line)">
                  {(c) => (
                    <textarea
                      rows={2}
                      {...c}
                      placeholder="e.g. Drinks&#10;Generator"
                      value={draft.exclusions}
                      onChange={(e) => setDraft({ ...draft, exclusions: e.target.value })}
                    />
                  )}
                </Field>

                <Field label="Extra charges (e.g. Tent: 15000)">
                  {(c) => (
                    <textarea
                      rows={2}
                      {...c}
                      placeholder="e.g. GST extra&#10;Overtime: 2000"
                      value={draft.extras}
                      onChange={(e) => setDraft({ ...draft, extras: e.target.value })}
                    />
                  )}
                </Field>
              </div>

              <div className="row">
                <button type="submit" className="btn btn-small">
                  Save quote
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-quiet"
                  onClick={() => {
                    setDraft(emptyDraft());
                    setOpenAdd(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {quotesCompared.length > 0 ? (
          <div className="grid grid-2">
            {quotesCompared.map((q) => (
              <QuoteCard
                key={q.quoteId}
                quote={q}
                track={track}
                guests={brief.guests}
                currency={brief.currency}
                planned={allocationPlanned}
              />
            ))}
          </div>
        ) : (
          <p className="muted small">No quotes recorded yet. Click “+ Add quote” to compare proposals.</p>
        )}
      </div>

      <div>
        <label htmlFor={`notes-${track.typeId}`} className="label small">
          Private notes for {def.label}:
        </label>
        <textarea
          id={`notes-${track.typeId}`}
          rows={2}
          placeholder="Contact details, meeting notes, special discounts or venue constraints..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
        />
      </div>
    </section>
  );
}

export default function VendorsPage() {
  const view = usePlanView();
  const [filter, setFilter] = useState<VendorStatus | "all">("all");

  if (!view) return null;
  const { state } = view;
  const { brief, vendors, allocations } = state;

  const totalQuotes = vendors.reduce((acc, v) => acc + v.quotes.length, 0);
  const bookedCount = vendors.filter((v) => v.status === "booked").length;

  const filteredVendors = filter === "all" ? vendors : vendors.filter((v) => v.status === filter);

  return (
    <div className="stack">
      <div>
        <h1>Vendor Checklists & Quotes</h1>
        <p className="muted">
          All vendor quotes are recorded unverified. Jashn normalises pricing models (per-guest, flat or hourly) to your guest count, highlights gaps, and ensures you confirm the essential terms in writing before committing.
        </p>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="small muted">Vendor Categories</span>
          <div className="stat">{vendors.length}</div>
        </div>
        <div className="card">
          <span className="small muted">Quotes Compared</span>
          <div className="stat">{totalQuotes}</div>
        </div>
        <div className="card">
          <span className="small muted">Booked Vendors</span>
          <div className="stat">{bookedCount} of {vendors.length}</div>
        </div>
      </div>

      <div className="row" role="group" aria-label="Filter vendors by status">
        <button
          type="button"
          className={`btn btn-small ${filter === "all" ? "" : "btn-quiet"}`}
          onClick={() => setFilter("all")}
        >
          All ({vendors.length})
        </button>
        {VENDOR_STATUSES.map((st) => {
          const count = vendors.filter((v) => v.status === st).length;
          return (
            <button
              key={st}
              type="button"
              className={`btn btn-small ${filter === st ? "" : "btn-quiet"}`}
              onClick={() => setFilter(st)}
            >
              {STATUS_LABELS[st][1]} ({count})
            </button>
          );
        })}
      </div>

      <div className="stack">
        {filteredVendors.map((track) => {
          const def = vendorTypeDef(brief.type, track.typeId);
          const planned = allocations.find((a) => a.id === def?.categoryId)?.planned ?? 0;
          return (
            <VendorTrackSection
              key={track.typeId}
              track={track}
              brief={brief}
              allocationPlanned={planned}
            />
          );
        })}
      </div>
    </div>
  );
}
