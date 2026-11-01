import { vendorTypeDef } from "@/lib/domain/catalog/vendors";
import { heuristicParseQuote } from "@/lib/domain/quotes";
import type { Atmosphere, EventBrief, EventType } from "@/lib/domain/types";
import type { AiRequest, AlternativesOutput, Concept, IdeasOutput, ParsedQuoteOutput, VendorQuestionsOutput } from "@/lib/ai-contract";

/**
 * Deterministic stand-ins for the AI tasks. They keep the whole product usable
 * with no API key (and when the model is unavailable), they are always labelled
 * "built-in suggestions" in the UI, and they obey the same output schemas as
 * the model so the interface never has to special-case them.
 */

interface ConceptTemplate extends Omit<Concept, "adaptations"> {
  atmospheres: Atmosphere[];
}

const IDEAS: Record<EventType, readonly ConceptTemplate[]> = {
  wedding: [
    { title: "Courtyard evening", tagline: "Lantern-lit vows and a long seated dinner.", description: "A late-afternoon ceremony in a garden or courtyard, then a relaxed seated dinner under lights. Fewer functions, more time with each guest.", highlights: ["Ceremony at golden hour", "Lantern and fairy-light styling", "Seated dinner with a short toast round", "Acoustic or instrumental music"], goodFor: "Hosts who want warmth and conversation over spectacle.", costLevel: "medium", atmospheres: ["cozy", "elegant"] },
    { title: "Morning muhurat and family lunch", tagline: "An auspicious start and a feast that lasts all afternoon.", description: "Hold the main ceremony at a morning muhurat, followed by a generous family lunch. A single day keeps costs and logistics down.", highlights: ["Ceremony at the auspicious hour", "Traditional thali-style lunch", "Marigold and mango-leaf decor", "Simple evening blessing for elders"], goodFor: "Traditional families and mixed-age guest lists.", costLevel: "low", atmospheres: ["traditional", "cozy"] },
    { title: "Festive sangeet-and-wedding weekend", tagline: "Music, dance and the whole family together.", description: "Two focused functions: a high-energy sangeet the night before and the ceremony the next day, with rehearsed family performances.", highlights: ["Choreographed family performances", "Live music or a DJ for the sangeet", "Themed colours for each function", "Photo corner and mehendi stations"], goodFor: "Large, lively families who love to dance.", costLevel: "high", atmospheres: ["festive", "playful"] },
    { title: "Heritage venue celebration", tagline: "Old-world architecture as the backdrop.", description: "Choose a heritage property so the venue carries most of the decor. Spend on food and photography instead of elaborate staging.", highlights: ["Venue as the main decor", "Classical music and a traditional welcome", "Curated regional menu", "Portrait session at golden hour"], goodFor: "Hosts who value elegance and tradition.", costLevel: "high", atmospheres: ["elegant", "traditional"] },
  ],
  birthday: [
    { title: "Backyard adventure", tagline: "Treasure hunts, games and a picnic feast.", description: "Turn a garden or terrace into an adventure with a treasure hunt, simple games and a picnic-style spread.", highlights: ["Themed treasure hunt", "Group games with small prizes", "Picnic food and a cake table", "Photo wall made from craft supplies"], goodFor: "Active children and relaxed parents.", costLevel: "low", atmospheres: ["playful", "cozy"] },
    { title: "Themed hall party", tagline: "One big idea, carried through every detail.", description: "Pick a theme the birthday child loves and carry it through decor, cake and activities in a hired hall, with a host to run the games.", highlights: ["Matching backdrop and cake", "Host or entertainer for games", "Return gifts in the theme", "Slideshow of the year"], goodFor: "Larger guest lists with a mix of children and adults.", costLevel: "medium", atmospheres: ["festive", "playful"] },
    { title: "Craft-and-cake afternoon", tagline: "Make something together, then share the cake.", description: "A small, calm party built around a craft activity guests take home, followed by cake and snacks.", highlights: ["Craft stations (painting, clay, cards)", "Take-home creations as favours", "Simple cake and snacks", "Quiet corner for overwhelmed little ones"], goodFor: "Small groups and children who prefer calm activities.", costLevel: "low", atmospheres: ["cozy", "playful"] },
    { title: "Family dinner with a toast", tagline: "A refined, grown-up celebration.", description: "A seated dinner in a restaurant or at home with a short speech round and a memory book guests sign.", highlights: ["Seated tasting-style dinner", "Short toasts from family", "Memory book or video messages", "Signature dessert"], goodFor: "Milestone birthdays and adult guest lists.", costLevel: "medium", atmospheres: ["elegant", "traditional"] },
  ],
  community: [
    { title: "Open-ground mela", tagline: "Stalls, music and something for every age.", description: "An open-ground fair with local stalls, food counters, a small stage and activity corners, running through an afternoon and evening.", highlights: ["Local artisan and food stalls", "Stage for short performances", "Children's activity corner", "Clear walkways and first-aid point"], goodFor: "Festivals and large neighbourhood gatherings.", costLevel: "medium", atmospheres: ["festive", "playful"] },
    { title: "Cultural evening in the hall", tagline: "Performances from within the community.", description: "A seated evening of music, dance and recitals from community members, with simple refreshments at the interval.", highlights: ["Programme built from local talent", "Compact sound and lighting set-up", "Interval refreshments", "Printed programme with thank-yous"], goodFor: "Traditional events with limited budgets.", costLevel: "low", atmospheres: ["traditional", "cozy"] },
    { title: "Potluck and games night", tagline: "Everyone brings a dish and a smile.", description: "A shared meal where households bring a dish, followed by games and storytelling. Low cost, high participation.", highlights: ["Potluck with a simple signup sheet", "Games for all ages", "Shared playlist", "Volunteer-led cleanup"], goodFor: "Small communities and first-time organisers.", costLevel: "low", atmospheres: ["cozy", "playful"] },
    { title: "Fundraiser gala dinner", tagline: "An elegant evening that funds a cause.", description: "A ticketed dinner with a short programme and an appeal, designed to raise funds rather than just break even.", highlights: ["Ticketed seating", "Short programme with a clear ask", "Silent auction or raffle", "Sponsor recognition"], goodFor: "Causes with a clear funding goal.", costLevel: "high", atmospheres: ["elegant", "festive"] },
  ],
};

