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

// The Android client is the most tolerant of server-side callers.
const CLIENTS = [
  { clientName: "ANDROID", clientVersion: "19.09.37", androidSdkVersion: 30, userAgent: "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip" },
  { clientName: "WEB", clientVersion: "2.20240101.00.00", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" },
];

export async function fetchYouTubeTranscript(videoId: string, preferredLangs: string[] = ["en"]): Promise<TranscriptResult> {
  let player: PlayerResponse | null = null;
  let lastErr: unknown = null;

  for (const client of CLIENTS) {
    try {
      const res = await fetch(INNERTUBE_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": client.userAgent,
          "x-youtube-client-name": client.clientName === "ANDROID" ? "3" : "1",
          "x-youtube-client-version": client.clientVersion,
          "accept-language": "en-US,en;q=0.9",
        },
        body: JSON.stringify({
          context: { client: { clientName: client.clientName, clientVersion: client.clientVersion, ...(client.androidSdkVersion ? { androidSdkVersion: client.androidSdkVersion } : {}), hl: "en", gl: "US" } },
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        lastErr = new Error(`player ${res.status}`);
        continue;
      }
      const json = (await res.json()) as PlayerResponse;
      const status = json.playabilityStatus?.status;
      if (status === "LOGIN_REQUIRED" || /bot|sign in/i.test(json.playabilityStatus?.reason ?? "")) {
        lastErr = new TranscriptError("YouTube asked for a sign-in check.", "blocked");
        continue;
      }
      if (status && status !== "OK") {
        throw new TranscriptError(json.playabilityStatus?.reason || "This video isn't available.", "unavailable");
      }
      player = json;
      if (json.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) break;
    } catch (err) {
      if (err instanceof TranscriptError && err.code === "unavailable") throw err;
      lastErr = err;
    }
  }

  if (!player) {
    if (lastErr instanceof TranscriptError) throw lastErr;
    throw new TranscriptError("Couldn't reach YouTube for this video.", "blocked");
  }

  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (tracks.length === 0) throw new TranscriptError("This video has no captions or transcript.", "no_captions");

  const track = pickTrack(tracks, preferredLangs);
  const url = new URL(track.baseUrl);
  url.searchParams.set("fmt", "json3");

  const capRes = await fetch(url.toString(), { headers: { "user-agent": CLIENTS[0].userAgent }, signal: AbortSignal.timeout(12_000) });
  if (!capRes.ok) throw new TranscriptError("Couldn't download the captions.", "blocked");
  const raw = await capRes.text();
  const text = parseJson3(raw);
  if (!text) throw new TranscriptError("The captions came back empty.", "parse");

  return {
    text,
    language: track.languageCode.split("-")[0],
    kind: track.kind === "asr" ? "auto" : "manual",
    videoTitle: player.videoDetails?.title ?? null,
    author: player.videoDetails?.author ?? null,
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
