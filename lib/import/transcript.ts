/**
 * Transcript for an imported video, in Greg's order:
 *   1. a transcript sent with the API request (never fetched)
 *   2. YouTube directly (free, best effort)
 *   3. the paid transcript service (Supadata) when YouTube refuses the server
 *
 * The outcome keeps "blocked" (we couldn't get it — retry or send it) apart
 * from "no_transcript" (confirmed: the video has none). Only the second is a skip.
 */
import { fetchYouTubeTranscript, TranscriptError } from "@/lib/youtube-transcript";
import { cleanTranscript } from "@/lib/transcript";

export type TranscriptSource = "supplied" | "youtube" | "paid";

export type TranscriptOutcome =
  | { ok: true; text: string; language: string | null; source: TranscriptSource; auto: boolean }
  | { ok: false; code: "no_transcript" | "blocked" | "unavailable"; reason: string };

const MIN_CHARS = 200;

export async function resolveTranscript(videoId: string, opts: { supplied?: string | null; language?: string | null }): Promise<TranscriptOutcome> {
  // 1. Supplied by the caller.
  const supplied = opts.supplied ? cleanTranscript(opts.supplied).trim() : "";
  if (supplied.length >= MIN_CHARS) return { ok: true, text: supplied, language: opts.language ?? null, source: "supplied", auto: false };

  // 2. YouTube directly.
  const preferred = [...new Set([opts.language ?? "en", "en", "es"])];
  let youtubeSaid: TranscriptError["code"] | "error";
  let youtubeReason: string;
  try {
    const t = await fetchYouTubeTranscript(videoId, preferred);
    const text = cleanTranscript(t.text).trim();
    if (text.length >= MIN_CHARS) return { ok: true, text, language: t.language, source: "youtube", auto: t.kind === "auto" };
    youtubeSaid = "parse";
    youtubeReason = "YouTube's captions were nearly empty.";
  } catch (err) {
    youtubeSaid = err instanceof TranscriptError ? err.code : "error";
    youtubeReason = err instanceof Error ? err.message : "YouTube fetch failed.";
  }
  if (youtubeSaid === "unavailable") return { ok: false, code: "unavailable", reason: youtubeReason };

  // 3. Paid service — also the confirmation step when YouTube showed the server no captions,
  //    because YouTube sometimes hides captions from data-center callers.
  const paid = await fetchPaidTranscript(videoId, opts.language ?? null);
  if (paid.ok) return paid;
  if (paid.code === "not_configured") {
    return {
      ok: false,
      code: "blocked",
      reason:
        youtubeSaid === "no_captions"
          ? "YouTube showed the server no captions, but that isn't confirmed (it sometimes hides them). Send the transcript with the request, or add SUPADATA_API_KEY to confirm."
          : `YouTube refused the server's request (${youtubeReason}) and no paid transcript service is configured. Will retry; or send the transcript with the request.`,
    };
  }
  if (paid.code === "no_transcript") return { ok: false, code: "no_transcript", reason: "Confirmed: this video has no transcript." };
  if (paid.code === "unavailable") return { ok: false, code: "unavailable", reason: paid.reason };
  return { ok: false, code: "blocked", reason: `YouTube refused the request (${youtubeReason}); the transcript service also failed (${paid.reason}). Will retry; or send the transcript with the request.` };
}

type PaidOutcome =
  | { ok: true; text: string; language: string | null; source: "paid"; auto: boolean }
  | { ok: false; code: "not_configured" | "no_transcript" | "unavailable" | "error"; reason: string };

interface SupadataBody {
  content?: string | { text?: string }[];
  lang?: string;
  jobId?: string;
  status?: string;
  error?: string | { message?: string; error?: string };
  message?: string;
  details?: string;
}

/** Supadata: GET /v1/transcript?url=…&text=true&mode=native (native = existing captions only). */
export async function fetchPaidTranscript(videoId: string, lang: string | null): Promise<PaidOutcome> {
  const key = process.env.SUPADATA_API_KEY;
  if (!key) return { ok: false, code: "not_configured", reason: "No paid transcript service configured." };
  const base = (process.env.SUPADATA_API_BASE ?? "https://api.supadata.ai").replace(/\/$/, "");
  const u = new URL(`${base}/v1/transcript`);
  u.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
  u.searchParams.set("text", "true");
  u.searchParams.set("mode", "native");
  if (lang) u.searchParams.set("lang", lang);
  const headers = { "x-api-key": key, accept: "application/json" };
  try {
    let res = await fetch(u.toString(), { headers, signal: AbortSignal.timeout(60_000) });
    let body = (await res.json().catch(() => ({}))) as SupadataBody;
    if (res.status === 202 && body.jobId) {
      // Large videos are processed as a job: poll for up to ~50 seconds.
      const jobUrl = `${base}/v1/transcript/${encodeURIComponent(body.jobId)}`;
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 2_000));
        res = await fetch(jobUrl, { headers, signal: AbortSignal.timeout(20_000) });
        body = (await res.json().catch(() => ({}))) as SupadataBody;
        if (body.status === "completed" || body.status === "failed") break;
      }
      if (body.status !== "completed") {
        if (body.status === "failed" && errorCode(body) === "transcript-unavailable") return { ok: false, code: "no_transcript", reason: "Transcript service: no transcript." };
        return { ok: false, code: "error", reason: body.status === "failed" ? `job failed: ${errorText(body)}` : "job still running" };
      }
    }
    if (res.status === 206 || errorCode(body) === "transcript-unavailable") return { ok: false, code: "no_transcript", reason: "Transcript service: no transcript." };
    if (res.status === 404) return { ok: false, code: "unavailable", reason: "The video doesn't exist or is private." };
    if (!res.ok) return { ok: false, code: "error", reason: `transcript service HTTP ${res.status}: ${errorText(body)}` };
    const text = typeof body.content === "string" ? body.content : Array.isArray(body.content) ? body.content.map((c) => c.text ?? "").join("\n") : "";
    const cleaned = cleanTranscript(text).trim();
    if (!cleaned) return { ok: false, code: "no_transcript", reason: "Transcript service: no speech in the captions." };
    return { ok: true, text: cleaned, language: body.lang ? body.lang.split("-")[0].toLowerCase() : null, source: "paid", auto: false };
  } catch (err) {
    return { ok: false, code: "error", reason: err instanceof Error ? err.message : "network error" };
  }
}

function errorCode(b: SupadataBody): string | null {
  if (typeof b.error === "string") return b.error;
  if (b.error && typeof b.error === "object") return b.error.error ?? null;
  return null;
}
function errorText(b: SupadataBody): string {
  return (typeof b.error === "object" ? b.error?.message : null) ?? b.details ?? b.message ?? (typeof b.error === "string" ? b.error : "") ?? "";
}
