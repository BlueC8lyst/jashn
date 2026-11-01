import type { EventType } from "../types";

/**
 * Budget categories per event type.
 *
 * `share` is the default percentage of the budget (each list sums to 100).
 * These are PLANNING ASSUMPTIONS drawn from typical spending patterns, not
 * vendor prices; the UI labels them as estimates everywhere they appear.
 *
 * `guestSensitivity` (0..1) is how strongly a category's cost follows the guest
 * count: 1 means it scales one-for-one (food), 0 means it does not (a
 * photographer). It drives the "what if the guest list grows?" scenarios.
 *
 * `ambience` marks categories that grow or shrink with the chosen "feel".
 */
export interface CategoryDef {
  id: string;
  label: string;
  blurb: string;
  share: number;
  guestSensitivity: number;
  ambience: boolean;
}

export const CONTINGENCY_ID = "contingency";

const contingency: CategoryDef = {
  id: CONTINGENCY_ID,
  label: "Contingency buffer",
  blurb: "Held back for surprises: price changes, extra guests, last-minute needs.",
  share: 5,
  guestSensitivity: 0.5,
  ambience: false,
};

export const CATEGORIES: Record<EventType, readonly CategoryDef[]> = {
  wedding: [
    { id: "venue", label: "Venue & hall", blurb: "Hall or lawn hire, rooms, power backup, parking.", share: 24, guestSensitivity: 0.4, ambience: true },
    { id: "catering", label: "Food & catering", blurb: "Menu, service staff and crockery for every function.", share: 30, guestSensitivity: 1, ambience: false },
    { id: "decor", label: "Decor & flowers", blurb: "Stage, mandap, entrance, lighting and florals.", share: 12, guestSensitivity: 0.3, ambience: true },
    { id: "photo_video", label: "Photo & video", blurb: "Photographers, videographers, albums and films.", share: 10, guestSensitivity: 0.1, ambience: false },
    { id: "attire_beauty", label: "Attire, makeup & mehendi", blurb: "Outfits, jewellery, makeup and hair.", share: 8, guestSensitivity: 0, ambience: false },
    { id: "entertainment", label: "Music & entertainment", blurb: "DJ, band, performers and sound.", share: 6, guestSensitivity: 0.1, ambience: true },
    { id: "invitations", label: "Invitations & stationery", blurb: "Design, printing and delivery.", share: 2, guestSensitivity: 0.8, ambience: false },
    { id: "logistics", label: "Stay, transport & logistics", blurb: "Guest stay, local transport and helpers.", share: 3, guestSensitivity: 0.6, ambience: false },
    contingency,
  ],
  birthday: [
    { id: "venue", label: "Venue", blurb: "Hall, café, party room or home setup costs.", share: 20, guestSensitivity: 0.4, ambience: true },
    { id: "catering", label: "Food & drinks", blurb: "Meals, snacks and drinks for guests.", share: 35, guestSensitivity: 1, ambience: false },
    { id: "decor", label: "Decor & theme", blurb: "Balloons, backdrop, props and lighting.", share: 15, guestSensitivity: 0.3, ambience: true },
    { id: "entertainment", label: "Entertainment & games", blurb: "Host, magician, games, music.", share: 12, guestSensitivity: 0.1, ambience: true },
    { id: "cake", label: "Cake & desserts", blurb: "Birthday cake and dessert table.", share: 5, guestSensitivity: 0.7, ambience: false },
    { id: "photo_video", label: "Photo & video", blurb: "Photographer or booth.", share: 5, guestSensitivity: 0.1, ambience: false },
    { id: "favors", label: "Return gifts & invitations", blurb: "Party favours, invites and thank-you notes.", share: 3, guestSensitivity: 1, ambience: false },
    contingency,
  ],
  community: [
    { id: "venue", label: "Venue & ground", blurb: "Hall or ground hire, seating, power.", share: 20, guestSensitivity: 0.4, ambience: true },
    { id: "food", label: "Food & refreshments", blurb: "Meals, snacks and water for attendees and volunteers.", share: 26, guestSensitivity: 1, ambience: false },
    { id: "sound_av", label: "Sound, lighting & AV", blurb: "PA system, mics, projector, lighting.", share: 12, guestSensitivity: 0.2, ambience: false },
    { id: "decor", label: "Signage & decor", blurb: "Banners, stage backdrop, wayfinding.", share: 8, guestSensitivity: 0.2, ambience: true },
    { id: "programme", label: "Programme & performers", blurb: "Speakers, performers, prizes and activities.", share: 10, guestSensitivity: 0.1, ambience: true },
    { id: "logistics", label: "Volunteers, supplies & logistics", blurb: "Volunteer kits, supplies, transport, cleaning.", share: 9, guestSensitivity: 0.7, ambience: false },
    { id: "promotion", label: "Promotion & printing", blurb: "Posters, social media, registration forms.", share: 6, guestSensitivity: 0.3, ambience: false },
    { id: "safety", label: "Permits, safety & first aid", blurb: "Permissions, security, first-aid cover, insurance.", share: 4, guestSensitivity: 0.5, ambience: false },
    contingency,
  ],
};

const indexes = new Map<EventType, ReadonlyMap<string, CategoryDef>>();

/** Constant-time lookup of one category definition (indexes are built once per type). */
export function categoryDef(type: EventType, id: string): CategoryDef | undefined {
  let index = indexes.get(type);
  if (!index) {
    index = new Map(CATEGORIES[type].map((def) => [def.id, def]));
    indexes.set(type, index);
  }
  return index.get(id);
}
