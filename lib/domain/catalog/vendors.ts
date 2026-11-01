import type { EventType } from "../types";

/**
 * Vendor checklists. `define` is what the host should decide BEFORE contacting
 * anyone (so every vendor quotes against the same brief); `ask` is what to put
 * to each vendor so quotes can be compared like for like.
 */
export interface VendorTypeDef {
  id: string;
  label: string;
  categoryId: string;
  define: readonly string[];
  ask: readonly string[];
}

const priceQuestion = "Is the price per person or a flat fee, and exactly how many guests or hours does it cover?";
const taxQuestion = "Are taxes and service charges included in the quoted price?";
const payQuestion = "What are the payment milestones, and what is the cancellation and refund policy?";

const venue: VendorTypeDef = {
  id: "venue",
  label: "Venue",
  categoryId: "venue",
  define: ["Guest count and the spaces you need", "Which functions happen here and for how long", "A fixed date and one backup date"],
  ask: [
    "Is the date free, and can you hold it for us while we decide? For how long?",
    "What is the seated and standing capacity?",
    "What is included: furniture, air conditioning, power backup, parking, rooms?",
    "Are outside caterers and decorators allowed, and is there any extra charge?",
    "What are the music and end-time restrictions?",
    "Is there step-free access and comfortable seating for older guests?",
    payQuestion,
  ],
};

const caterer: VendorTypeDef = {
  id: "caterer",
  label: "Caterer",
  categoryId: "catering",
  define: ["Menu style and cuisine", "Guest count and number of meals or functions", "Dietary needs to cover (vegetarian, Jain, vegan, allergies)"],
  ask: [
    priceQuestion,
    "What is included: crockery, serving staff, tables, setup and cleanup?",
    taxQuestion,
    "Can we arrange a tasting before booking?",
    "How are allergy-safe and special-diet dishes prepared and served?",
    "What happens to the price if the headcount changes close to the date?",
    payQuestion,
  ],
};

const decorator: VendorTypeDef = {
  id: "decorator",
  label: "Decorator",
  categoryId: "decor",
  define: ["Concept and colour palette", "Which areas to decorate (entrance, stage, tables)", "Fresh versus artificial elements"],
  ask: [
    "Can you share photos of past work at a venue of a similar size?",
    "What does the quote include: fabric, lights, flowers, labour, setup and removal?",
    "Which items are rented, and what is the damage or loss policy?",
    "When can setup start, and when must it be finished?",
    "What is the plan if flowers are unavailable or prices change?",
    payQuestion,
  ],
};

const photographer: VendorTypeDef = {
  id: "photographer",
  label: "Photographer",
  categoryId: "photo_video",
  define: ["Photo only, or photo and video", "Which moments to cover and for how many hours", "A short list of must-have shots and family groups"],
  ask: [
    "How many photographers and videographers will be there?",
    "How many hours of coverage are included, and what do extra hours cost?",
    "What do we receive: edited photos, album, highlight film? In what format?",
    "How soon will we get the files, and who keeps the raw files?",
    "What is the backup plan if the photographer is unwell on the day?",
    payQuestion,
  ],
};

const entertainment: VendorTypeDef = {
  id: "entertainment",
  label: "Music & entertainment",
  categoryId: "entertainment",
  define: ["The kind of music or performance and the age mix of guests", "How long it should run", "Venue sound limits"],
  ask: [
    "How long will you perform, and what do extra hours cost?",
    "What equipment do you bring, and what do you need from the venue?",
    "Can you share a sample set or recent videos?",
    "How do you handle requests and do-not-play lists?",
    "What is the backup plan if you cannot attend?",
    payQuestion,
  ],
};

