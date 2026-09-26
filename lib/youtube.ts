/**
 * Accepts every common YouTube URL shape and returns the 11-char video id:
 *   https://www.youtube.com/watch?v=ID&t=30s
 *   https://youtu.be/ID?si=abc
 *   https://www.youtube.com/shorts/ID
 *   https://www.youtube.com/embed/ID
 *   https://www.youtube.com/live/ID
 *   https://m.youtube.com/watch?v=ID
 */
export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return isValidId(id) ? id : null;
    }
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const v = u.searchParams.get("v");
      if (isValidId(v)) return v as string;
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => ["shorts", "embed", "live", "v"].includes(p));
      const id = idx >= 0 ? parts[idx + 1] : undefined;
      return isValidId(id) ? (id as string) : null;
    }
  } catch {
    /* not a URL */
  }
  return null;
}

function isValidId(id: string | null | undefined): id is string {
  return !!id && /^[A-Za-z0-9_-]{11}$/.test(id);
}

export function youtubeEmbedUrl(url: string | null | undefined): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` : null;
}

/** maxres isn't guaranteed to exist; hqdefault always does. */
export function youtubeThumbnail(url: string | null | undefined, quality: "hq" | "maxres" = "hq"): string | null {
  const id = extractYouTubeId(url);
  if (!id) return null;
  return `https://i.ytimg.com/vi/${id}/${quality === "maxres" ? "maxresdefault" : "hqdefault"}.jpg`;
}

export function youtubeWatchUrl(url: string | null | undefined): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}
