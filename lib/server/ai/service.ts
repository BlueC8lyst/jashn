import { AiRequestSchema, type AiFailure, type AiSuccess, type AiTaskName } from "@/lib/ai-contract";
import { generateJson, GeminiError, readGeminiConfig } from "./gemini";
import { SYSTEM_PROMPT } from "./prompts";
import { TASKS, type TaskDefinition } from "./tasks";
import {
  assertSameOrigin,
  clientKey,
  createRateLimiter,
  createTtlCache,
  HttpError,
  readJsonBody,
  type RateLimiter,
  type TtlCache,
} from "../security";

/** Hard cap on a request body: the largest legitimate request (a brief plus a pasted quote) is well under this. */
const MAX_BODY_BYTES = 16 * 1024;

export interface AiServiceDeps {
  env: Readonly<Record<string, string | undefined>>;
  fetchImpl: typeof fetch;
  perCaller: RateLimiter;
  global: RateLimiter;
  cache: TtlCache<AiSuccess<AiTaskName>>;
}

const headers = { "content-type": "application/json", "cache-control": "no-store" } as const;

function json(body: AiSuccess<AiTaskName> | AiFailure, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra } });
}

function failure(status: number, code: string, message: string, extra: Record<string, string> = {}): Response {
  return json({ ok: false, error: { code, message } }, status, extra);
}

/**
 * The AI endpoint as a plain function of its dependencies, so tests can inject
 * a fake `fetch`, fake clocks and tiny limits.
 *
 * Request flow (cheapest checks first): same-origin -> per-caller rate limit ->
 * global rate limit -> bounded body read -> schema validation -> cache ->
 * in-flight coalescing -> model call -> output validation. Any model failure
 * degrades to the built-in fallback instead of an error page.
 */
export function createAiService(deps: AiServiceDeps) {
  // Identical concurrent requests share one model call instead of each paying for one.
  const inflight = new Map<string, Promise<AiSuccess<AiTaskName>>>();

  async function execute(task: AiTaskName, input: unknown): Promise<AiSuccess<AiTaskName>> {
    // One localized cast: `task` and `input` are correlated by the request schema,
    // which TypeScript cannot track through an indexed lookup.
    const def = TASKS[task] as unknown as TaskDefinition<AiTaskName> & { prompt(i: unknown): string; fallback(i: unknown): never };
    const fallback = (): AiSuccess<AiTaskName> => ({ ok: true, source: "fallback", task, data: def.fallback(input) });

    const config = readGeminiConfig(deps.env);
    if (!config) return fallback();

    try {
      const raw = await generateJson(
        config,
        { system: SYSTEM_PROMPT, user: def.prompt(input), schema: def.output, maxOutputTokens: def.maxOutputTokens },
        deps.fetchImpl,
      );
      const checked = def.output.safeParse(raw);
      if (!checked.success) throw new GeminiError("bad_output");
      return { ok: true, source: "ai", task, data: checked.data as never };
    } catch (error) {
      // Log the failure KIND only: never user content or the API key.
      console.error("ai_fallback", error instanceof GeminiError ? error.kind : "unexpected");
      return fallback();
    }
  }

  async function run(task: AiTaskName, input: unknown): Promise<AiSuccess<AiTaskName>> {
    const key = `${task}:${JSON.stringify(input)}`;
    const cached = deps.cache.get(key);
    if (cached) return cached;
    const pending = inflight.get(key);
    if (pending) return pending;

    const promise = execute(task, input).then((result) => {
      if (result.source === "ai") deps.cache.set(key, result);
      return result;
    });
    inflight.set(key, promise);
    try {
      return await promise;
    } finally {
      inflight.delete(key);
    }
  }

  return {
    async handle(request: Request): Promise<Response> {
      try {
        assertSameOrigin(request);

        const caller = deps.perCaller.check(clientKey(request));
        if (!caller.allowed) {
          return failure(429, "rate_limited", "Too many requests. Please wait a moment.", { "retry-after": String(caller.retryAfterSeconds) });
        }
        const overall = deps.global.check("all");
        if (!overall.allowed) {
          return failure(429, "busy", "The assistant is busy right now. Please try again shortly.", { "retry-after": String(overall.retryAfterSeconds) });
        }

        const parsed = AiRequestSchema.safeParse(await readJsonBody(request, MAX_BODY_BYTES));
        if (!parsed.success) return failure(400, "invalid_request", "That request was not valid.");

        return json(await run(parsed.data.task, parsed.data.input));
      } catch (error) {
        if (error instanceof HttpError) return failure(error.status, error.code, error.message);
        console.error("ai_unexpected");
        return failure(500, "server_error", "Something went wrong. Please try again.");
      }
    },
  };
}

export function createDefaultAiService() {
  return createAiService({
    env: process.env,
    fetchImpl: fetch,
    perCaller: createRateLimiter({ limit: 12, windowMs: 60_000, maxKeys: 2_000 }),
    global: createRateLimiter({ limit: 120, windowMs: 60_000, maxKeys: 1 }),
    cache: createTtlCache({ maxEntries: 64, ttlMs: 15 * 60_000 }),
  });
}
