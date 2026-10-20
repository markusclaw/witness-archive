import { createServerSupabase } from "@/lib/supabase-server";
import { esvEnabled, getEsv } from "@/lib/esv";
import { BOOKS, formatReference, originalFor, translationFor, type Reference, type TranslationInfo } from "@/lib/scripture";

/** The text of a reference in one translation. */
export interface Passage {
  reference: string;
  key: Reference;
  book: { index: number; osis: string; name: string; chapters: number };
  translation: TranslationInfo & { language: string };
  verses: { chapter: number; verse: number; text: string }[];
  /** True when a long chapter was cut short for the popover. */
  truncated: boolean;
}

/** Live translations are only offered when they're configured. */
export function usableVersion(version?: string | null): string | null {
  if (version === "esv" && !esvEnabled()) return null;
  return version ?? null;
}

/** Verses per chapter-only reference before we stop (Psalm 119 has 176). */
const MAX_VERSES = 60;

/**
 * Fetch a reference in the translation for a reader language (unsupported
 * languages fall back to English). Returns null when the table is empty, so
 * callers degrade to plain text until the texts are seeded.
 */
export async function getPassage(ref: Reference, language: string, version?: string | null): Promise<Passage | null> {
  const book = BOOKS[ref.book];
  if (!book || ref.chapter < 1 || ref.chapter > book.chapters) return null;
  const t = translationFor(language, ref.book, usableVersion(version));
  const labelLang = language === "orig" ? "en" : t.language;
  const chapterEnd = ref.chapterEnd ?? ref.chapter;

  if (t.draft) {
    let q = createServerSupabase().from("translation_verses").select("chapter, verse, text").eq("translation", t.code).eq("book", ref.book).gte("chapter", ref.chapter).lte("chapter", chapterEnd).order("chapter").order("verse");
    if (ref.verse != null && ref.chapterEnd == null) q = q.gte("verse", ref.verse).lte("verse", ref.verseEnd ?? ref.verse);
    const { data } = await q;
    if (!data?.length) return getPassage(ref, language, null);
    const verses = data as { chapter: number; verse: number; text: string }[];
    return { reference: formatReference(ref, labelLang), key: ref, book: { index: book.index, osis: book.osis, name: book.names[labelLang] ?? book.names.en, chapters: book.chapters }, translation: t, verses: verses.slice(0, MAX_VERSES), truncated: verses.length > MAX_VERSES };
  }
  if (t.code === "esv") {
    const verses = await getEsv(ref);
    if (!verses) return getPassage(ref, language, null);
    const truncated = verses.length > MAX_VERSES;
    return {
      reference: formatReference(ref, labelLang),
      key: ref,
      book: { index: book.index, osis: book.osis, name: book.names.en, chapters: book.chapters },
      translation: t,
      verses: truncated ? verses.slice(0, MAX_VERSES) : verses,
      truncated,
    };
  }

  let q = createServerSupabase()
    .from("bible_verses")
    .select("chapter, verse, text")
    .eq("translation", t.code)
    .eq("book", ref.book)
    .gte("chapter", ref.chapter)
    .lte("chapter", chapterEnd)
    .order("chapter")
    .order("verse")
    .limit(MAX_VERSES + 1);
  if (ref.verse != null && ref.chapterEnd == null) {
    q = q.gte("verse", ref.verse).lte("verse", ref.verseEnd ?? ref.verse);
  }
  const { data, error } = await q;
  if (error) {
    console.error("getPassage:", error.message);
    return null;
  }
  let rows = (data ?? []) as { chapter: number; verse: number; text: string }[];
  if (ref.verse != null && ref.chapterEnd != null && ref.verseEnd != null) {
    // Cross-chapter range: trim the first and last chapters by verse.
    rows = rows.filter((r) => (r.chapter > ref.chapter || r.verse >= ref.verse!) && (r.chapter < ref.chapterEnd! || r.verse <= ref.verseEnd!));
  }
  if (!rows.length) return null;
  const truncated = rows.length > MAX_VERSES;
  if (truncated) rows = rows.slice(0, MAX_VERSES);

  return {
    reference: formatReference(ref, labelLang),
    key: ref,
    book: { index: book.index, osis: book.osis, name: book.names[labelLang] ?? book.names.en, chapters: book.chapters },
    translation: t,
    verses: rows,
    truncated,
  };
}

