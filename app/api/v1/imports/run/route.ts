import { authenticate, apiError, apiJson } from "@/lib/import/auth";
import { processNext, type ProcessResult } from "@/lib/import/jobs";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/imports/run { "max"?: 1–10 (default 3), "seconds"?: 30–600 (default 240) }
 * Processes queued videos one after another and returns what happened.
 * A new video is only started while the time budget lasts. Call repeatedly
 * (or from a scheduler) until remaining.queued is 0.
 */
export async function POST(req: Request) {
  const caller = await authenticate(req);
  if (caller instanceof Response) return caller;
  if (!process.env.ANTHROPIC_API_KEY) return apiError(503, "not_configured", "ANTHROPIC_API_KEY is not set on the server.");
  const body = (await req.json().catch(() => ({}))) as { max?: unknown; seconds?: unknown };
  const max = Math.min(10, Math.max(1, Number(body.max) || 3));
  const seconds = Math.min(600, Math.max(30, Number(body.seconds) || 240));

  const started = Date.now();
  const processed: ProcessResult[] = [];
  while (processed.length < max && Date.now() - started < seconds * 1000) {
    let r: ProcessResult | null;
    try {
      r = await processNext(caller.admin, caller.userId);
    } catch (err) {
      return apiError(500, "run_error", err instanceof Error ? err.message : "Couldn't claim a job.", { processed });
    }
    if (!r) break;
    processed.push(r);
  }

  const now = new Date().toISOString();
  const [{ count: queued }, { count: retryLater }, { count: processing }] = await Promise.all([
    caller.admin.from("import_jobs").select("id", { count: "exact", head: true }).eq("status", "queued"),
    caller.admin.from("import_jobs").select("id", { count: "exact", head: true }).eq("status", "blocked").lt("attempts", 6),
    caller.admin.from("import_jobs").select("id", { count: "exact", head: true }).eq("status", "processing"),
  ]);
  const { count: blockedDue } = await caller.admin.from("import_jobs").select("id", { count: "exact", head: true }).eq("status", "blocked").lt("attempts", 6).lte("next_attempt_at", now);
  return apiJson({
    processed,
    seconds: Math.round((Date.now() - started) / 1000),
    remaining: { queued: queued ?? 0, processing: processing ?? 0, blocked_retry_due: blockedDue ?? 0, blocked_retry_later: (retryLater ?? 0) - (blockedDue ?? 0) },
  });
}
