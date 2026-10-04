import { NextResponse } from "next/server";
import { getPassage } from "@/lib/bible";
import { parseReferenceKey, findReferences } from "@/lib/scripture";

/**
 * GET /api/bible?ref=42.3.16&lang=es
 * GET /api/bible?q=John 3:16-18&lang=pt
 *
 * The verse(s) in the translation for the reader's language. Scripture texts
 * never change, so responses are cached hard at the edge.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawLang = (url.searchParams.get("lang") ?? "en").toLowerCase();
  const lang = rawLang === "orig" ? "orig" : rawLang.slice(0, 2);
  let ref = parseReferenceKey(url.searchParams.get("ref") ?? "");
  if (!ref) {
    const q = url.searchParams.get("q");
    if (q) ref = findReferences(q.slice(0, 80))[0] ?? null;
  }
  if (!ref) return NextResponse.json({ error: "Unrecognized reference." }, { status: 400 });

  const passage = await getPassage(ref, lang);
  if (!passage) return NextResponse.json({ error: "Passage not available." }, { status: 404, headers: { "cache-control": "public, max-age=300" } });
  return NextResponse.json(passage, { headers: { "cache-control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400" } });
}
