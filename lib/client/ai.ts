import type { AiFailure, AiRequest, AiSuccess, AiTaskName } from "@/lib/ai-contract";

export class AiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "AiClientError";
  }
}

/** Calls the AI endpoint. Throws AiClientError with a user-presentable message. */
export async function callAi<T extends AiTaskName>(
  request: Extract<AiRequest, { task: T }>,
  signal?: AbortSignal,
): Promise<AiSuccess<T>> {
  let response: Response;
  try {
    response = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AiClientError("Could not reach the assistant. Check your connection and try again.", "network");
  }
  const body = (await response.json().catch(() => null)) as AiSuccess<T> | AiFailure | null;
  if (!response.ok || !body || body.ok === false) {
    const message = body && body.ok === false ? body.error.message : "The assistant is unavailable right now.";
    throw new AiClientError(message, body && body.ok === false ? body.error.code : "unknown");
  }
  return body;
}
