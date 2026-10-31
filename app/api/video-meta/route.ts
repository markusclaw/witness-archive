import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { extractYouTubeId } from "@/lib/youtube";
import { fetchVideoMeta } from "@/lib/video-meta";

export const dynamic = "force-dynamic";

export type { VideoMeta } from "@/lib/video-meta";

/**
 * POST { url } -> VideoMeta
 * Preferred: YouTube Data API v3 (needs YOUTUBE_API_KEY; 1 quota unit per call,
 * 10,000/day free). Fallback: YouTube's public oEmbed, then noembed.com.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const {
    data: { user },
  } = await createServerSupabase().auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const videoId = extractYouTubeId(typeof body.url === "string" ? body.url : "");
  if (!videoId) return NextResponse.json({ error: "Not a YouTube link." }, { status: 400 });

  const meta = await fetchVideoMeta(videoId);
  if (meta) return NextResponse.json(meta, { headers: { "cache-control": "private, max-age=3600" } });
  return NextResponse.json({ error: "Couldn't read this video's details." }, { status: 502 });
}
