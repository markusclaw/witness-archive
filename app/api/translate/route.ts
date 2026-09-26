import { NextResponse } from "next/server";
import { isSupportedLanguage } from "@/lib/languages";
import { getTestimonyById } from "@/lib/queries";
import { createTranslation, getTranslation } from "@/lib/translate";

export const dynamic = "force-dynamic";

/**
 * POST { id, language } → the cached translation, generating it on first request.
 * Bounded by (published testimonies × supported languages), and each result is
 * cached forever, so this is safe to leave unauthenticated.
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

  const cached = await getTranslation(id, language);
  if (cached) return NextResponse.json(cached);

  const created = await createTranslation(testimony, language);
  if (!created) return NextResponse.json({ error: "Translation isn't available right now." }, { status: 503 });
  return NextResponse.json(created);
}
