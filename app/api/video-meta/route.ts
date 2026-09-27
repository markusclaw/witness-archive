import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { extractYouTubeId } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export interface VideoMeta {
  videoId: string;
  title: string | null;
  author: string | null;
  authorUrl: string | null;
  thumbnail: string | null;
}

/**
 * POST { url } -> VideoMeta
 * Uses YouTube's public oEmbed endpoint (documented, no key, not bot-gated).
 * Falls back to noembed.com, which proxies the same data.
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

  const watch = `https://www.youtube.com/watch?v=${videoId}`;
  const sources = [
    `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`,
    `https://noembed.com/embed?url=${encodeURIComponent(watch)}`,
  ];
  for (const src of sources) {
    try {
      const res = await fetch(src, { headers: { accept: "application/json", "user-agent": "WitnessArchive/1.0 (+https://witness-archive.org)" }, signal: AbortSignal.timeout(8_000) });
      if (!res.ok) continue;
      const j = (await res.json()) as { title?: string; author_name?: string; author_url?: string; thumbnail_url?: string; error?: string };
      if (j.error || (!j.title && !j.author_name)) continue;
      const meta: VideoMeta = {
        videoId,
        title: j.title?.trim() || null,
        author: j.author_name?.trim() || null,
        authorUrl: j.author_url && /^https:\/\/(www\.)?youtube\.com\//.test(j.author_url) ? j.author_url : null,
        thumbnail: j.thumbnail_url ?? null,
      };
      return NextResponse.json(meta, { headers: { "cache-control": "private, max-age=3600" } });
    } catch {
      /* try the next source */
    }
  }
  return NextResponse.json({ error: "Couldn't read this video's details." }, { status: 502 });
}
