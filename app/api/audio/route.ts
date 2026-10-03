import { NextResponse } from "next/server";
import { isSupportedLanguage } from "@/lib/languages";
import { getTestimonyById } from "@/lib/queries";
import { advanceAudio, getAudioState } from "@/lib/audio";

export const dynamic = "force-dynamic";

/**
 * POST { id, language } → the narrated audio (200), or — after synthesizing
 * one more segment — the job's progress (202). Bounded by (published
 * testimonies × languages) and cached forever.
 */
export async function POST(req: Request) {
  let body: { id?: unknown; language?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  const language = typeof body.language === "string" ? body.language.toLowerCase() : "";
  if (!id || !isSupportedLanguage(language)) return NextResponse.json({ error: "Unsupported language." }, { status: 400 });

  const testimony = await getTestimonyById(id);
  if (!testimony) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const result = await advanceAudio(testimony, language);
  if (!result) return NextResponse.json({ error: "Narration isn't available right now." }, { status: 503 });
  return NextResponse.json(result, { status: result.status === "ready" ? 200 : 202, headers: { "cache-control": "no-store" } });
}

/** GET ?id=&language= → current state without doing any work. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const language = (url.searchParams.get("language") ?? "").toLowerCase();
  if (!id || !isSupportedLanguage(language)) return NextResponse.json({ error: "Unsupported language." }, { status: 400 });
  const state = await getAudioState(id, language);
  if (!state) return NextResponse.json({ status: "missing" }, { status: 404 });
  return NextResponse.json(state, { status: state.status === "ready" ? 200 : 202, headers: { "cache-control": "no-store" } });
}
