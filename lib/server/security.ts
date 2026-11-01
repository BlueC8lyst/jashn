/**
 * Small, dependency-free building blocks for the API route: bounded rate
 * limiting, a bounded TTL cache, memory-capped body reading and a same-origin
 * check. Every structure here has a hard size cap, so a flood of requests
 * cannot grow server memory without bound.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
  readonly size: number;
}

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window limiter with at most `maxKeys` tracked callers.
 *
 * A Map iterates in insertion order and each window is re-inserted when it
 * resets, so expired windows cluster at the front: eviction scans only from the
 * front and stops at the first live entry, giving amortised O(1) work per call.
 * If the table is still full of live windows the oldest is dropped (FIFO).
 *
 * State is per server instance. On a multi-instance deployment each instance
 * enforces its own limit; a shared store would be the upgrade path.
 */
export function createRateLimiter(options: { limit: number; windowMs: number; maxKeys: number; now?: () => number }): RateLimiter {
  const { limit, windowMs, maxKeys } = options;
  const now = options.now ?? Date.now;
  const windows = new Map<string, Window>();

  function evict(time: number): void {
    for (const [key, window] of windows) {
      if (window.resetAt > time && windows.size < maxKeys) break;
      windows.delete(key);
      if (windows.size < maxKeys) break;
    }
  }

  return {
    check(key) {
      const time = now();
      const current = windows.get(key);
      if (current && current.resetAt > time) {
        if (current.count >= limit) return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - time) / 1000) };
        current.count++;
        return { allowed: true, retryAfterSeconds: 0 };
      }
      windows.delete(key);
      if (windows.size >= maxKeys) evict(time);
      windows.set(key, { count: 1, resetAt: time + windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    },
    get size() {
      return windows.size;
    },
  };
}

export interface TtlCache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  readonly size: number;
}

/** LRU cache with a TTL and a hard entry cap. get/set are O(1) (Map insertion order is the recency order). */
export function createTtlCache<V>(options: { maxEntries: number; ttlMs: number; now?: () => number }): TtlCache<V> {
  const now = options.now ?? Date.now;
  const entries = new Map<string, { value: V; expiresAt: number }>();
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return undefined;
      }
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, { value, expiresAt: now() + options.ttlMs });
      while (entries.size > options.maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    get size() {
      return entries.size;
    },
  };
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Reads a JSON body without ever buffering more than `maxBytes`: the stream is
 * cancelled the moment the limit is crossed, so an oversized upload costs
 * almost nothing.
 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) throw new HttpError(415, "unsupported_media_type", "Send JSON.");
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, "payload_too_large", "That request is too large.");
  if (!request.body) throw new HttpError(400, "empty_body", "The request body is empty.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "payload_too_large", "That request is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "invalid_json", "The request body is not valid JSON.");
  }
}

/**
 * Rejects cross-site browser requests so other websites cannot spend this
 * app's AI quota. Browsers send `Sec-Fetch-Site`; older clients fall back to
 * comparing `Origin` with `Host`. Requests with neither (scripts, curl) pass
 * and are covered by the rate limiter.
 */
export function assertSameOrigin(request: Request): void {
  const site = request.headers.get("sec-fetch-site");
  if (site) {
    if (site === "same-origin" || site === "none") return;
    throw new HttpError(403, "cross_origin", "Cross-site requests are not allowed.");
  }
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("host");
  try {
    if (new URL(origin).host === host) return;
  } catch {
    /* fall through to rejection */
  }
  throw new HttpError(403, "cross_origin", "Cross-site requests are not allowed.");
}

/** Caller identity for rate limiting. Vercel sets these headers itself, so they are trustworthy there. */
export function clientKey(request: Request): string {
  const real = request.headers.get("x-real-ip");
  if (real) return real.slice(0, 64);
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return (forwarded.split(",")[0] ?? "").trim().slice(0, 64) || "unknown";
  return "unknown";
}
