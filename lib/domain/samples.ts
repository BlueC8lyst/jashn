import { addDays } from "./dates";
import type { EventBrief, EventType, IsoDate, Priority } from "./types";

export interface Sample {
  brief: EventBrief;
  priorities: Record<string, Priority>;
}

/** Ready-made briefs so the app can be explored without typing anything. Dates are relative to `today`. */
export function sampleFor(type: EventType, today: IsoDate): Sample {
  switch (type) {
    case "wedding":
      return {
        brief: {
          type,
          title: "Riya & Arjun's wedding",
          date: addDays(today, 122),
          guests: 200,
          budget: 800_000,
          currency: "INR",
          city: "Pune",
          feel: "balanced",
          mustHaves: ["Live music on the sangeet night", "Pure vegetarian menu"],
          personalisation: {
            atmosphere: "festive",
            ageGroups: ["children", "adults", "seniors"],
            accessNeeds: ["seating", "step-free"],
            interests: "Classic Bollywood music and family dance performances",
            culturalNotes: "Maharashtrian ceremony with a morning muhurat",
            venueNotes: "Prefer an open lawn with shaded seating",
          },
        },
        priorities: { catering: "protect", photo_video: "protect", decor: "flexible" },
      };
    case "birthday":
      return {
        brief: {
          type,
          title: "Aarav's 7th birthday",
          date: addDays(today, 45),
          guests: 40,
          budget: 60_000,
          currency: "INR",
          city: "Bengaluru",
          feel: "simple",
          mustHaves: ["A magic show"],
          personalisation: {
            atmosphere: "playful",
            ageGroups: ["children", "adults"],
            accessNeeds: ["dietary"],
            interests: "Space, rockets and building things",
            culturalNotes: "",
            venueNotes: "Small community hall; no loud music after 8 pm",
          },
        },
        priorities: { entertainment: "protect", decor: "flexible" },
      };
    case "community":
      return {
        brief: {
          type,
          title: "Neighbourhood Diwali mela",
          date: addDays(today, 75),
          guests: 300,
          budget: 150_000,
          currency: "INR",
          city: "Hyderabad",
          feel: "balanced",
          mustHaves: ["Stalls from local artisans", "Free entry for everyone"],
          personalisation: {
            atmosphere: "festive",
            ageGroups: ["children", "teens", "adults", "seniors"],
            accessNeeds: ["step-free", "seating"],
            interests: "Folk performances, food stalls and a children's rangoli corner",
            culturalNotes: "",
            venueNotes: "Open ground behind the community centre",
          },
        },
        priorities: { food: "protect", safety: "protect", decor: "flexible" },
      };
  }
}
