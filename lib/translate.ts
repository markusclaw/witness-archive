import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { languageByCode } from "@/lib/languages";
import type { Testimony, Translation } from "@/lib/types";

/** Public read of a cached translation (anon client, RLS allows published only). */
export async function getTranslation(testimonyId: string, language: string): Promise<Translation | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("testimony_translations")
    .select("*")
    .eq("testimony_id", testimonyId)
    .eq("language", language)
    .maybeSingle();
  if (error) {
    console.error("getTranslation:", error.message);
    return null;
  }
  return (data as Translation | null) ?? null;
}

/** Which languages already have a cached translation for this testimony. */
export async function getAvailableTranslations(testimonyId: string): Promise<string[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase.from("testimony_translations").select("language").eq("testimony_id", testimonyId);
  return (data ?? []).map((r) => r.language as string);
}

const SYSTEM_PROMPT = `You are a faithful literary translator for Witness Archive, a collection of first-person testimonies about profound personal and spiritual experiences.

Translate the testimony into the requested language. Preserve the author's meaning, voice, register, chronology, names, and every detail exactly. Keep first person. Keep paragraph breaks (blank lines between paragraphs). Do not summarize, soften, strengthen, explain, or add anything. Do not translate proper names of people or places unless they have a standard form in the target language. Keep scripture references in the target language's conventional form.

Respond in exactly this format and nothing else:

<title>
translated title
</title>
<description>
translated one-line description
</description>
<content>
translated full text
</content>`;

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
}

/**
 * Generate and cache a translation. Uses the service-role key to write the
 * cache row (RLS blocks anonymous writes), so this only ever runs on the server.
 */
export async function createTranslation(testimony: Testimony, language: string): Promise<Translation | null> {
  const lang = languageByCode(language);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!lang || !apiKey || !serviceKey || !url) {
    console.error("createTranslation: missing configuration", { lang: !!lang, apiKey: !!apiKey, serviceKey: !!serviceKey });
    return null;
  }
  if (testimony.status !== "published") return null;

  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  const source = languageByCode(testimony.language)?.name ?? testimony.language;
  const userMessage = `Translate from ${source} into ${lang.name} (${lang.code}).\n\n<testimony>\n<title>${testimony.title}</title>\n<description>${testimony.description}</description>\n<content>\n${testimony.content ?? ""}\n</content>\n</testimony>`;

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 24_000, temperature: 0, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userMessage }] }),
    });
  } catch (err) {
    console.error("createTranslation: fetch failed", err);
    return null;
  }
  const json = (await res.json().catch(() => ({}))) as AnthropicResponse;
  if (!res.ok) {
    console.error("createTranslation: api error", res.status, json.error?.message);
    return null;
  }
  const text = (json.content ?? []).map((c) => c.text ?? "").join("");
  const pick = (tag: string) => text.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*<\\/${tag}>`, "i"))?.[1]?.trim() ?? "";
  const title = pick("title");
  const description = pick("description");
  const content = pick("content");
  if (!title || (!content && testimony.content)) {
    console.error("createTranslation: unparseable response", text.slice(0, 200));
    return null;
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const row = { testimony_id: testimony.id, language: lang.code, title, description, content: content || null, source: "machine", model, updated_at: new Date().toISOString() };
  const { data, error } = await admin.from("testimony_translations").upsert(row, { onConflict: "testimony_id,language" }).select("*").single();
  if (error) {
    console.error("createTranslation: save failed", error.message);
    return null;
  }
  return data as Translation;
}
