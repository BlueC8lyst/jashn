import type { EventType, TaskDef } from "../types";

/**
 * Planning task templates. `leadDays` is the recommended deadline measured back
 * from the event date; the scheduler compresses the whole template when there is
 * less time available than the template assumes.
 *
 * Each list is a dependency graph (`dependsOn`): for example nobody should be
 * paying a caterer before the venue and date are locked.
 */

const wedding: readonly TaskDef[] = [
  { id: "budget-guests", title: "Agree the budget and a first guest list", detail: "Decide who is contributing, the total you are comfortable with, and a rough headcount. Every other decision depends on these two numbers.", leadDays: 270, effortDays: 14, importance: 3, dependsOn: [] },
  { id: "venue-shortlist", title: "Shortlist and visit venues", detail: "Visit two or three venues at the time of day the event will happen. Check capacity, parking, power backup and access for elders.", leadDays: 240, effortDays: 21, importance: 3, dependsOn: ["budget-guests"], categoryId: "venue", vendorTypeId: "venue" },
  { id: "book-venue", title: "Book the venue and lock the date", detail: "Confirm the date in writing and understand the payment and cancellation terms before paying a deposit.", leadDays: 210, effortDays: 7, importance: 3, dependsOn: ["venue-shortlist"], categoryId: "venue", vendorTypeId: "venue" },
  { id: "caterer-shortlist", title: "Shortlist caterers and arrange tastings", detail: "Ask each caterer for a per-plate quote for your exact guest count and compare what is included.", leadDays: 180, effortDays: 21, importance: 3, dependsOn: ["book-venue"], categoryId: "catering", vendorTypeId: "caterer" },
  { id: "book-caterer", title: "Book the caterer and fix the menu direction", detail: "Lock the caterer and the broad menu. The final menu and headcount are confirmed closer to the date.", leadDays: 150, effortDays: 7, importance: 3, dependsOn: ["caterer-shortlist"], categoryId: "catering", vendorTypeId: "caterer" },
  { id: "book-photographer", title: "Book photographer and videographer", detail: "Good photographers book out early. Compare coverage hours, deliverables and how soon you get the files.", leadDays: 165, effortDays: 14, importance: 2, dependsOn: ["book-venue"], categoryId: "photo_video", vendorTypeId: "photographer" },
  { id: "decor-concept", title: "Choose a decor concept and moodboard", detail: "Pick a palette and two or three focal points (entrance, stage, tables) so decorators can quote on the same brief.", leadDays: 140, effortDays: 14, importance: 2, dependsOn: ["book-venue"], categoryId: "decor", vendorTypeId: "decorator" },
  { id: "book-decorator", title: "Book the decorator against the concept", detail: "Share the moodboard and venue photos, then compare quotes like for like.", leadDays: 110, effortDays: 10, importance: 2, dependsOn: ["decor-concept"], categoryId: "decor", vendorTypeId: "decorator" },
  { id: "book-entertainment", title: "Book music, DJ or performers", detail: "Check venue sound limits and cut-off times before you book.", leadDays: 120, effortDays: 10, importance: 2, dependsOn: ["book-venue"], categoryId: "entertainment", vendorTypeId: "entertainment" },
  { id: "attire", title: "Shop for outfits and book fittings", detail: "Allow time for alterations: fittings usually need two rounds.", leadDays: 120, effortDays: 45, importance: 2, dependsOn: [], categoryId: "attire_beauty" },
  { id: "beauty-bookings", title: "Book makeup, hair and mehendi artists", detail: "Do a trial and confirm travel and timing on the day.", leadDays: 90, effortDays: 7, importance: 1, dependsOn: [], categoryId: "attire_beauty", vendorTypeId: "beauty" },
  { id: "guest-list-final", title: "Finalise the guest list and collect addresses", detail: "Agree the list with both families and capture contact details for invitations and RSVPs.", leadDays: 90, effortDays: 14, importance: 3, dependsOn: ["budget-guests"] },
  { id: "logistics-guests", title: "Arrange stay and transport for out-of-town guests", detail: "Block rooms early and share a simple travel guide.", leadDays: 75, effortDays: 14, importance: 2, dependsOn: ["guest-list-final"], categoryId: "logistics" },
  { id: "invitations", title: "Design, print and send invitations", detail: "Send at least eight weeks ahead for a large wedding, and ask for RSVPs by a clear date.", leadDays: 60, effortDays: 21, importance: 3, dependsOn: ["guest-list-final", "book-venue"], categoryId: "invitations" },
  { id: "paperwork", title: "Sort permits, registration paperwork and contracts", detail: "Check what the venue, local authority and any registration need, and read every vendor contract before signing.", leadDays: 60, effortDays: 14, importance: 2, dependsOn: ["book-venue"] },
  { id: "menu-final", title: "Finalise the menu and dietary needs", detail: "Confirm Jain, vegan, allergy and children's options with the caterer.", leadDays: 40, effortDays: 7, importance: 3, dependsOn: ["book-caterer", "guest-list-final"], categoryId: "catering", vendorTypeId: "caterer" },
  { id: "run-of-show", title: "Draft the day's run-of-show with family", detail: "A minute-by-minute plan with named owners removes most day-of stress.", leadDays: 35, effortDays: 10, importance: 2, dependsOn: ["book-entertainment", "book-venue"] },
  { id: "rsvp-track", title: "Track RSVPs and confirm the headcount", detail: "Chase non-replies personally; headcount drives food, seating and cost.", leadDays: 21, effortDays: 21, importance: 3, dependsOn: ["invitations"] },
  { id: "final-payments", title: "Confirm every vendor and schedule final payments", detail: "Reconfirm date, time, address and what is included. Note who pays what and when.", leadDays: 14, effortDays: 7, importance: 3, dependsOn: ["book-caterer", "book-decorator", "book-photographer", "book-entertainment"] },
  { id: "final-headcount", title: "Share the final headcount with caterer and venue", detail: "Send one written number and confirm it back.", leadDays: 10, effortDays: 3, importance: 3, dependsOn: ["rsvp-track", "menu-final"], categoryId: "catering" },
  { id: "share-plan", title: "Share the run-of-show and contacts with vendors and helpers", detail: "Everyone should know arrival times, who to call and where to set up.", leadDays: 5, effortDays: 3, importance: 2, dependsOn: ["run-of-show", "final-payments"] },
  { id: "emergency-kit", title: "Pack an emergency kit and assign day-of helpers", detail: "Safety pins, medicines, chargers, cash, snacks and a named person for each problem area.", leadDays: 3, effortDays: 2, importance: 1, dependsOn: ["share-plan"] },
  { id: "walkthrough", title: "Do a final venue walkthrough", detail: "Walk the guest journey from arrival to seating and check power, restrooms and access.", leadDays: 2, effortDays: 1, importance: 2, dependsOn: ["final-payments"], categoryId: "venue", vendorTypeId: "venue" },
];

