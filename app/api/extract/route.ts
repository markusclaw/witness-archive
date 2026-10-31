import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { ClaudeError } from "@/lib/ai/claude";
import { extractDetails } from "@/lib/ai/extract";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "The assistant is not configured on this server." }, { status: 503 });

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Sign in to use the assistant." }, { status: 401 });
  const {
    data: { user },
  } = await createServerSupabase().auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });

  let body: { content?: unknown; title?: unknown; video?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const v = (body.video && typeof body.video === "object" ? body.video : {}) as { title?: unknown; channel?: unknown; publishedAt?: unknown; description?: unknown };
  const s = (x: unknown) => (typeof x === "string" ? x : null);
  if (content.length < 200) return NextResponse.json({ error: "Write a little more first — a few paragraphs helps the assistant find the details." }, { status: 400 });

  try {
    const details = await extractDetails(content, { title, video: { title: s(v.title), channel: s(v.channel), publishedAt: s(v.publishedAt), description: s(v.description) } });
    return NextResponse.json(details);
  } catch (err) {
    console.error("extract:", err instanceof Error ? err.message : err);
    if (err instanceof ClaudeError && err.kind === "unparseable") return NextResponse.json({ error: "The assistant's reply couldn't be read. Try again." }, { status: 502 });
    if (err instanceof ClaudeError && err.kind === "network") return NextResponse.json({ error: "Couldn't reach the assistant. Try again in a moment." }, { status: 502 });
    return NextResponse.json({ error: "The assistant returned an error. Try again in a moment." }, { status: 502 });
  }
}
