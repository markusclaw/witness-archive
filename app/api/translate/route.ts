import { NextResponse } from "next/server";
import { isSupportedLanguage } from "@/lib/languages";
import { getTestimonyById } from "@/lib/queries";
import { advanceTranslation, getTranslationState } from "@/lib/translate";

export const dynamic = "force-dynamic";

/**
 * POST { id, language } → the cached translation (200), or — after translating
 * exactly one more chunk — the job's progress (202). The page keeps calling
 * until it gets a 200. Bounded by (published testimonies × supported languages)
 * and cached forever, so it is safe to leave unauthenticated.
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
  if (testimony.language === language) return NextResponse.json({ error: "That is the original language." }, { status: 400 });

  const result = await advanceTranslation(testimony, language);
  if (!result) return NextResponse.json({ error: "Translation isn't available right now." }, { status: 503 });
  return NextResponse.json(result, { status: result.status === "ready" ? 200 : 202, headers: { "cache-control": "no-store" } });
}

/** GET ?id=&language= → current state without doing any work. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const language = (url.searchParams.get("language") ?? "").toLowerCase();
  if (!id || !isSupportedLanguage(language)) return NextResponse.json({ error: "Unsupported language." }, { status: 400 });

  const state = await getTranslationState(id, language);
  if (!state) return NextResponse.json({ status: "missing" }, { status: 404 });
  return NextResponse.json(state, { status: state.status === "ready" ? 200 : 202, headers: { "cache-control": "no-store" } });
}