const birthday: readonly TaskDef[] = [
  { id: "b-brief", title: "Set the budget and a rough guest list", detail: "Decide the budget, the guest count and whether it is a party for kids, adults or both.", leadDays: 90, effortDays: 7, importance: 3, dependsOn: [] },
  { id: "b-theme", title: "Pick a theme with the birthday person", detail: "Choose one idea they love; a clear theme keeps decor, cake and games consistent.", leadDays: 80, effortDays: 7, importance: 2, dependsOn: ["b-brief"] },
  { id: "b-venue", title: "Book the venue or confirm the home setup", detail: "Check capacity, timing, outside-food rules and seating for older relatives.", leadDays: 70, effortDays: 10, importance: 3, dependsOn: ["b-brief"], categoryId: "venue", vendorTypeId: "venue" },
  { id: "b-food", title: "Choose the food: caterer, café or home menu", detail: "Match the menu to the age groups and any dietary needs.", leadDays: 55, effortDays: 10, importance: 3, dependsOn: ["b-venue"], categoryId: "catering", vendorTypeId: "caterer" },
  { id: "b-entertainment", title: "Book the entertainer, games or music", detail: "Confirm duration, what they bring and whether they suit the age group.", leadDays: 45, effortDays: 10, importance: 2, dependsOn: ["b-theme", "b-venue"], categoryId: "entertainment", vendorTypeId: "entertainer" },
  { id: "b-decor", title: "Plan decor and order supplies", detail: "Order early for custom items; check what the venue allows you to hang or fix.", leadDays: 35, effortDays: 14, importance: 2, dependsOn: ["b-theme", "b-venue"], categoryId: "decor", vendorTypeId: "decorator" },
  { id: "b-invites", title: "Send invitations", detail: "Include date, time, address, theme, and a reply-by date.", leadDays: 28, effortDays: 7, importance: 3, dependsOn: ["b-brief", "b-venue"], categoryId: "favors" },
  { id: "b-photo", title: "Arrange a photographer or a friend with a good camera", detail: "Decide the moments you want captured: cake cutting, games, group photos.", leadDays: 21, effortDays: 7, importance: 1, dependsOn: ["b-venue"], categoryId: "photo_video", vendorTypeId: "photographer" },
  { id: "b-favours", title: "Choose return gifts and party favours", detail: "Keep them age-appropriate and avoid common allergens.", leadDays: 21, effortDays: 10, importance: 1, dependsOn: ["b-theme"], categoryId: "favors" },
  { id: "b-cake", title: "Order the cake and desserts", detail: "Confirm flavour, size for your headcount, egg-free options and delivery time.", leadDays: 14, effortDays: 5, importance: 2, dependsOn: ["b-theme"], categoryId: "cake", vendorTypeId: "cake" },
  { id: "b-rsvp", title: "Chase RSVPs and note dietary needs", detail: "A short message a week before usually gets the missing replies.", leadDays: 10, effortDays: 10, importance: 3, dependsOn: ["b-invites"] },
  { id: "b-headcount", title: "Confirm the final headcount with food and venue", detail: "Send one number in writing.", leadDays: 5, effortDays: 2, importance: 3, dependsOn: ["b-rsvp", "b-food"], categoryId: "catering" },
  { id: "b-confirm", title: "Confirm every booking and pay balances", detail: "Reconfirm arrival times and what each vendor is bringing.", leadDays: 4, effortDays: 3, importance: 3, dependsOn: ["b-entertainment", "b-decor", "b-cake"] },
  { id: "b-runsheet", title: "Write a simple run-of-show and assign helpers", detail: "Arrival, games, food, cake and farewell, with a named helper for each.", leadDays: 3, effortDays: 2, importance: 2, dependsOn: ["b-headcount"] },
  { id: "b-setup", title: "Set up decor and do a final check", detail: "Allow setup time before guests arrive.", leadDays: 1, effortDays: 1, importance: 2, dependsOn: ["b-confirm"] },
];

