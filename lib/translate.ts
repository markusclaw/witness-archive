import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { languageByCode } from "@/lib/languages";
import type { Testimony, Translation, TranslationJob } from "@/lib/types";

/** Public read of a finished, cached translation (anon client, RLS allows published only). */
export async function getTranslation(testimonyId: string, language: string): Promise<Translation | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("testimony_translations")
    .select("*")
    .eq("testimony_id", testimonyId)
    .eq("language", language)
    .eq("status", "ready")
    .maybeSingle();
  if (error) {
    console.error("getTranslation:", error.message);
    return null;
  }
  return (data as Translation | null) ?? null;
}

/** The row in whatever state it is in — ready, pending, or failed. */
export async function getTranslationState(testimonyId: string, language: string): Promise<Translation | TranslationJob | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("testimony_translations")
    .select("*")
    .eq("testimony_id", testimonyId)
    .eq("language", language)
    .maybeSingle();
  if (error) {
    console.error("getTranslationState:", error.message);
    return null;
  }
  if (!data) return null;
  if (data.status === "ready") return data as Translation;
  return { status: data.status, progress_done: data.progress_done ?? 0, progress_total: data.progress_total ?? 0, error: data.error ?? null };
}

/** Which languages already have a finished translation for this testimony. */
export async function getAvailableTranslations(testimonyId: string): Promise<string[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("testimony_translations").select("language").eq("testimony_id", testimonyId).eq("status", "ready");
  return (data ?? []).map((r) => r.language as string);
}

const SYSTEM_PROMPT = `You are a faithful literary translator for Witness Archive, a collection of first-person testimonies about profound personal and spiritual experiences.

Translate the testimony into the requested language. Preserve the author's meaning, voice, register, chronology, names, and every detail exactly. Keep first person. Keep paragraph breaks (blank lines between paragraphs). Do not summarize, soften, strengthen, explain, or add anything. Do not translate proper names of people or places unless they have a standard form in the target language. Keep scripture references in the target language's conventional form.

Long testimonies arrive in numbered parts; each part is a run of consecutive paragraphs and may begin or end mid-thought. Translate only the part you are given, keeping it exactly the same number of paragraphs, so the parts join back together seamlessly.

Respond in exactly the format requested and nothing else.`;

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
}

/** Roughly how many words go into one translation call. */
const CHUNK_WORDS = 600;

/** Split content into runs of whole paragraphs of about CHUNK_WORDS each. */
export function chunkParagraphs(content: string, target = CHUNK_WORDS): string[] {
  const paragraphs = content.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current: string[] = [];
  let words = 0;
  for (const p of paragraphs) {
    const n = p.split(/\s+/).length;
    if (current.length && words + n > target) {
      chunks.push(current.join("\n\n"));
      current = [];
      words = 0;
    }
    current.push(p);
    words += n;
  }
  if (current.length) chunks.push(current.join("\n\n"));
  return chunks;
}

async function callClaude(apiKey: string, model: string, userMessage: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userMessage }] }),
  });
  const json = (await res.json().catch(() => ({}))) as AnthropicResponse;
  if (!res.ok) throw new Error(`Claude ${res.status}: ${json.error?.message ?? "unknown error"}`);
  return (json.content ?? []).map((c) => c.text ?? "").join("");
}

