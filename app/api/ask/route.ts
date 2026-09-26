import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";
import { searchTestimonies } from "@/lib/search";
import { testimonyPath } from "@/lib/seo";
import type { AskResult, AskSource } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_Q = 300;
const CONTEXT_BUDGET = 48_000; // characters of testimony text sent to the model

const SYSTEM_PROMPT = `You answer visitors' questions about Witness Archive, a collection of first-person testimonies about supernatural experiences (near-death experiences, heaven, hell, healing, angels, divine encounters).

You are given numbered excerpts from testimonies. Answer ONLY from those excerpts. You are describing what people in the archive say they experienced — never asserting what is true about the afterlife or God. Attribute everything: "According to Sarah M.'s testimony…", "One anonymous author describes…". Where testimonies differ, say so plainly.

Rules:
- Cite with bracketed numbers matching the excerpts, e.g. [1], [3], right after the sentence they support. Every paragraph must have at least one citation.
- If the excerpts do not address the question, say so in one or two sentences and do not speculate. Do not use outside knowledge, scripture, or general claims about religion.
- Keep it to 2–4 short paragraphs of plain prose. No headings, no bullet points, no markdown. Warm, calm, matter-of-fact. Do not moralize or preach.
- Never invent details, names, or quotes. Short direct quotes from the excerpts are welcome.
- Answer in the language of the question.`;

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
}

function normalize(q: string): string {
  return q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export async function POST(req: Request) {
  let body: { q?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const question = typeof body.q === "string" ? body.q.trim().slice(0, MAX_Q) : "";
  if (question.length < 3) return NextResponse.json({ error: "Ask a question or type a few words to search." }, { status: 400 });
  const normalized = normalize(question);
  const supabase = createServerSupabase();

  // 1) Cache
  const { data: cached } = await supabase.from("archive_answers").select("answer, sources").eq("normalized", normalized).maybeSingle();
  const hits = await searchTestimonies(question, 8);
  const matches = hits.map((h) => h.testimony);
  if (cached) {
    supabase.rpc("bump_answer_hits", { p_normalized: normalized }).then(() => {});
    const result: AskResult = { question, answer: cached.answer as string, sources: (cached.sources as AskSource[]) ?? [], matches, cached: true, empty: false };
    return NextResponse.json(result);
  }

  // 2) Nothing relevant → say so, no model call
  if (hits.length === 0) {
    const result: AskResult = { question, answer: "", sources: [], matches: [], cached: false, empty: true };
    return NextResponse.json(result);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Search still works without the assistant.
    const result: AskResult = { question, answer: "", sources: [], matches, cached: false, empty: true };
    return NextResponse.json(result);
  }

  // 3) Build numbered context within budget
  const per = Math.floor(CONTEXT_BUDGET / Math.max(1, Math.min(hits.length, 6)));
  const sources: AskSource[] = [];
  const blocks: string[] = [];
  hits.slice(0, 6).forEach((h, i) => {
    const t = h.testimony;
    const n = i + 1;
    const author = t.is_anonymous ? "Anonymous" : t.creator;
    const where = [t.location_city, t.location_country].filter(Boolean).join(", ");
    const meta = [t.category, where, t.experienced_on ? t.experienced_on.slice(0, 4) : null].filter(Boolean).join(" · ");
    const text = (t.content ?? t.description).slice(0, per);
    blocks.push(`[${n}] "${t.title}" — ${author} (${meta})\nHighlights: ${h.headline.replace(/\s+/g, " ")}\nText:\n${text}`);
    sources.push({ n, id: t.id, title: t.title, author, category: t.category, path: testimonyPath(t), snippet: h.headline.replace(/[«»]/g, "").replace(/\s+/g, " ").slice(0, 220) });
  });

  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Question: ${question}\n\nExcerpts:\n\n${blocks.join("\n\n---\n\n")}` }],
      }),
    });
  } catch (err) {
    console.error("ask: fetch failed", err);
    return NextResponse.json({ error: "Couldn't reach the assistant. Try again in a moment." }, { status: 502 });
  }
  const json = (await res.json().catch(() => ({}))) as AnthropicResponse;
  if (!res.ok) {
    console.error("ask: api error", res.status, json.error?.message);
    return NextResponse.json({ error: "The assistant returned an error. Try again in a moment." }, { status: 502 });
  }
  const answer = (json.content ?? []).map((c) => c.text ?? "").join("").trim();
  if (!answer) return NextResponse.json({ error: "No answer came back. Try again." }, { status: 502 });

  // Keep only sources the answer actually cites (plus none if it cited nothing).
  const citedNs = new Set([...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  const usedSources = sources.filter((s) => citedNs.has(s.n));

  // 4) Cache (best effort, server-side only)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (serviceKey && url) {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    admin.from("archive_answers").upsert({ question, normalized, answer, sources: usedSources, model }, { onConflict: "normalized" }).then(({ error }) => {
      if (error) console.error("ask: cache save failed", error.message);
    });
  }

  const result: AskResult = { question, answer, sources: usedSources, matches, cached: false, empty: false };
  return NextResponse.json(result);
}
