import { createDefaultAiService } from "@/lib/server/ai/service";

// The model call can take several seconds; give the function room on Vercel.
export const maxDuration = 30;
export const dynamic = "force-dynamic";

// Created once per server instance so the rate limiters and cache are shared across requests.
const service = createDefaultAiService();

export function POST(request: Request): Promise<Response> {
  return service.handle(request);
}
