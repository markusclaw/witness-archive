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
const CHUNK_WORDS = 900;

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

/** A pending job older than this is treated as abandoned and restarted. */
const STALE_MS = 10 * 60 * 1000;

/**
 * Make sure a translation exists or is being generated. Returns the finished
 * translation when cached, the job's progress when it is running, or null
 * when translation is not configured. The work itself runs after the response
 * is sent (see `runInBackground`), so this returns within a second even for a
 * very long testimony.
 */
export async function ensureTranslation(
  testimony: Testimony,
  language: string,
  runInBackground: (work: Promise<unknown>) => void,
): Promise<Translation | TranslationJob | null> {
  const lang = languageByCode(language);
  const admin = adminClient();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!lang || !admin || !apiKey) {
    console.error("ensureTranslation: missing configuration", { lang: !!lang, admin: !!admin, apiKey: !!apiKey });
    return null;
  }
  if (testimony.status !== "published") return null;

  const { data: existing } = await admin
    .from("testimony_translations")
    .select("*")
    .eq("testimony_id", testimony.id)
    .eq("language", lang.code)
    .maybeSingle();

  if (existing?.status === "ready") return existing as Translation;
  if (existing?.status === "pending") {
    const age = Date.now() - new Date(existing.started_at ?? existing.updated_at).getTime();
    if (age < STALE_MS) return { status: "pending", progress_done: existing.progress_done, progress_total: existing.progress_total };
  }
  // failed, stale, or brand new → (re)start
  const chunks = chunkParagraphs(testimony.content ?? "");
  const total = chunks.length + 1; // +1 for title & description
  const now = new Date().toISOString();
  const { error } = await admin.from("testimony_translations").upsert(
    {
      testimony_id: testimony.id,
      language: lang.code,
      title: testimony.title,
      description: testimony.description,
      content: null,
      source: "machine",
      status: "pending",
      progress_done: 0,
      progress_total: total,
      started_at: now,
      error: null,
      updated_at: now,
    },
    { onConflict: "testimony_id,language" },
  );
  if (error) {
    console.error("ensureTranslation: could not start job", error.message);
    return null;
  }
  runInBackground(translateJob(admin, apiKey, testimony, lang.code, lang.name, chunks));
  return { status: "pending", progress_done: 0, progress_total: total };
}

async function translateJob(admin: SupabaseClient, apiKey: string, testimony: Testimony, code: string, langName: string, chunks: string[]) {
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  const source = languageByCode(testimony.language)?.name ?? testimony.language;
  const key = { testimony_id: testimony.id, language: code };
  const progress = async (done: number) => {
    await admin.from("testimony_translations").update({ progress_done: done, updated_at: new Date().toISOString() }).match(key);
  };

  try {
    // 1. Title and description
    const head = await callClaude(
      apiKey,
      model,
      `Translate from ${source} into ${langName} (${code}).\n\n<title>${testimony.title}</title>\n<description>${testimony.description}</description>\n\nRespond as:\n<title>\ntranslated title\n</title>\n<description>\ntranslated description\n</description>`,
      2_000,
    );
    const title = pick(head, "title");
    const description = pick(head, "description");
    if (!title) throw new Error("unparseable title response");
    await progress(1);

    // 2. Body, one chunk at a time, in order
    const parts: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const text = await callClaude(
        apiKey,
        model,
        `Translate from ${source} into ${langName} (${code}). This is part ${i + 1} of ${chunks.length}.\n\n<part>\n${chunks[i]}\n</part>\n\nRespond as:\n<part>\ntranslated part\n</part>`,
        8_000,
      );
      const translated = pick(text, "part");
      if (!translated) throw new Error(`unparseable response for part ${i + 1}`);
      parts.push(translated);
      await progress(i + 2);
    }

    const { error } = await admin
      .from("testimony_translations")
      .update({
        title,
        description,
        content: parts.length ? parts.join("\n\n") : null,
        model,
        status: "ready",
        progress_done: chunks.length + 1,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .match(key);
    if (error) throw new Error(`save failed: ${error.message}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("translateJob:", testimony.id, code, message);
    await admin.from("testimony_translations").update({ status: "failed", error: message.slice(0, 500), updated_at: new Date().toISOString() }).match(key);
  }
}