const community: readonly TaskDef[] = [
  { id: "c-purpose", title: "Agree the purpose, audience and what success looks like", detail: "Write one sentence on who this is for and one measurable outcome (attendance, funds raised, sign-ups).", leadDays: 120, effortDays: 7, importance: 3, dependsOn: [] },
  { id: "c-committee", title: "Form a committee and assign owners", detail: "Name one owner each for venue, food, programme, volunteers and money.", leadDays: 110, effortDays: 7, importance: 3, dependsOn: ["c-purpose"] },
  { id: "c-budget", title: "Set the budget and a sponsorship or fundraising plan", detail: "List confirmed funds separately from hoped-for funds.", leadDays: 100, effortDays: 14, importance: 3, dependsOn: ["c-committee"] },
  { id: "c-venue", title: "Secure the venue or ground and the date", detail: "Confirm capacity, power, restrooms and access, and get the booking in writing.", leadDays: 90, effortDays: 14, importance: 3, dependsOn: ["c-budget"], categoryId: "venue", vendorTypeId: "venue" },
  { id: "c-programme", title: "Plan the programme, speakers and performers", detail: "Draft the running order and confirm each participant's time slot.", leadDays: 70, effortDays: 21, importance: 2, dependsOn: ["c-venue"], categoryId: "programme", vendorTypeId: "programme" },
  { id: "c-permissions", title: "Apply for permissions, noise and safety clearances", detail: "Processing can take weeks. Ask the venue and local authority what is needed for your crowd size.", leadDays: 60, effortDays: 21, importance: 3, dependsOn: ["c-venue"], categoryId: "safety", vendorTypeId: "safety" },
  { id: "c-promo", title: "Design and start promotion", detail: "Use channels your community actually reads, and give a clear registration link or number.", leadDays: 50, effortDays: 14, importance: 2, dependsOn: ["c-programme"], categoryId: "promotion" },
  { id: "c-av", title: "Book sound, lighting and AV", detail: "Share the programme so the vendor sizes the system correctly.", leadDays: 45, effortDays: 10, importance: 2, dependsOn: ["c-programme"], categoryId: "sound_av", vendorTypeId: "av" },
  { id: "c-food", title: "Arrange food and refreshments", detail: "Plan for volunteers and speakers too, and confirm dietary and cultural needs.", leadDays: 40, effortDays: 14, importance: 3, dependsOn: ["c-venue"], categoryId: "food", vendorTypeId: "caterer" },
  { id: "c-registrations", title: "Open registrations and track attendance", detail: "A running headcount keeps food and seating honest.", leadDays: 35, effortDays: 21, importance: 2, dependsOn: ["c-promo"] },
  { id: "c-volunteers", title: "Recruit and brief volunteers", detail: "Give every volunteer a role, a shift and a point of contact.", leadDays: 30, effortDays: 14, importance: 2, dependsOn: ["c-committee"], categoryId: "logistics" },
  { id: "c-signage", title: "Order signage, banners and printed material", detail: "Include directions, accessibility routes and the programme board.", leadDays: 25, effortDays: 10, importance: 1, dependsOn: ["c-programme"], categoryId: "decor", vendorTypeId: "signage" },
  { id: "c-safety-plan", title: "Prepare the crowd, first-aid and emergency plan", detail: "Mark exits, name a first-aid lead and share an emergency contact sheet.", leadDays: 14, effortDays: 7, importance: 3, dependsOn: ["c-permissions", "c-volunteers"], categoryId: "safety", vendorTypeId: "safety" },
  { id: "c-confirm", title: "Confirm all vendors, performers and payments", detail: "Reconfirm times, set-up needs and who is paid when.", leadDays: 10, effortDays: 5, importance: 3, dependsOn: ["c-av", "c-food", "c-programme"] },
  { id: "c-runsheet", title: "Share the run-of-show and contact list", detail: "Everyone gets the same one-page plan and phone numbers.", leadDays: 5, effortDays: 3, importance: 2, dependsOn: ["c-safety-plan", "c-confirm"] },
  { id: "c-setup", title: "Set up on site and brief everyone", detail: "Do a short briefing before doors open.", leadDays: 1, effortDays: 1, importance: 3, dependsOn: ["c-runsheet"] },
];

export const TASKS: Record<EventType, readonly TaskDef[]> = { wedding, birthday, community };
