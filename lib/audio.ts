import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase-server";
import { chunkParagraphsByChars, contentHash } from "@/lib/chunks";
import { getTranslation } from "@/lib/translate";
import type { Testimony } from "@/lib/types";

/**
 * Narrated audio: one MP3 per testimony per language, generated once with a
 * neural voice (Google Cloud Text-to-Speech) and kept in the public `audio`
 * bucket. Like translations, generation advances one chunk per request so no
 * single Worker invocation runs long: each step synthesizes one ~3,500-char
 * run of paragraphs and uploads it; the last step stitches the segments.
 */

export interface AudioReady {
  status: "ready";
  url: string;
  duration_s: number | null;
  voice: string | null;
}
export interface AudioJob {
  status: "pending" | "failed" | "waiting_translation";
  progress_done: number;
  progress_total: number;
  working?: boolean;
  error?: string | null;
}

const BUCKET = "audio";
const LOCK_MS = 60 * 1000;
/** Google caps a request at 5,000 bytes; leave room for multi-byte characters. */
const CHUNK_CHARS = 3200;
/** Google's MP3 output is 32 kbit/s; used to estimate duration without decoding. */
const MP3_BITRATE = 32_000;

/** Voice per language. Override with GOOGLE_TTS_VOICE_<LANG> (e.g. GOOGLE_TTS_VOICE_ES=es-US-Chirp3-HD-Kore). */
const VOICES: Record<string, { languageCode: string; names: string[] }> = {
  en: { languageCode: "en-US", names: ["en-US-Chirp3-HD-Charon", "en-US-Neural2-D", "en-US-Standard-D"] },
  es: { languageCode: "es-US", names: ["es-US-Chirp3-HD-Charon", "es-US-Neural2-B", "es-US-Standard-B"] },
  pt: { languageCode: "pt-BR", names: ["pt-BR-Chirp3-HD-Charon", "pt-BR-Neural2-B", "pt-BR-Standard-B"] },
};

function voicesFor(lang: string): { languageCode: string; names: string[] } | null {
  const base = VOICES[lang];
  if (!base) return null;
  const override = process.env[`GOOGLE_TTS_VOICE_${lang.toUpperCase()}`];
  return override ? { languageCode: base.languageCode, names: [override, ...base.names] } : base;
}

function publicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** Finished audio for a testimony in a language, or null. Anon read; RLS limits it to published testimonies. */
export async function getAudio(testimonyId: string, language: string): Promise<AudioReady | null> {
  const { data } = await createServerSupabase()
    .from("testimony_audio")
    .select("path, duration_s, voice, status")
    .eq("testimony_id", testimonyId)
    .eq("language", language)
    .eq("status", "ready")
    .maybeSingle();
  if (!data?.path) return null;
  return { status: "ready", url: publicUrl(data.path), duration_s: data.duration_s ?? null, voice: data.voice ?? null };
}

export async function getAudioState(testimonyId: string, language: string): Promise<AudioReady | AudioJob | null> {
  const { data } = await createServerSupabase().from("testimony_audio").select("*").eq("testimony_id", testimonyId).eq("language", language).maybeSingle();
  if (!data) return null;
  if (data.status === "ready" && data.path) return { status: "ready", url: publicUrl(data.path), duration_s: data.duration_s ?? null, voice: data.voice ?? null };
  return { status: data.status, progress_done: data.progress_done ?? 0, progress_total: data.progress_total ?? 0, error: data.error ?? null };
}

/** The text to narrate in a language: the original, or its finished translation. */
async function narrationText(testimony: Testimony, language: string): Promise<{ title: string; content: string } | null> {
  if (language === testimony.language) return { title: testimony.title, content: testimony.content ?? "" };
  const tr = await getTranslation(testimony.id, language);
  if (!tr) return null;
  return { title: tr.title, content: tr.content ?? "" };
}

interface GoogleTtsResponse {
  audioContent?: string;
  error?: { message?: string; status?: string };
}

/** Synthesize one chunk, trying the preferred voices in order (a voice may not exist in every region/project yet). */
async function synthesize(apiKey: string, lang: string, text: string, preferred: string | null): Promise<{ bytes: Uint8Array; voice: string }> {
  const v = voicesFor(lang);
  if (!v) throw new Error(`no voice configured for ${lang}`);
  const names = preferred ? [preferred, ...v.names.filter((n) => n !== preferred)] : v.names;
  let lastError = "";
  for (const name of names) {
    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: v.languageCode, name },
        audioConfig: { audioEncoding: "MP3", speakingRate: 0.97, sampleRateHertz: 24000 },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as GoogleTtsResponse;
    if (res.ok && json.audioContent) {
      const bin = atob(json.audioContent);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { bytes, voice: name };
    }
    lastError = `${res.status} ${json.error?.message ?? ""}`.trim();
    // Only a missing/unsupported voice should fall through to the next candidate.
    if (res.status !== 400 && res.status !== 404) break;
  }
  throw new Error(`Text-to-Speech failed: ${lastError}`);
}

