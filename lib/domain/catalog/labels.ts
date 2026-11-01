import type {
  AccessNeed,
  AgeGroup,
  Atmosphere,
  Currency,
  EventType,
  Feel,
  Priority,
  VendorStatus,
} from "../types";

/** Display text for every enum value, kept in one place so the UI never hard-codes wording. */

export const EVENT_TYPE_LABELS: Record<EventType, { label: string; blurb: string }> = {
  wedding: { label: "Wedding", blurb: "Ceremony, reception and every function around it." },
  birthday: { label: "Birthday", blurb: "From a first birthday to a milestone party." },
  community: { label: "Community event", blurb: "Festivals, fundraisers and neighbourhood gatherings." },
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  INR: "Indian rupee (₹)",
  USD: "US dollar ($)",
  GBP: "Pound sterling (£)",
  EUR: "Euro (€)",
};

export const FEEL_LABELS: Record<Feel, { label: string; blurb: string }> = {
  simple: { label: "Simple and warm", blurb: "Put the money into people and food, keep the setting modest." },
  balanced: { label: "Balanced", blurb: "A comfortable mix of setting, food and extras." },
  premium: { label: "Grand and polished", blurb: "Invest more in the setting, decor and entertainment." },
};

export const PRIORITY_LABELS: Record<Priority, { label: string; blurb: string }> = {
  protect: { label: "Protect", blurb: "Invest more here and cut it last." },
  normal: { label: "Normal", blurb: "Balanced share of the budget." },
  flexible: { label: "Keep simple", blurb: "Happy to spend less here if needed." },
};

export const ATMOSPHERE_LABELS: Record<Atmosphere, string> = {
  cozy: "Cosy and intimate",
  festive: "Lively and festive",
  elegant: "Elegant and refined",
  playful: "Playful and fun",
  traditional: "Traditional and rooted",
};

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  children: "Children",
  teens: "Teenagers",
  adults: "Adults",
  seniors: "Older relatives",
};

export const ACCESS_NEED_LABELS: Record<AccessNeed, string> = {
  "step-free": "Step-free access",
  seating: "Plenty of seating",
  "quiet-space": "A quiet space",
  dietary: "Special dietary needs",
};

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  not_started: "Not started",
  shortlisting: "Shortlisting",
  quotes_in: "Quotes received",
  booked: "Booked",
};
