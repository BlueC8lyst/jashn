import type { z } from "zod";
import {
  AlternativesOutputSchema,
  IdeasOutputSchema,
  ParsedQuoteOutputSchema,
  VendorQuestionsOutputSchema,
  type AiRequest,
  type AiTaskName,
  type AiTaskOutputs,
} from "@/lib/ai-contract";
import { fallbackAlternatives, fallbackIdeas, fallbackParseQuote, fallbackVendorQuestions } from "./fallback";
import { INSTRUCTIONS, briefContext, categoryLabel, vendorLabel, wrapUserData } from "./prompts";
import { cleanText } from "./sanitize";

type InputOf<T extends AiTaskName> = Extract<AiRequest, { task: T }>["input"];

export interface TaskDefinition<T extends AiTaskName> {
  output: z.ZodType<AiTaskOutputs[T]>;
  maxOutputTokens: number;
  /** The user-turn text for the model (instruction plus cleaned data). */
  prompt(input: InputOf<T>): string;
  fallback(input: InputOf<T>): AiTaskOutputs[T];
}

/** One entry per AI task: how to ask, how to validate the answer, and what to show if the model is unavailable. */
export const TASKS: { [T in AiTaskName]: TaskDefinition<T> } = {
  ideas: {
    output: IdeasOutputSchema,
    maxOutputTokens: 1800,
    prompt: ({ brief, protect, flexible, feedback, previous }) =>
      wrapUserData(INSTRUCTIONS.ideas, {
        event: briefContext(brief),
        priorities: {
          protect: protect.map((id) => categoryLabel(brief, id)),
          keepSimple: flexible.map((id) => categoryLabel(brief, id)),
        },
        feedback: feedback ? cleanText(feedback, 300) : undefined,
        previous: previous?.map((item) => ({ title: cleanText(item.title, 80), summary: cleanText(item.summary, 300) })),
      }),
    fallback: fallbackIdeas,
  },
  alternatives: {
    output: AlternativesOutputSchema,
    maxOutputTokens: 900,
    prompt: ({ brief, categoryId, cutPercent }) =>
      wrapUserData(INSTRUCTIONS.alternatives, { event: briefContext(brief), category: categoryLabel(brief, categoryId), cutPercent }),
    fallback: fallbackAlternatives,
  },
  vendor_questions: {
    output: VendorQuestionsOutputSchema,
    maxOutputTokens: 900,
    prompt: ({ brief, vendorTypeId }) =>
      wrapUserData(INSTRUCTIONS.vendor_questions, { event: briefContext(brief), vendor: vendorLabel(brief, vendorTypeId) }),
    fallback: fallbackVendorQuestions,
  },
  parse_quote: {
    output: ParsedQuoteOutputSchema,
    maxOutputTokens: 900,
    prompt: ({ text, currency, guests }) =>
      wrapUserData(INSTRUCTIONS.parse_quote, { currency, plannedGuests: guests, message: cleanText(text, 4000) }),
    fallback: fallbackParseQuote,
  },
};
