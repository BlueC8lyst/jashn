import { z } from "zod";

/**
 * A minimal Gemini client over plain `fetch`: no SDK, so nothing extra to load
 * on a cold start and no dependency to keep patched.
 *
 * Request shape follows the public `generateContent` REST API with structured
 * output (`responseMimeType` + `responseJsonSchema`). Sampling parameters
 * (temperature, topP, topK) are deliberately NOT sent: current Gemini models
 * deprecate them, and omitting them keeps one request valid across models.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];
const MODEL_ID = /^[a-z0-9][a-z0-9.-]{1,60}$/;

export interface GeminiConfig {
  apiKey: string;
  models: string[];
  timeoutMs: number;
}

/** Returns null (AI disabled, fallbacks used) when no key is configured. */
export function readGeminiConfig(env: Readonly<Record<string, string | undefined>>): GeminiConfig | null {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  const configured = (env.GEMINI_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter((model) => MODEL_ID.test(model));
  return { apiKey, models: configured.length > 0 ? configured : DEFAULT_MODELS, timeoutMs: 12_000 };
}

export type GeminiFailure = "timeout" | "rate_limited" | "unavailable" | "bad_request" | "blocked" | "bad_output";

export class GeminiError extends Error {
  constructor(readonly kind: GeminiFailure) {
    super(`Gemini request failed: ${kind}`);
    this.name = "GeminiError";
  }
}

// Keywords Gemini's structured output accepts. Anything else (string length,
// patterns, $schema...) is dropped from the request; our own zod schemas still
// enforce those limits on the response.
const ALLOWED_KEYS = new Set([
  "type",
  "properties",
  "required",
  "items",
  "enum",
  "description",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "additionalProperties",
]);

function prune(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(prune);
  if (node === null || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "properties" && value && typeof value === "object") {
      out[key] = Object.fromEntries(Object.entries(value).map(([name, schema]) => [name, prune(schema)]));
    } else if (ALLOWED_KEYS.has(key)) {
      out[key] = prune(value);
    }
  }
  return out;
}

/** Converts a zod schema into the JSON-Schema subset Gemini accepts. */
export function toGeminiSchema(schema: z.ZodType): unknown {
  return prune(z.toJSONSchema(schema));
}

export interface JsonRequest {
  system: string;
  user: string;
  schema: z.ZodType;
  maxOutputTokens: number;
}

interface GeminiResponse {
  candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  promptFeedback?: { blockReason?: string };
}

/**
 * Asks Gemini for JSON and returns it parsed (not yet validated: the caller
 * validates against the same zod schema). Models are tried in order only when a
 * model id is rejected (404); rate limits and outages fail fast so latency stays
 * bounded.
 */
export async function generateJson(
  config: GeminiConfig,
  request: JsonRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: request.system }] },
    contents: [{ role: "user", parts: [{ text: request.user }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: toGeminiSchema(request.schema),
      maxOutputTokens: request.maxOutputTokens,
    },
  });

  let lastFailure: GeminiFailure = "unavailable";
  for (const model of config.models) {
    let response: Response;
    try {
      response = await fetchImpl(`${ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey },
        body,
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch (error) {
      throw new GeminiError(error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "unavailable");
    }

    if (response.status === 404) {
      lastFailure = "bad_request";
      continue; // unknown model id: try the next one
    }
    if (response.status === 429) throw new GeminiError("rate_limited");
    if (response.status >= 500) throw new GeminiError("unavailable");
    if (!response.ok) throw new GeminiError("bad_request");

    const payload = (await response.json().catch(() => null)) as GeminiResponse | null;
    if (payload?.promptFeedback?.blockReason) throw new GeminiError("blocked");
    const candidate = payload?.candidates?.[0];
    if (!candidate || (candidate.finishReason && candidate.finishReason !== "STOP")) throw new GeminiError("bad_output");
    const text = (candidate.content?.parts ?? [])
      .filter((part) => !part.thought && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
    try {
      return JSON.parse(text);
    } catch {
      throw new GeminiError("bad_output");
    }
  }
  throw new GeminiError(lastFailure);
}
