"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiRequest, AiTaskName, AiTaskOutputs } from "@/lib/ai-contract";
import { callAi } from "./ai";

export interface AiState<T extends AiTaskName> {
  status: "idle" | "loading" | "ready" | "error";
  data: AiTaskOutputs[T] | null;
  source: "ai" | "fallback" | null;
  error: string | null;
}

/** Runs one AI call at a time; a newer call cancels the previous one, and unmounting cancels any in flight. */
export function useAiCall<T extends AiTaskName>() {
  const [state, setState] = useState<AiState<T>>({ status: "idle", data: null, source: null, error: null });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback(async (request: Extract<AiRequest, { task: T }>) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState((previous) => ({ ...previous, status: "loading", error: null }));
    try {
      const result = await callAi<T>(request, current.signal);
      setState({ status: "ready", data: result.data, source: result.source, error: null });
      return result.data;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return null;
      setState({ status: "error", data: null, source: null, error: error instanceof Error ? error.message : "Something went wrong." });
      return null;
    }
  }, []);

  return { state, run };
}
