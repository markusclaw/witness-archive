import { NextResponse } from "next/server";
import { getWordInfo } from "@/lib/bible";

/**
 * GET /api/bible/word?strongs=H7462&lang=es&at=18.23.1
 * A Strong's entry — root, meaning, how often it appears — plus a few other
 * verses that use it, in the reader's language. Cached hard; the data never changes.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const strongs = (url.searchParams.get("strongs") ?? "").toUpperCase();
  const lang = (url.searchParams.get("lang") ?? "en").slice(0, 2).toLowerCase();
  const at = /^(\d{1,2})\.(\d{1,3})\.(\d{1,3})$/.exec(url.searchParams.get("at") ?? "");
  const info = await getWordInfo(strongs, lang, at ? { book: Number(at[1]), chapter: Number(at[2]), verse: Number(at[3]) } : undefined);
  if (!info) return NextResponse.json({ error: "Unknown word." }, { status: 404, headers: { "cache-control": "public, max-age=300" } });
  return NextResponse.json(info, { headers: { "cache-control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400" } });
}
