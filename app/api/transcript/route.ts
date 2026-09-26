import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { extractYouTubeId } from "@/lib/youtube";
import { fetchYouTubeTranscript, TranscriptError } from "@/lib/youtube-transcript";
import { cleanTranscript } from "@/lib/transcript";

export const dynamic = "force-dynamic";

/**
 * POST { url, lang? } -> { text, language, kind, videoTitle, author }
 * Best effort: YouTube may refuse server-side callers. The client shows a
 * copy-and-paste fallback on any failure.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Sign in to import a transcript." }, { status: 401 });
  const {
    data: { user },
  } = await createServerSupabase().auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });

  let body: { url?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const videoId = extractYouTubeId(typeof body.url === "string" ? body.url : "");
  if (!videoId) return NextResponse.json({ error: "That doesn't look like a YouTube link." }, { status: 400 });
  const lang = typeof body.lang === "string" && /^[a-z]{2}$/i.test(body.lang) ? body.lang.toLowerCase() : "en";
  const preferred = [...new Set([lang, "en", "es"])];

  try {
    const t = await fetchYouTubeTranscript(videoId, preferred);
    return NextResponse.json({
      text: cleanTranscript(t.text),
      language: t.language,
      kind: t.kind,
      videoTitle: t.videoTitle,
      author: t.author,
    });
  } catch (err) {
    if (err instanceof TranscriptError) {
      const status = err.code === "no_captions" ? 404 : err.code === "unavailable" ? 404 : 502;
      return NextResponse.json({ error: err.message, code: err.code, fallback: err.code !== "unavailable" }, { status });
    }
    console.error("transcript:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't fetch the transcript right now.", code: "blocked", fallback: true }, { status: 502 });
  }
}
