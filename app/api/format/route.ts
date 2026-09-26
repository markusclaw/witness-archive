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
- remove leftover video-transcript artifacts: timestamps such as "0:1515 seconds" or "[1:02]", caption cue numbers, and line breaks that fall mid-sentence (join them back into sentences)
- normalize quotation marks and capitalization

You MUST NOT:
- add, remove, soften, strengthen, or reinterpret any detail, claim, or emotion
- summarize, shorten for length, or "improve" the story
- change first person to third person, or alter the author's tone or dialect
- add headings, titles, bullet points, markdown, or commentary inside the text
- invent transitions or sentences that were not there

If a passage is unclear and you cannot fix it without guessing at the meaning, leave it as written and mention it in a note instead.

Respond in exactly this format and nothing else:

<formatted>
the full edited text, with blank lines between paragraphs
</formatted>
<notes>
- one short, warm, specific observation or suggestion for the author
- another, if needed
</notes>

Notes are optional and should be few (0–4); leave the notes block empty if there is nothing worth saying. They are for things you deliberately did not change: a passage that might read clearer if the author restructured it, an ambiguity only they can resolve, or a place where the timeline was hard to follow. Never be critical of the experience itself.`;

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
        max_tokens: 24_000,
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
  const f = text.match(/<formatted>\s*([\s\S]*?)\s*<\/formatted>/i);
  if (!f || !f[1].trim()) return null;
  const n = text.match(/<notes>\s*([\s\S]*?)\s*<\/notes>/i);
  const notes = n
    ? n[1]
        .split(/\n/)
        .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];
  return { formatted: f[1].trim(), notes };
}

function normalize(s: string) {
  return s.replace(/\s+/g, " ").trim();
}