/** A whole chapter in the translation for a reader language. Empty when not seeded. */
export async function getChapter(book: number, chapter: number, language: string, version?: string | null): Promise<{ translation: TranslationInfo & { language: string }; verses: { verse: number; text: string }[] }> {
  const t = translationFor(language, book, usableVersion(version));
  if (t.draft) {
    const { data } = await createServerSupabase().from("translation_verses").select("verse, text").eq("translation", t.code).eq("book", book).eq("chapter", chapter).order("verse");
    if (data?.length) return { translation: t, verses: data as { verse: number; text: string }[] };
    return getChapter(book, chapter, language, null);
  }
  if (t.code === "esv") {
    const verses = await getEsv({ book, chapter });
    if (verses) return { translation: t, verses: verses.map(({ verse, text }) => ({ verse, text })) };
    // The API is down or the key is missing: fall back to the default translation.
    return getChapter(book, chapter, language, null);
  }
  const { data, error } = await createServerSupabase()
    .from("bible_verses")
    .select("verse, text")
    .eq("translation", t.code)
    .eq("book", book)
    .eq("chapter", chapter)
    .order("verse")
    .limit(200);
  if (error) console.error("getChapter:", error.message);
  return { translation: t, verses: (data ?? []) as { verse: number; text: string }[] };
}

export interface OriginalWord {
  /** Position in the verse. */
  p: number;
  t: string;
  /** Strong's id, e.g. "H1254" / "G26"; absent for the few untagged forms. */
  s?: string;
  m: string;
  /** Greek dictionary form, when known. */
  l?: string;
}

/** The words of a chapter in the original, verse → words. Empty until the word data is seeded. */
export async function getChapterWords(book: number, chapter: number): Promise<Record<number, OriginalWord[]>> {
  const code = originalFor(book).code;
  const { data, error } = await createServerSupabase()
    .from("bible_words")
    .select("verse, position, text, strongs, morph, lemma")
    .eq("translation", code)
    .eq("book", book)
    .eq("chapter", chapter)
    .order("verse")
    .order("position")
    .limit(6000);
  if (error) console.error("getChapterWords:", error.message);
  const out: Record<number, OriginalWord[]> = {};
  for (const r of data ?? []) {
    const w: OriginalWord = { p: r.position, t: r.text, m: r.morph ?? "" };
    if (r.strongs) w.s = r.strongs;
    if (r.lemma) w.l = r.lemma;
    (out[r.verse] ??= []).push(w);
  }
  return out;
}

export interface LexiconEntry {
  id: string;
  lemma: string;
  translit: string;
  pronunciation: string;
  definition: string;
  kjv_def: string;
  derivation: string;
  occurrences: number;
}

export interface WordInfo {
  entry: LexiconEntry;
  /** Other places the word appears, with the verse in the reader's language. */
  also: { book: number; chapter: number; verse: number; reference: string; text: string }[];
}

/** A Strong's entry plus a few other places the word appears, in the reader's language. */
export async function getWordInfo(strongs: string, language: string, exclude?: { book: number; chapter: number; verse: number }): Promise<WordInfo | null> {
  if (!/^[HG]\d{1,5}$/.test(strongs)) return null;
  const supabase = createServerSupabase();
  const { data: entry } = await supabase.from("bible_lexicon").select("*").eq("id", strongs).maybeSingle();
  if (!entry) return null;

  // Spread the examples across the canon: skip through the occurrences in steps.
  const { data: places } = await supabase.from("bible_words").select("book, chapter, verse").eq("strongs", strongs).order("book").order("chapter").order("verse").limit(2000);
  const seen = new Set<string>();
  const distinct: { book: number; chapter: number; verse: number }[] = [];
  for (const p of places ?? []) {
    const k = `${p.book}.${p.chapter}.${p.verse}`;
    if (seen.has(k) || (exclude && p.book === exclude.book && p.chapter === exclude.chapter && p.verse === exclude.verse)) continue;
    seen.add(k);
    distinct.push(p);
  }
  const WANT = 8;
  const step = Math.max(1, Math.floor(distinct.length / WANT));
  const picked = distinct.filter((_, i) => i % step === 0).slice(0, WANT);

  const t = translationFor(language);
  let also: WordInfo["also"] = [];
  if (picked.length) {
    const or = picked.map((p) => `and(book.eq.${p.book},chapter.eq.${p.chapter},verse.eq.${p.verse})`).join(",");
    const { data: verses } = await supabase.from("bible_verses").select("book, chapter, verse, text").eq("translation", t.code).or(or);
    const byKey = new Map((verses ?? []).map((v) => [`${v.book}.${v.chapter}.${v.verse}`, v.text as string]));
    also = picked.map((p) => ({ ...p, reference: formatReference({ book: p.book, chapter: p.chapter, verse: p.verse }, t.language), text: byKey.get(`${p.book}.${p.chapter}.${p.verse}`) ?? "" }));
  }
  return { entry: entry as LexiconEntry, also };
}
