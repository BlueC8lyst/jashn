import { describe, expect, it } from "vitest";
import { createAiService } from "@/lib/server/ai/service";
import { createRateLimiter, createTtlCache } from "@/lib/server/security";
import { samplePlan } from "./helpers";

describe("AI Service API", () => {
  const weddingPlan = samplePlan("wedding");
  const createService = (env: Record<string, string | undefined> = {}) =>
    createAiService({
      env,
      fetchImpl: fetch,
      perCaller: createRateLimiter({ limit: 10, windowMs: 60_000, maxKeys: 100 }),
      global: createRateLimiter({ limit: 50, windowMs: 60_000, maxKeys: 1 }),
      cache: createTtlCache({ maxEntries: 10, ttlMs: 60_000 }),
    });

  it("returns fallback ideas when GEMINI_API_KEY is not set", async () => {
    const service = createService({});
    const request = new Request("https://example.com/api/ai", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
      },
      body: JSON.stringify({
        task: "ideas",
        input: {
          brief: weddingPlan.brief,
          protect: ["venue"],
          flexible: ["decor"],
        },
      }),
    });

    const response = await service.handle(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.source).toBe("fallback");
    expect(json.data.concepts.length).toBeGreaterThan(0);
  });

  it("handles parse_quote task offline with heuristic fallback", async () => {
    const service = createService({});
    const request = new Request("https://example.com/api/ai", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
      },
      body: JSON.stringify({
        task: "parse_quote",
        input: {
          text: "Sharma Caterers: ₹900 per plate for 200 guests. Includes crockery.",
          currency: "INR",
          guests: 200,
        },
      }),
    });

    const response = await service.handle(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.data.vendorName).toBe("Sharma Caterers");
    expect(json.data.amount).toBe(900);
    expect(json.data.pricing).toBe("per_guest");
  });

  it("rejects cross-site requests with 403", async () => {
    const service = createService({});
    const request = new Request("https://example.com/api/ai", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify({
        task: "ideas",
        input: { brief: weddingPlan.brief, protect: [], flexible: [] },
      }),
    });

    const response = await service.handle(request);
    expect(response.status).toBe(403);
  });

  it("rejects invalid json payloads with 400", async () => {
    const service = createService({});
    const request = new Request("https://example.com/api/ai", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
      },
      body: JSON.stringify({ task: "nonexistent", input: {} }),
    });

    const response = await service.handle(request);
    expect(response.status).toBe(400);
  });
});
