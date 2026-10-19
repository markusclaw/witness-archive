import { BOOKS, type Reference } from "@/lib/scripture";

/**
 * The English Standard Version, fetched live from Crossway's ESV API
 * (api.esv.org). Their terms for free, non-commercial use:
 *  - no more than 500 verses (or half a book) on a page, and
 *  - no more than 500 verses stored or cached at a time.
 * So the ESV is never written to our database or the edge cache; each
 * server keeps a small in-memory cache well under that limit.
 *
 * Needs ESV_API_KEY (a server secret). Without it the ESV simply isn't offered.
 */

export const ESV_NOTICE =
  "Scripture quotations marked “ESV” are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. ESV Text Edition: 2025. Used by permission. All rights reserved. The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. The ESV may not be translated in whole or in part into any other language.";

export const ESV_LIMIT_NOTE = "You may not copy or download more than 500 consecutive verses of the ESV Bible or more than one half of any book of the ESV Bible.";

export function esvEnabled(): boolean {
  return Boolean(process.env.ESV_API_KEY);
}

type Verse = { chapter: number; verse: number; text: string };

/** Verses held in memory at most — the terms allow 500. */
const CACHE_VERSES = 300;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; verses: Verse[] }>();
let cachedCount = 0;

function remember(key: string, verses: Verse[]) {
  if (verses.length > CACHE_VERSES) return;
  cache.set(key, { at: Date.now(), verses });
  cachedCount += verses.length;
  // Oldest first: Map keeps insertion order.
  for (const [k, v] of cache) {
    if (cachedCount <= CACHE_VERSES) break;
    cache.delete(k);
    cachedCount -= v.verses.length;
  }
}

function recall(key: string): Verse[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    cachedCount -= hit.verses.length;
    return null;
  }
  return hit.verses;
}

/** "John 3:16-18", "Psalm 23", "Jude" — the query string the API understands. */
export function esvQuery(ref: Reference): string {
  const book = BOOKS[ref.book];
  const single = book.chapters === 1;
  const name = book.osis === "Ps" ? (ref.chapterEnd ? "Psalms" : "Psalm") : book.names.en;
  const start = single ? (ref.verse != null ? `${name} ${ref.verse}` : name) : `${name} ${ref.chapter}${ref.verse != null ? `:${ref.verse}` : ""}`;
  if (single) return ref.verse != null && ref.verseEnd != null ? `${start}-${ref.verseEnd}` : start;
  if (ref.chapterEnd != null) {
    const end = ref.verseEnd != null ? `${ref.chapterEnd}:${ref.verseEnd}` : String(ref.chapterEnd);
    return `${start}-${end}`;
  }
  return ref.verseEnd != null ? `${start}-${ref.verseEnd}` : start;
}

/**
 * Split the API's plain text — "[16] For God so loved… [17] For God did not…"
 * — into verses. A "[1]" after the first verse means the next chapter began.
 */
export function parseEsvText(text: string, firstChapter: number): Verse[] {
  const out: Verse[] = [];
  // Markers are "[16]", or "[4:1]" where a passage crosses into a new chapter.
  const marks = [...text.matchAll(/\[(\d+)(?::(\d+))?\]/g)];
  let chapter = firstChapter;
  let last = 0;
  marks.forEach((m, i) => {
    let verse = Number(m[1]);
    if (m[2]) {
      chapter = Number(m[1]);
      verse = Number(m[2]);
    } else if (out.length && verse <= last) {
      chapter += 1;
    }
    last = verse;
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
    const body = text
      .slice(m.index + m[0].length, end)
      .replace(/\(ESV\)\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (body) out.push({ chapter, verse, text: body });
  });
  return out;
}

/** The verses of a reference in the ESV, or null when unavailable. */
export async function getEsv(ref: Reference): Promise<Verse[] | null> {
  const key = process.env.ESV_API_KEY;
  if (!key) return null;
  const q = esvQuery(ref);
  const hit = recall(q);
  if (hit) return hit;

  const params = new URLSearchParams({
    q,
    "include-passage-references": "false",
    "include-verse-numbers": "true",
    "include-first-verse-numbers": "true",
    "include-footnotes": "false",
    "include-headings": "false",
    "include-short-copyright": "false",
    "include-copyright": "false",
    "include-passage-horizontal-lines": "false",
    "include-heading-horizontal-lines": "false",
    "include-selahs": "true",
    "indent-poetry": "false",
    "indent-paragraphs": "0",
    "line-length": "0",
  });
  try {
    const res = await fetch(`${process.env.ESV_API_BASE ?? "https://api.esv.org"}/v3/passage/text/?${params}`, {
      headers: { Authorization: `Token ${key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("ESV API:", res.status, q);
      return null;
    }
    const data = (await res.json()) as { passages?: string[] };
    const verses = parseEsvText((data.passages ?? []).join(" "), ref.chapter);
    if (!verses.length) return null;
    remember(q, verses);
    return verses;
  } catch (e) {
    console.error("ESV API:", (e as Error).message);
    return null;
  }
}
