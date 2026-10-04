import { createServerSupabase } from "@/lib/supabase-server";
import { BOOKS, formatReference, translationFor, type Reference } from "@/lib/scripture";

/** The text of a reference in one translation. */
export interface Passage {
  reference: string;
  key: Reference;
  book: { index: number; osis: string; name: string; chapters: number };
  translation: { code: string; name: string; language: string };
  verses: { chapter: number; verse: number; text: string }[];
  /** True when a long chapter was cut short for the popover. */
  truncated: boolean;
}

/** Verses per chapter-only reference before we stop (Psalm 119 has 176). */
const MAX_VERSES = 60;

/**
 * Fetch a reference in the translation for a reader language (unsupported
 * languages fall back to English). Returns null when the table is empty, so
 * callers degrade to plain text until the texts are seeded.
 */
export async function getPassage(ref: Reference, language: string): Promise<Passage | null> {
  const book = BOOKS[ref.book];
  if (!book || ref.chapter < 1 || ref.chapter > book.chapters) return null;
  const t = translationFor(language);
  const chapterEnd = ref.chapterEnd ?? ref.chapter;

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
    reference: formatReference(ref, t.language),
    key: ref,
    book: { index: book.index, osis: book.osis, name: book.names[t.language] ?? book.names.en, chapters: book.chapters },
    translation: t,
    verses: rows,
    truncated,
  };
}

/** A whole chapter in the translation for a reader language. Empty when not seeded. */
export async function getChapter(book: number, chapter: number, language: string): Promise<{ translation: { code: string; name: string; language: string }; verses: { verse: number; text: string }[] }> {
  const t = translationFor(language);
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