export const VENDOR_TYPES: Record<EventType, readonly VendorTypeDef[]> = {
  wedding: [
    venue,
    caterer,
    decorator,
    photographer,
    entertainment,
    {
      id: "beauty",
      label: "Makeup & beauty",
      categoryId: "attire_beauty",
      define: ["Looks needed for each function", "Number of people being styled", "Timing and location of getting ready"],
      ask: [
        "Can we do a trial before booking, and is it charged?",
        "How many people are covered, and what does each extra person cost?",
        "What products and brands do you use, and how do you handle sensitive skin?",
        "What are the travel and early-morning charges?",
        payQuestion,
      ],
    },
  ],
  birthday: [
    venue,
    caterer,
    { ...decorator, define: ["Theme and colours", "Areas to decorate", "What the venue allows you to hang or fix"] },
    { ...photographer, define: ["Photo only or photo and video", "Hours of coverage", "Moments to capture (cake, games, group photo)"] },
    {
      id: "entertainer",
      label: "Entertainer or host",
      categoryId: "entertainment",
      define: ["Age group and attention span of guests", "How long the entertainment should run", "Indoor or outdoor space available"],
      ask: [
        "Have you worked with this age group, and what does a typical session look like?",
        "What do you bring, and what do you need from us?",
        "What is the price for the duration, and what do extra minutes cost?",
        "What is the plan if it rains or the space is smaller than expected?",
        payQuestion,
      ],
    },
    {
      id: "cake",
      label: "Cake & desserts",
      categoryId: "cake",
      define: ["Flavour, size and design", "Egg-free or allergy needs", "Delivery or pickup time"],
      ask: [
        "What size serves our guest count, and how many portions is that?",
        "Can the design match our theme, and when is the order cut-off?",
        "Do you offer egg-free, nut-free or sugar-free options?",
        "How is the cake transported, and who is responsible if it is damaged?",
        payQuestion,
      ],
    },
  ],
  community: [
    venue,
    { ...caterer, categoryId: "food", define: ["Meal type and timing", "Attendee, volunteer and speaker numbers", "Dietary and cultural needs"] },
    {
      id: "av",
      label: "Sound, lighting & AV",
      categoryId: "sound_av",
      define: ["Size of the space and number of attendees", "Number of speakers or performers", "Whether recording or live-streaming is needed"],
      ask: [
        "What equipment do you recommend for our space and crowd size?",
        "Is a technician on site throughout the event?",
        "What power and setup time do you need from the venue?",
        "What is the backup plan if equipment fails?",
        payQuestion,
      ],
    },
    {
      id: "programme",
      label: "Speakers & performers",
      categoryId: "programme",
      define: ["Programme theme and running order", "Time slots", "What you can offer (fee, honorarium, travel)"],
      ask: [
        "Are you available on the date, and for what time slot?",
        "What is your fee, and does it include travel?",
        "What technical or stage needs do you have?",
        "Can you share a short bio and sample of your work for promotion?",
        payQuestion,
      ],
    },
    {
      id: "signage",
      label: "Printing & signage",
      categoryId: "decor",
      define: ["Items needed (banners, posters, directions)", "Sizes and quantities", "Artwork ready or design needed"],
      ask: [
        "What is the turnaround time, and the latest date to order?",
        "Is design included, and how many revisions do you allow?",
        "What materials do you use, and are they suitable for outdoors?",
        "How is delivery handled?",
        payQuestion,
      ],
    },
    {
      id: "safety",
      label: "Safety & first aid",
      categoryId: "safety",
      define: ["Expected crowd size and layout", "Risks to cover (crowd flow, heat, fire, medical)", "Permissions the venue or authority requires"],
      ask: [
        "What cover do you recommend for our crowd size and venue?",
        "What qualifications do your staff hold?",
        "What is your response time, and who coordinates on the day?",
        "Does the price include equipment such as first-aid kits and radios?",
        payQuestion,
      ],
    },
  ],
};

const indexes = new Map<EventType, ReadonlyMap<string, VendorTypeDef>>();

export function vendorTypeDef(type: EventType, id: string): VendorTypeDef | undefined {
  let index = indexes.get(type);
  if (!index) {
    index = new Map(VENDOR_TYPES[type].map((def) => [def.id, def]));
    indexes.set(type, index);
  }
  return index.get(id);
}
