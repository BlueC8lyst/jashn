import { z } from "zod";
import { EventBriefSchema } from "@/lib/domain/schemas";
import { CURRENCIES, LIMITS } from "@/lib/domain/types";

/**
 * The contract between the browser and the AI endpoint: what each task accepts
 * and what it must return. Output schemas are deliberately number-light: the AI
 * never supplies prices, only structure, wording and relative cost levels.
 */

const line = (max: number) => z.string().trim().min(1).max(max);

export const ConceptSchema = z.strictObject({
  title: line(80),
  tagline: line(140),
  description: line(500),
  highlights: z.array(line(120)).min(2).max(5),
  goodFor: line(160),
  costLevel: z.enum(["low", "medium", "high"]),
  adaptations: z.array(line(140)).max(3),
});
export type Concept = z.infer<typeof ConceptSchema>;

export const IdeasOutputSchema = z.strictObject({
  questions: z.array(line(200)).max(3),
  concepts: z.array(ConceptSchema).max(3),
});
export type IdeasOutput = z.infer<typeof IdeasOutputSchema>;

export const AlternativesOutputSchema = z.strictObject({
  options: z
    .array(
      z.strictObject({
        title: line(80),
        description: line(300),
        whatChanges: line(200),
        relativeCost: z.enum(["lower", "similar"]),
      }),
    )
    .min(2)
    .max(4),
});
export type AlternativesOutput = z.infer<typeof AlternativesOutputSchema>;

export const VendorQuestionsOutputSchema = z.strictObject({
  questions: z.array(line(200)).min(3).max(8),
  mustConfirm: z.array(line(160)).max(4),
});
export type VendorQuestionsOutput = z.infer<typeof VendorQuestionsOutputSchema>;

export const ParsedQuoteOutputSchema = z.strictObject({
  vendorName: z.string().trim().max(80).optional(),
  pricing: z.enum(["per_guest", "flat", "per_hour"]),
  amount: z.number().min(0).max(LIMITS.budgetMax).optional(),
  hours: z.number().min(0.5).max(240).optional(),
  guestsCovered: z.number().int().min(1).max(LIMITS.guestsMax).optional(),
  inclusions: z.array(line(LIMITS.quoteLineMax)).max(LIMITS.quoteListMax),
  exclusions: z.array(line(LIMITS.quoteLineMax)).max(LIMITS.quoteListMax),
  extras: z
    .array(z.strictObject({ label: line(LIMITS.quoteLineMax), amount: z.number().min(0).max(LIMITS.budgetMax).optional() }))
    .max(LIMITS.quoteListMax),
  ambiguities: z.array(line(160)).max(6),
});
export type ParsedQuoteOutput = z.infer<typeof ParsedQuoteOutputSchema>;

export const AiRequestSchema = z.discriminatedUnion("task", [
  z.strictObject({
    task: z.literal("ideas"),
    input: z.strictObject({
      brief: EventBriefSchema,
      protect: z.array(z.string().max(40)).max(4),
      flexible: z.array(z.string().max(40)).max(4),
      feedback: z.string().trim().max(300).optional(),
      previous: z.array(z.strictObject({ title: line(80), summary: line(300) })).max(3).optional(),
    }),
  }),
  z.strictObject({
    task: z.literal("alternatives"),
    input: z.strictObject({
      brief: EventBriefSchema,
      categoryId: z.string().min(1).max(40),
      cutPercent: z.number().int().min(1).max(90),
    }),
  }),
  z.strictObject({
    task: z.literal("vendor_questions"),
    input: z.strictObject({ brief: EventBriefSchema, vendorTypeId: z.string().min(1).max(40) }),
  }),
  z.strictObject({
    task: z.literal("parse_quote"),
    input: z.strictObject({
      text: z.string().trim().min(1).max(4000),
      currency: z.enum(CURRENCIES),
      guests: z.number().int().min(1).max(LIMITS.guestsMax),
    }),
  }),
]);
export type AiRequest = z.infer<typeof AiRequestSchema>;
export type AiTaskName = AiRequest["task"];

export interface AiTaskOutputs {
  ideas: IdeasOutput;
  alternatives: AlternativesOutput;
  vendor_questions: VendorQuestionsOutput;
  parse_quote: ParsedQuoteOutput;
}

/** `source` tells the user whether text came from the model or from the built-in fallback. */
export interface AiSuccess<T extends AiTaskName> {
  ok: true;
  source: "ai" | "fallback";
  task: T;
  data: AiTaskOutputs[T];
}
export interface AiFailure {
  ok: false;
  error: { code: string; message: string };
}