async function upload(admin: SupabaseClient, path: string, bytes: Uint8Array) {
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "audio/mpeg", upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`upload failed: ${error.message}`);
}

async function download(admin: SupabaseClient, path: string): Promise<Uint8Array> {
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`download failed: ${error?.message}`);
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * Advance the narration of a testimony in a language by one step.
 * Returns the finished audio, the job's progress, `waiting_translation` when
 * the language's translation isn't ready yet, or null when not configured.
 */
export async function advanceAudio(testimony: Testimony, language: string): Promise<AudioReady | AudioJob | null> {
  const admin = createAdminSupabase();
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!admin || !apiKey || !voicesFor(language)) {
    console.error("advanceAudio: missing configuration", { admin: !!admin, apiKey: !!apiKey, lang: language });
    return null;
  }
  if (testimony.status !== "published") return null;

  const text = await narrationText(testimony, language);
  if (!text) return { status: "waiting_translation", progress_done: 0, progress_total: 0 };
  const full = `${text.title}.\n\n${text.content}`.trim();
  if (full.length < 20) return null;
  const chunks = chunkParagraphsByChars(full, CHUNK_CHARS);
  const total = chunks.length + 1; // +1 for the stitch step
  const hash = contentHash(full);
  const key = { testimony_id: testimony.id, language };

  let { data: row } = await admin.from("testimony_audio").select("*").match(key).maybeSingle();
  if (row?.status === "ready" && row.source_hash === hash && row.path) {
    return { status: "ready", url: publicUrl(row.path), duration_s: row.duration_s ?? null, voice: row.voice ?? null };
  }

  // Resume a failed job for the same text; otherwise (re)start.
  if (row?.status === "failed" && row.source_hash === hash && row.progress_total === total) {
    const { data } = await admin.from("testimony_audio").update({ status: "pending", error: null, lock_until: null, updated_at: new Date().toISOString() }).match(key).select("*").single();
    if (data) row = data;
  }
  if (!row || row.status !== "pending" || row.source_hash !== hash || row.progress_total !== total) {
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("testimony_audio")
      .upsert({ ...key, status: "pending", source_hash: hash, progress_done: 0, progress_total: total, parts: [], path: null, bytes: null, duration_s: null, lock_until: null, error: null, updated_at: now }, { onConflict: "testimony_id,language" })
      .select("*")
      .single();
    if (error || !data) {
      console.error("advanceAudio: could not start", error?.message);
      return null;
    }
    row = data;
  }

  const nowMs = Date.now();
  const { data: locked } = await admin
    .from("testimony_audio")
    .update({ lock_until: new Date(nowMs + LOCK_MS).toISOString() })
    .match(key)
    .eq("status", "pending")
    .or(`lock_until.is.null,lock_until.lt.${new Date(nowMs).toISOString()}`)
    .select("*")
    .maybeSingle();
  if (!locked) return { status: "pending", progress_done: row.progress_done, progress_total: row.progress_total, working: false };

  const done: number = locked.progress_done;
  const parts: string[] = Array.isArray(locked.parts) ? locked.parts : [];
  const dir = `${testimony.id}/${language}`;

  try {
    if (done < chunks.length) {
      const { bytes, voice } = await synthesize(apiKey, language, chunks[done], locked.voice ?? null);
      const path = `${dir}/part-${String(done).padStart(2, "0")}-${hash}.mp3`;
      await upload(admin, path, bytes);
      const nextParts = [...parts.slice(0, done), path];
      await admin.from("testimony_audio").update({ parts: nextParts, voice, progress_done: done + 1, lock_until: null, updated_at: new Date().toISOString() }).match(key);
      return { status: "pending", progress_done: done + 1, progress_total: total, working: true };
    }

    // Stitch. MP3 frames are self-delimiting, so same-settings segments concatenate cleanly.
    const buffers = await Promise.all(parts.map((p) => download(admin, p)));
    const size = buffers.reduce((n, b) => n + b.length, 0);
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const b of buffers) {
      joined.set(b, offset);
      offset += b.length;
    }
    const finalPath = `${dir}/${hash}.mp3`;
    await upload(admin, finalPath, joined);
    const duration = Math.round((size * 8) / MP3_BITRATE);
    const { data: saved, error } = await admin
      .from("testimony_audio")
      .update({ status: "ready", path: finalPath, bytes: size, duration_s: duration, progress_done: total, lock_until: null, error: null, updated_at: new Date().toISOString() })
      .match(key)
      .select("*")
      .single();
    if (error || !saved) throw new Error(`save failed: ${error?.message}`);
    // Segments are no longer needed.
    await admin.storage.from(BUCKET).remove(parts).catch(() => undefined);
    return { status: "ready", url: publicUrl(finalPath), duration_s: duration, voice: saved.voice ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("advanceAudio:", testimony.id, language, message);
    await admin.from("testimony_audio").update({ status: "failed", error: message.slice(0, 500), lock_until: null, updated_at: new Date().toISOString() }).match(key);
    return { status: "failed", progress_done: done, progress_total: total, error: message };
  }
}
