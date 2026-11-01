import type { EventBrief } from "@/lib/domain/types";

// Control characters (except tab/newline, which are collapsed below) and the angle
// brackets that could be used to close the <user_data> wrapper in a prompt.
const UNSAFE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g;

/** Makes user-supplied text safe to embed in a prompt: no control characters, no tag-like brackets, collapsed whitespace, bounded length. */
export function cleanText(value: string, max: number): string {
  return value.replace(UNSAFE, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** The brief with every free-text field cleaned. Enumerated and numeric fields are already constrained by the schema. */
export function cleanBrief(brief: EventBrief): EventBrief {
  const { personalisation } = brief;
  return {
    ...brief,
    title: cleanText(brief.title, 80),
    city: cleanText(brief.city, 60),
    mustHaves: brief.mustHaves.map((item) => cleanText(item, 60)),
    personalisation: {
      ...personalisation,
      interests: cleanText(personalisation.interests, 200),
      culturalNotes: cleanText(personalisation.culturalNotes, 200),
      venueNotes: cleanText(personalisation.venueNotes, 200),
    },
  };
}
