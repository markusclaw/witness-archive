import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import type { FormatSuggestion } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_CHARS = 60_000;

const SYSTEM_PROMPT = `You are a careful copy editor for Witness Archive, a collection of first-person testimonies about profound personal and spiritual experiences.

Your only job is to improve READABILITY of the text you are given. You must preserve the author's meaning, voice, facts, chronology, names, and every claim exactly as written.

You MAY:
- fix spelling, punctuation, and grammar
- break wall-of-text into paragraphs at natural pauses (separate paragraphs with a blank line)
- untangle a run-on sentence when the meaning is unambiguous
- remove accidental duplicated words or transcription artifacts ("um", "uh", repeated phrases)
- normalize quotation marks and capitalization

You MUST NOT:
- add, remove, soften, strengthen, or reinterpret any detail, claim, or emotion
- summarize, shorten for length, or "improve" the story
- change first person to third person, or alter the author's tone or dialect
- add headings, titles, bullet points, markdown, or commentary inside the text
- invent transitions or sentences that were not there

If a passage is unclear and you cannot fix it without guessing at the meaning, leave it as written and mention it in a note instead.

Respond with ONLY a JSON object, no prose before or after, in this exact shape:
{"formatted": "<the full edited text>", "notes": ["<short, warm, specific observation or suggestion for the author>", ...]}

Notes are optional and should be few (0–4). They are for things you deliberately did not change: a passage that might read clearer if the author restructured it, an ambiguity only they can resolve, or a place where the timeline was hard to follow. Never be critical of the experience itself.`;

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "The formatting assistant is not configured on this server." }, { status: 503 });
  }

  // Require a signed-in member: the client sends its Supabase access token.
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Sign in to use the formatting assistant." }, { status: 401 });
  const {
    data: { user },
    error: userError,
  } = await createServerSupabase().auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });

  let body: { content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (content.length < 40) return NextResponse.json({ error: "Write a little more first — at least a few sentences." }, { status: 400 });
  if (content.length > MAX_CHARS) return NextResponse.json({ error: `That's longer than the assistant can handle in one pass (${MAX_CHARS.toLocaleString()} characters). Consider splitting it into parts.` }, { status: 413 });

  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 16_000,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Here is the testimony text:\n\n<testimony>\n${content}\n</testimony>` }],
      }),
    });
  } catch (err) {
    console.error("format: fetch failed", err);
    return NextResponse.json({ error: "Couldn't reach the formatting assistant. Try again in a moment." }, { status: 502 });
  }

  const json = (await res.json().catch(() => ({}))) as AnthropicResponse;
  if (!res.ok) {
    console.error("format: api error", res.status, json.error?.message);
    return NextResponse.json({ error: "The formatting assistant returned an error. Try again in a moment." }, { status: 502 });
  }

  const text = (json.content ?? []).map((c) => c.text ?? "").join("");
  const parsed = parseSuggestion(text);
  if (!parsed) {
    console.error("format: unparseable response", text.slice(0, 200));
    return NextResponse.json({ error: "The assistant's reply couldn't be read. Try again." }, { status: 502 });
  }

  const suggestion: FormatSuggestion = {
    formatted: parsed.formatted,
    notes: parsed.notes,
    changed: normalize(parsed.formatted) !== normalize(content),
  };
  return NextResponse.json(suggestion);
}

function parseSuggestion(text: string): { formatted: string; notes: string[] } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as { formatted?: unknown; notes?: unknown };
    if (typeof obj.formatted !== "string" || !obj.formatted.trim()) return null;
    const notes = Array.isArray(obj.notes) ? obj.notes.filter((n): n is string => typeof n === "string" && n.trim().length > 0).slice(0, 6) : [];
    return { formatted: obj.formatted.trim(), notes };
  } catch {
    return null;
  }
}

function normalize(s: string) {
  return s.replace(/\s+/g, " ").trim();
}
