import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { ClaudeError } from "@/lib/ai/claude";
import { FORMAT_MAX_CHARS, formatText, normalizeSpace } from "@/lib/ai/format";
import type { FormatSuggestion } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
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
  if (content.length > FORMAT_MAX_CHARS) return NextResponse.json({ error: `That's longer than the assistant can handle in one pass (${FORMAT_MAX_CHARS.toLocaleString()} characters). Consider splitting it into parts.` }, { status: 413 });

  try {
    const parsed = await formatText(content);
    const suggestion: FormatSuggestion = { formatted: parsed.formatted, notes: parsed.notes, changed: normalizeSpace(parsed.formatted) !== normalizeSpace(content) };
    return NextResponse.json(suggestion);
  } catch (err) {
    console.error("format:", err instanceof Error ? err.message : err);
    if (err instanceof ClaudeError && err.kind === "unparseable") return NextResponse.json({ error: "The assistant's reply couldn't be read. Try again." }, { status: 502 });
    if (err instanceof ClaudeError && err.kind === "network") return NextResponse.json({ error: "Couldn't reach the formatting assistant. Try again in a moment." }, { status: 502 });
    return NextResponse.json({ error: "The formatting assistant returned an error. Try again in a moment." }, { status: 502 });
  }
}