const pick = (text: string, tag: string) => text.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*<\\/${tag}>`, "i"))?.[1]?.trim() ?? "";

function adminClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** How long one step may hold the row before another request may take over. */
const LOCK_MS = 90 * 1000;

/**
 * Advance a translation by exactly one step and return its state.
 *
 * Cloudflare Workers can't keep working after they reply, so instead of a
 * background job the page drives the work: every call translates one chunk
 * (title + description first, then the body in runs of whole paragraphs),
 * saves it, and returns progress. The page calls again until it's ready.
 * A short lock on the row means two visitors never translate the same chunk.
 */
export async function advanceTranslation(testimony: Testimony, language: string): Promise<Translation | TranslationJob | null> {
  const lang = languageByCode(language);
  const admin = adminClient();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!lang || !admin || !apiKey) {
    console.error("advanceTranslation: missing configuration", { lang: !!lang, admin: !!admin, apiKey: !!apiKey });
    return null;
  }
  if (testimony.status !== "published") return null;

  const key = { testimony_id: testimony.id, language: lang.code };
  const chunks = chunkParagraphs(testimony.content ?? "");
  const total = chunks.length + 1;

  let { data: row } = await admin.from("testimony_translations").select("*").match(key).maybeSingle();
  if (row?.status === "ready") return row as Translation;

  // A failed job whose chunking still matches resumes from its last saved part.
  if (row?.status === "failed" && row.progress_total === total) {
    const { data } = await admin
      .from("testimony_translations")
      .update({ status: "pending", error: null, lock_until: null, updated_at: new Date().toISOString() })
      .match(key)
      .select("*")
      .single();
    if (data) row = data;
  }
  // Start over when there is no usable job, or the chunking no longer matches
  // the current text (the author edited it).
  if (!row || row.status !== "pending" || row.progress_total !== total) {
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("testimony_translations")
      .upsert(
        { ...key, title: testimony.title, description: testimony.description, content: null, source: "machine", status: "pending", progress_done: 0, progress_total: total, parts: [], started_at: now, lock_until: null, error: null, updated_at: now },
        { onConflict: "testimony_id,language" },
      )
      .select("*")
      .single();
    if (error || !data) {
      console.error("advanceTranslation: could not start", error?.message);
      return null;
    }
    row = data;
  }

  // Take the lock for one step. If another request holds it, just report progress.
  const nowMs = Date.now();
  const { data: locked } = await admin
    .from("testimony_translations")
    .update({ lock_until: new Date(nowMs + LOCK_MS).toISOString() })
    .match(key)
    .eq("status", "pending")
    .or(`lock_until.is.null,lock_until.lt.${new Date(nowMs).toISOString()}`)
    .select("*")
    .maybeSingle();
  if (!locked) return { status: "pending", progress_done: row.progress_done, progress_total: row.progress_total, working: false };

  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  const source = languageByCode(testimony.language)?.name ?? testimony.language;
  const done: number = locked.progress_done;
  const parts: string[] = Array.isArray(locked.parts) ? locked.parts : [];

  try {
    if (done === 0) {
      const head = await callClaude(
        apiKey,
        model,
        `Translate from ${source} into ${lang.name} (${lang.code}).\n\n<title>${testimony.title}</title>\n<description>${testimony.description}</description>\n\nRespond as:\n<title>\ntranslated title\n</title>\n<description>\ntranslated description\n</description>`,
        2_000,
      );
      const title = pick(head, "title");
      if (!title) throw new Error("unparseable title response");
      await admin.from("testimony_translations").update({ title, description: pick(head, "description"), model, progress_done: 1, lock_until: null, updated_at: new Date().toISOString() }).match(key);
      return { status: "pending", progress_done: 1, progress_total: total, working: true };
    }

    const i = done - 1;
    const text = await callClaude(
      apiKey,
      model,
      `Translate from ${source} into ${lang.name} (${lang.code}). This is part ${i + 1} of ${chunks.length}.\n\n<part>\n${chunks[i]}\n</part>\n\nRespond as:\n<part>\ntranslated part\n</part>`,
      6_000,
    );
    const translated = pick(text, "part");
    if (!translated) throw new Error(`unparseable response for part ${i + 1}`);
    const nextParts = [...parts.slice(0, i), translated];
    const finished = i + 1 >= chunks.length;
    const patch = finished
      ? { parts: nextParts, content: nextParts.join("\n\n"), status: "ready", progress_done: total, lock_until: null, error: null, updated_at: new Date().toISOString() }
      : { parts: nextParts, progress_done: done + 1, lock_until: null, updated_at: new Date().toISOString() };
    const { data: saved, error } = await admin.from("testimony_translations").update(patch).match(key).select("*").single();
    if (error || !saved) throw new Error(`save failed: ${error?.message}`);
    if (finished) return saved as Translation;
    return { status: "pending", progress_done: done + 1, progress_total: total, working: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("advanceTranslation:", testimony.id, lang.code, message);
    await admin.from("testimony_translations").update({ status: "failed", error: message.slice(0, 500), lock_until: null, updated_at: new Date().toISOString() }).match(key);
    return { status: "failed", progress_done: done, progress_total: total, error: message };
  }
}
