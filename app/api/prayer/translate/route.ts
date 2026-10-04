import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminSupabase } from "@/lib/supabase-admin";
import { contentHash } from "@/lib/chunks";
import { LANGUAGES, isSupportedLanguage } from "@/lib/languages";

export const dynamic = "force-dynamic";

type RequestText = { title: string; body: string; answer?: string | null };
type ReplyText = { content: string };

const SYSTEM = `You translate short posts from a Christian prayer wall. Keep the meaning, warmth and register exactly; keep first person; keep names, scripture references and line breaks. Do not add, soften or explain anything. Respond with only JSON in the same shape you were given, with every string translated.`;

async function translateJson(payload: Record<string, string>, to: string): Promise<Record<string, string> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const target = LANGUAGES.find((l) => l.code === to)?.name ?? to;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 4000, temperature: 0, system: SYSTEM, messages: [{ role: "user", content: `Translate into ${target} (${to}):\n${JSON.stringify(payload)}` }] }),
    });
    const json = (await res.json().catch(() => ({}))) as { content?: { text?: string }[]; error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message ?? String(res.status));
    const raw = (json.content ?? []).map((c) => c.text ?? "").join("");
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("unparseable");
    const out = JSON.parse(m[0]) as Record<string, unknown>;
    const clean: Record<string, string> = {};
    for (const k of Object.keys(payload)) if (typeof out[k] === "string") clean[k] = out[k] as string;
    return Object.keys(clean).length === Object.keys(payload).length ? clean : null;
  } catch (err) {
    console.error("prayer translate:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * GET ?kind=request|reply&id=&to=xx → the post's text in `to`, translating
 * and caching on first request. Public rows only (RLS on the source tables).
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const kind = u.searchParams.get("kind") === "reply" ? "reply" : "request";
  const id = u.searchParams.get("id") ?? "";
  const to = (u.searchParams.get("to") ?? "").toLowerCase();
  if (!id || !isSupportedLanguage(to)) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const supabase = createServerSupabase();
  let source: Record<string, string>;
  let sourceLanguage: string;
  if (kind === "request") {
    const { data } = await supabase.from("prayer_requests").select("title, body, answer, language, review").eq("id", id).maybeSingle();
    if (!data || data.review !== "clear") return NextResponse.json({ error: "Not found." }, { status: 404 });
    source = { title: data.title, body: data.body, ...(data.answer ? { answer: data.answer } : {}) };
    sourceLanguage = data.language;
  } else {
    const { data } = await supabase.from("prayer_replies").select("content, review, request_id").eq("id", id).maybeSingle();
    if (!data || data.review !== "clear") return NextResponse.json({ error: "Not found." }, { status: 404 });
    source = { content: data.content };
    sourceLanguage = "";
  }
  if (sourceLanguage === to) return NextResponse.json({ text: source, from: sourceLanguage, cached: true });

  const hash = contentHash(JSON.stringify(source));
  const { data: cached } = await supabase.from("prayer_translations").select("text, source_hash").eq("kind", kind).eq("target_id", id).eq("language", to).maybeSingle();
  if (cached && cached.source_hash === hash) return NextResponse.json({ text: cached.text as RequestText | ReplyText, from: sourceLanguage, cached: true }, { headers: { "cache-control": "public, max-age=300" } });

  const translated = await translateJson(source, to);
  if (!translated) return NextResponse.json({ error: "Translation isn't available right now." }, { status: 503 });
  const admin = createAdminSupabase();
  if (admin) await admin.from("prayer_translations").upsert({ kind, target_id: id, language: to, source_hash: hash, text: translated }, { onConflict: "kind,target_id,language" });
  return NextResponse.json({ text: translated, from: sourceLanguage, cached: false });
}