const ADAPTATIONS = {
  children: "Add a supervised corner for younger guests so adults can relax.",
  seniors: "Reserve shaded seating near the entrance for older relatives.",
  "step-free": "Choose a ground-floor or ramped route for every part of the day.",
  seating: "Plan seats for at least a third of guests, not just elders.",
  "quiet-space": "Set aside a calm room away from the music.",
  dietary: "Label every dish and keep a separate allergy-safe counter.",
} as const;

function feedbackBias(feedback: string | undefined): { cheaper: boolean; kidsAndElders: boolean; traditional: boolean } {
  const text = (feedback ?? "").toLowerCase();
  return {
    cheaper: /expensive|cheaper|cost|budget|afford|less/.test(text),
    kidsAndElders: /kid|child|elder|senior|grand/.test(text),
    traditional: /tradition|ritual|cultur/.test(text),
  };
}

export function fallbackIdeas(input: Extract<AiRequest, { task: "ideas" }>["input"]): IdeasOutput {
  const { brief, feedback } = input;
  const { personalisation: p } = brief;
  if (!p.atmosphere && p.ageGroups.length === 0 && !feedback) {
    return {
      questions: ["What mood do you want guests to feel: cosy, festive, elegant, playful or traditional?", "Who will be there: children, older relatives, mostly friends?"],
      concepts: [],
    };
  }
  const bias = feedbackBias(feedback);
  const wantsLow = bias.cheaper || brief.feel === "simple";
  const wantsHigh = !bias.cheaper && brief.feel === "premium";
  const scored = IDEAS[brief.type].map((template, index) => {
    let score = 0;
    if (p.atmosphere && template.atmospheres.includes(p.atmosphere)) score += 3;
    if (bias.traditional && template.atmospheres.includes("traditional")) score += 3;
    if (wantsLow) score += template.costLevel === "low" ? 2 : template.costLevel === "high" ? -2 : 0;
    if (bias.cheaper) score += template.costLevel === "low" ? 2 : 0;
    if (wantsHigh) score += template.costLevel === "high" ? 2 : 0;
    return { template, score, index };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  const wanted: Array<keyof typeof ADAPTATIONS> = [];
  if (p.ageGroups.includes("children") || bias.kidsAndElders) wanted.push("children");
  if (p.ageGroups.includes("seniors") || bias.kidsAndElders) wanted.push("seniors");
  for (const need of p.accessNeeds) wanted.push(need);

  return {
    questions: [],
    concepts: scored.slice(0, 3).map(({ template }) => {
      const { atmospheres: _atmospheres, ...concept } = template;
      void _atmospheres;
      return { ...concept, adaptations: [...new Set(wanted)].slice(0, 3).map((key) => ADAPTATIONS[key]) };
    }),
  };
}

const ALTERNATIVES: Record<string, ReadonlyArray<readonly [string, string, string]>> = {
  venue: [["Go off-peak", "Choose a weekday or a shoulder-season date.", "Guests may need more notice; venue rates are often negotiable."], ["Use a community hall or family lawn", "Look for simpler spaces and bring your own styling.", "Less built-in polish, more room to personalise."], ["Split the venues", "Hold the main function at the venue and smaller ones at home.", "Fewer hours of venue hire."]],
  catering: [["Tighten the menu", "Fewer, better dishes instead of a long spread.", "Less choice, usually better quality."], ["Limit live counters", "Keep one or two crowd favourites live and serve the rest buffet-style.", "Fewer staff and equipment."], ["Serve a set menu for the main meal", "A fixed menu is easier to price and plan.", "Guests choose less."]],
  decor: [["Focus the decor", "Spend on the entrance and one focal point only.", "A simpler overall look with a strong first impression."], ["Fabric, lights and seasonal flowers", "Use drapes and fairy lights with flowers in season.", "Less elaborate structures."], ["Rent reusable props", "Hire or borrow props instead of buying custom pieces.", "Less custom work."]],
  photo_video: [["Photography only", "Skip the long film and keep a short highlight reel.", "Fewer deliverables."], ["Shorter coverage", "Cover the key moments instead of the whole day.", "Some candid moments are missed."], ["A talented friend", "Ask a friend for candids alongside one professional hour.", "Less consistent quality."]],
  entertainment: [["Curated playlist and DJ for key hours", "Hire a DJ only for the main stretch.", "Less variety through the day."], ["Family performances", "Replace a big act with rehearsed family and friends.", "More personal, less polished."], ["Shorter performance window", "Book one tight set rather than hours.", "Shorter entertainment."]],
  attire_beauty: [["Rent or repeat outfits", "Rent outfits or re-wear for the smaller functions.", "Fewer new pieces."], ["Makeup for the main function only", "Do your own for secondary events.", "Less pampering."], ["Use a studio", "Visit a studio instead of home visits.", "Some travel."]],
  invitations: [["Digital invitations", "Send designed digital invites.", "Less keepsake value."], ["Print for elders only", "Print a few, send the rest digitally.", "Two formats to manage."], ["Message groups", "Share details in family groups.", "Less formal."]],
  logistics: [["Block a few rooms", "Reserve rooms for key guests and share a simple travel guide.", "Some guests arrange their own stay."], ["Shared transport", "Run a few shared vehicles at set times.", "Less flexibility."], ["Ask relatives to host", "Invite relatives to host out-of-town guests.", "More coordination."]],
  cake: [["A smaller cake plus cupcakes", "Serve a small cake for the ceremony and cupcakes for guests.", "Less showpiece."], ["A simple design", "Choose a clean design with a themed topper.", "Less elaborate."], ["Home-baked", "Bake or ask a relative to.", "More time and effort."]],
  sound_av: [["Basic PA", "Rent a simple public-address system.", "Fewer effects."], ["Use venue equipment", "Check what the venue already provides.", "Less control."], ["Borrow from a local group", "Ask a local club or school.", "Subject to availability."]],
  promotion: [["Community channels", "Use message groups and notice boards.", "Smaller reach."], ["Few posters", "Print posters for key locations only.", "Lower visibility."], ["Local shops", "Ask nearby shops to display flyers.", "Depends on goodwill."]],
  safety: [["Keep legally required cover", "Do not trim permits or first aid; reduce optional extras only.", "Some conveniences are dropped."], ["Share volunteer duties", "Train volunteers for crowd flow.", "Needs good briefing."], ["Reduce the crowd", "A smaller crowd needs less cover.", "Fewer attendees."]],
};
const GENERIC_ALTERNATIVES = [
  ["Simplify the scope", "Keep the essentials and drop the extras.", "A simpler experience."],
  ["Compare two more quotes", "Get like-for-like quotes before deciding.", "Takes a little time."],
  ["Phase the spend", "Pay for essentials first and decide extras closer to the date.", "Extras may sell out."],
] as const;

export function fallbackAlternatives(input: Extract<AiRequest, { task: "alternatives" }>["input"]): AlternativesOutput {
  const key = input.categoryId === "food" ? "catering" : input.categoryId === "programme" ? "entertainment" : input.categoryId;
  const list = ALTERNATIVES[key] ?? GENERIC_ALTERNATIVES;
  return { options: list.map(([title, description, whatChanges]) => ({ title, description, whatChanges, relativeCost: "lower" as const })) };
}

export function fallbackVendorQuestions(input: Extract<AiRequest, { task: "vendor_questions" }>["input"]): VendorQuestionsOutput {
  const { brief, vendorTypeId } = input;
  const base = vendorTypeDef(brief.type, vendorTypeId)?.ask ?? ["What is included in the price?", "What are the payment and cancellation terms?", "Can you share references from similar events?"];
  const extra: string[] = [];
  const { accessNeeds, ageGroups, culturalNotes } = brief.personalisation;
  if (accessNeeds.includes("step-free")) extra.push("How will you support step-free access for guests who need it?");
  if (accessNeeds.includes("dietary")) extra.push("How do you handle allergies and special diets safely?");
  if (accessNeeds.includes("quiet-space")) extra.push("Can you help us set aside a quieter area?");
  if (ageGroups.includes("children") && ageGroups.includes("seniors")) extra.push("What would you do to keep both children and older guests comfortable?");
  if (culturalNotes.trim()) extra.push("Have you worked with our specific traditions, and what would you need to know in advance?");
  return {
    questions: [...extra, ...base].slice(0, 8),
    mustConfirm: ["Date, time and address in writing.", "Exactly what is included and what costs extra.", "Payment schedule and cancellation terms."],
  };
}

export function fallbackParseQuote(input: Extract<AiRequest, { task: "parse_quote" }>["input"]): ParsedQuoteOutput {
  const draft = heuristicParseQuote(input.text);
  return {
    ...(draft.vendorName ? { vendorName: draft.vendorName } : {}),
    pricing: draft.pricing,
    ...(draft.amount !== undefined ? { amount: draft.amount } : {}),
    ...(draft.hours !== undefined ? { hours: draft.hours } : {}),
    ...(draft.guestsCovered !== undefined ? { guestsCovered: draft.guestsCovered } : {}),
    inclusions: draft.inclusions,
    exclusions: draft.exclusions,
    extras: draft.extras,
    ambiguities: draft.ambiguities,
  };
}

export type { EventBrief };
