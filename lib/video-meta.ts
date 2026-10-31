/** YouTube video details: Data API v3 when YOUTUBE_API_KEY is set, otherwise oEmbed. Server only. */

export interface VideoMeta {
  videoId: string;
  title: string | null;
  author: string | null;
  authorUrl: string | null;
  thumbnail: string | null;
  /** Only when YOUTUBE_API_KEY is configured: */
  publishedAt: string | null;
  durationSeconds: number | null;
  description: string | null;
  language: string | null; // BCP-47 base, e.g. "en", "es"
  source: "youtube_api" | "oembed";
}

/** Best available details for a video, or null. */
export async function fetchVideoMeta(videoId: string): Promise<VideoMeta | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    const meta = await fromDataApi(videoId, apiKey);
    if (meta) return meta;
  }
  return fromOEmbed(videoId);
}

async function fromDataApi(videoId: string, key: string): Promise<VideoMeta | null> {
  try {
    const u = new URL("https://www.googleapis.com/youtube/v3/videos");
    u.searchParams.set("part", "snippet,contentDetails");
    u.searchParams.set("id", videoId);
    u.searchParams.set("key", key);
    const res = await fetch(u.toString(), { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) {
      console.warn("youtube api:", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const j = (await res.json()) as {
      items?: {
        snippet?: { title?: string; description?: string; channelTitle?: string; channelId?: string; publishedAt?: string; defaultAudioLanguage?: string; defaultLanguage?: string; thumbnails?: Record<string, { url: string }> };
        contentDetails?: { duration?: string };
      }[];
    };
    const item = j.items?.[0];
    if (!item?.snippet) return null;
    const s = item.snippet;
    const lang = (s.defaultAudioLanguage || s.defaultLanguage || "").split("-")[0].toLowerCase() || null;
    return {
      videoId,
      title: s.title?.trim() || null,
      author: s.channelTitle?.trim() || null,
      authorUrl: s.channelId ? `https://www.youtube.com/channel/${s.channelId}` : null,
      thumbnail: s.thumbnails?.maxres?.url ?? s.thumbnails?.high?.url ?? null,
      publishedAt: s.publishedAt ?? null,
      durationSeconds: parseIsoDuration(item.contentDetails?.duration),
      description: s.description?.trim().slice(0, 5000) || null,
      language: lang && /^[a-z]{2}$/.test(lang) ? lang : null,
      source: "youtube_api",
    };
  } catch (err) {
    console.warn("youtube api failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function fromOEmbed(videoId: string): Promise<VideoMeta | null> {
  const watch = `https://www.youtube.com/watch?v=${videoId}`;
  const sources = [`https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`, `https://noembed.com/embed?url=${encodeURIComponent(watch)}`];
  for (const src of sources) {
    try {
      const res = await fetch(src, { headers: { accept: "application/json", "user-agent": "WitnessArchive/1.0 (+https://witness-archive.org)" }, signal: AbortSignal.timeout(8_000) });
      if (!res.ok) continue;
      const j = (await res.json()) as { title?: string; author_name?: string; author_url?: string; thumbnail_url?: string; error?: string };
      if (j.error || (!j.title && !j.author_name)) continue;
      return {
        videoId,
        title: j.title?.trim() || null,
        author: j.author_name?.trim() || null,
        authorUrl: j.author_url && /^https:\/\/(www\.)?youtube\.com\//.test(j.author_url) ? j.author_url : null,
        thumbnail: j.thumbnail_url ?? null,
        publishedAt: null,
        durationSeconds: null,
        description: null,
        language: null,
        source: "oembed",
      };
    } catch {
      /* next */
    }
  }
  return null;
}

/** "PT1H2M3S" -> 3723 */
function parseIsoDuration(d: string | undefined): number | null {
  if (!d) return null;
  const m = d.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0);
}
