/**
 * Best-effort transcript fetch for a public YouTube video, using the same
 * internal endpoints YouTube's own "Show transcript" panel uses. There is no
 * official API for other people's captions, so this can fail (bot checks from
 * data-center IPs, videos without captions, format changes). Callers must
 * handle `TranscriptError` and offer the copy-paste fallback.
 */

export type TranscriptKind = "manual" | "auto";

export interface TranscriptResult {
  text: string;
  language: string; // BCP-47-ish, e.g. "en", "es"
  kind: TranscriptKind;
  videoTitle: string | null;
  author: string | null;
}

export class TranscriptError extends Error {
  constructor(
    message: string,
    public readonly code: "no_captions" | "blocked" | "unavailable" | "parse",
  ) {
    super(message);
  }
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string; // "asr" for auto-generated
  name?: { simpleText?: string; runs?: { text: string }[] };
}

interface PlayerResponse {
  playabilityStatus?: { status?: string; reason?: string };
  videoDetails?: { title?: string; author?: string };
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
}

const INNERTUBE_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

/**
 * YouTube serves different rules to different "clients". Server-side callers
 * get refused by some and tolerated by others, and which is which changes over
 * time — so we try several and take the first that yields caption tracks.
 */
const CLIENTS: { name: string; version: string; id: string; userAgent: string; extra?: Record<string, unknown> }[] = [
  { name: "WEB_EMBEDDED_PLAYER", version: "1.20240101.00.00", id: "56", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" },
  { name: "TVHTML5_SIMPLY_EMBEDDED_PLAYER", version: "2.0", id: "85", userAgent: "Mozilla/5.0 (PlayStation; PlayStation 4/12.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15" },
  { name: "ANDROID_VR", version: "1.57.29", id: "28", userAgent: "com.google.android.apps.youtube.vr.oculus/1.57.29 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip", extra: { androidSdkVersion: 32, osName: "Android", osVersion: "12L" } },
  { name: "IOS", version: "19.29.1", id: "5", userAgent: "com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)", extra: { deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iPhone", osVersion: "17.5.1.21F90" } },
  { name: "WEB", version: "2.20240101.00.00", id: "1", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" },
];

const GONE = /removed|private|does not exist|no longer available|terminated|not available in your country/i;

export async function fetchYouTubeTranscript(videoId: string, preferredLangs: string[] = ["en"]): Promise<TranscriptResult> {
  let details: PlayerResponse["videoDetails"] | undefined;
  const reasons: string[] = [];

  for (const client of CLIENTS) {
    try {
      const res = await fetch(INNERTUBE_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": client.userAgent,
          "x-youtube-client-name": client.id,
          "x-youtube-client-version": client.version,
          "accept-language": "en-US,en;q=0.9",
          origin: "https://www.youtube.com",
          referer: `https://www.youtube.com/watch?v=${videoId}`,
        },
        body: JSON.stringify({
          context: { client: { clientName: client.name, clientVersion: client.version, hl: "en", gl: "US", ...(client.extra ?? {}) }, thirdParty: { embedUrl: "https://www.youtube.com/" } },
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        reasons.push(`${client.name}: HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as PlayerResponse;
      if (json.videoDetails?.title) details = json.videoDetails;
      const status = json.playabilityStatus?.status ?? "OK";
      const reason = json.playabilityStatus?.reason ?? "";
      const tracks = json.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      if (tracks.length) {
        return await downloadTrack(tracks, preferredLangs, details);
      }
      reasons.push(`${client.name}: ${status}${reason ? ` (${reason})` : ""}, ${tracks.length} tracks`);
    } catch (err) {
      reasons.push(`${client.name}: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  // Last resort: the legacy caption list (creator-uploaded captions only).
  try {
    const listRes = await fetch(`https://www.youtube.com/api/timedtext?type=list&v=${videoId}`, { headers: { "user-agent": CLIENTS[4].userAgent }, signal: AbortSignal.timeout(8_000) });
    const xml = listRes.ok ? await listRes.text() : "";
    const tracks: CaptionTrack[] = [...xml.matchAll(/<track\s+([^>]+)\/?>/g)].map((m) => {
      const attrs = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
      return { baseUrl: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${attrs.lang_code ?? "en"}${attrs.name ? `&name=${encodeURIComponent(attrs.name)}` : ""}`, languageCode: attrs.lang_code ?? "en", kind: attrs.kind };
    });
    if (tracks.length) return await downloadTrack(tracks, preferredLangs, details);
  } catch {
    /* fall through */
  }

  console.warn("transcript: all paths failed", videoId, reasons.join(" | "));
  const allGone = reasons.length > 0 && reasons.every((r) => GONE.test(r));
  if (allGone) throw new TranscriptError("This video is private or has been removed.", "unavailable");
  const anyOk = reasons.some((r) => /: OK/.test(r));
  if (anyOk) throw new TranscriptError("This video doesn't have captions yet — YouTube hasn't generated a transcript for it.", "no_captions");
  throw new TranscriptError("YouTube declined the automated request for this video.", "blocked");
}

async function downloadTrack(tracks: CaptionTrack[], preferredLangs: string[], details: PlayerResponse["videoDetails"] | undefined): Promise<TranscriptResult> {
  const track = pickTrack(tracks, preferredLangs);
  const url = new URL(track.baseUrl);
  url.searchParams.set("fmt", "json3");
  const capRes = await fetch(url.toString(), { headers: { "user-agent": CLIENTS[4].userAgent }, signal: AbortSignal.timeout(12_000) });
  if (!capRes.ok) throw new TranscriptError("Couldn't download the captions.", "blocked");
  const raw = await capRes.text();
  const text = parseJson3(raw);
  if (!text) throw new TranscriptError("The captions came back empty.", "parse");
  return {
    text,
    language: track.languageCode.split("-")[0],
    kind: track.kind === "asr" ? "auto" : "manual",
    videoTitle: details?.title ?? null,
    author: details?.author ?? null,
  };
}

function pickTrack(tracks: CaptionTrack[], preferred: string[]): CaptionTrack {
  const base = (t: CaptionTrack) => t.languageCode.split("-")[0].toLowerCase();
  for (const lang of preferred) {
    const manual = tracks.find((t) => base(t) === lang && t.kind !== "asr");
    if (manual) return manual;
  }
  for (const lang of preferred) {
    const auto = tracks.find((t) => base(t) === lang);
    if (auto) return auto;
  }
  return tracks.find((t) => t.kind !== "asr") ?? tracks[0];
}

interface Json3 {
  events?: { segs?: { utf8?: string }[]; aAppend?: number }[];
}

/** YouTube's json3 caption format -> plain text, one caption per line. */
export function parseJson3(raw: string): string {
  let data: Json3;
  try {
    data = JSON.parse(raw) as Json3;
  } catch {
    return "";
  }
  const lines: string[] = [];
  for (const ev of data.events ?? []) {
    if (!ev.segs) continue;
    const line = ev.segs
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!line || line === "[Music]" || line === "[Applause]") continue;
    // Auto-captions often repeat the previous line as a rolling window.
    if (lines.length && lines[lines.length - 1] === line) continue;
    lines.push(line);
  }
  return lines.join("\n");
}
