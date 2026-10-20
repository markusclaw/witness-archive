import { createServerSupabase } from "@/lib/supabase-server";
import { originalFor } from "@/lib/scripture";

/**
 * Reads for the Versión Testigo review pages: current text, every revision,
 * every automatic check. All of it is public by design.
 */

export const VT = "vt";

export * from "@/lib/vt-shared";
import type { VtCheck, VtRevision, VtStatus, VtVerse } from "@/lib/vt-shared";

/** Verses per book and status, for the progress table. */
export async function getVtProgress(): Promise<{ book: number; draft: number; reviewed: number; approved: number; chapters: number[] }[]> {
  const { data, error } = await createServerSupabase().from("translation_verses").select("book, chapter, status").eq("translation", VT).limit(40000);
  if (error) console.error("getVtProgress:", error.message);
  const by = new Map<number, { book: number; draft: number; reviewed: number; approved: number; chapters: Set<number> }>();
  for (const r of data ?? []) {
    const e = by.get(r.book) ?? { book: r.book, draft: 0, reviewed: 0, approved: 0, chapters: new Set<number>() };
    e[r.status as VtStatus]++;
    e.chapters.add(r.chapter);
    by.set(r.book, e);
  }
  return [...by.values()].sort((a, b) => a.book - b.book).map((e) => ({ ...e, chapters: [...e.chapters].sort((a, b) => a - b) }));
}

/** Everything the chapter review page shows. */
export async function getVtChapter(book: number, chapter: number) {
  const db = createServerSupabase();
  const [verses, revisions, checks, original, bsb] = await Promise.all([
    db.from("translation_verses").select("chapter, verse, text, notes, status, revision_id, updated_at").eq("translation", VT).eq("book", book).eq("chapter", chapter).order("verse"),
    db.from("translation_revisions").select("id, chapter, verse, text, kind, author, comment, created_at").eq("translation", VT).eq("book", book).eq("chapter", chapter).order("created_at").limit(5000),
    db.from("translation_checks").select("revision_id, chapter, verse, kind, severity, message, resolved").eq("translation", VT).eq("book", book).eq("chapter", chapter).limit(5000),
    db.from("bible_verses").select("verse, text").eq("translation", originalFor(book).code).eq("book", book).eq("chapter", chapter).order("verse"),
    db.from("bible_verses").select("verse, text").eq("translation", "bsb").eq("book", book).eq("chapter", chapter).order("verse"),
  ]);
  for (const r of [verses, revisions, checks]) if (r.error) console.error("getVtChapter:", r.error.message);
  const byVerse = <T extends { verse: number }>(rows: T[] | null) => {
    const m = new Map<number, T[]>();
    for (const r of rows ?? []) m.set(r.verse, [...(m.get(r.verse) ?? []), r]);
    return m;
  };
  return {
    verses: (verses.data ?? []) as VtVerse[],
    revisions: byVerse((revisions.data ?? []) as VtRevision[]),
    checks: byVerse((checks.data ?? []) as VtCheck[]),
    original: new Map(((original.data ?? []) as { verse: number; text: string }[]).map((r) => [r.verse, r.text])),
    bsb: new Map(((bsb.data ?? []) as { verse: number; text: string }[]).map((r) => [r.verse, r.text])),
  };
}


/** A whole book of the VT for the reading page, with the original words of each verse. */
export async function getVtBook(book: number) {
  const { getChapterWords } = await import("@/lib/bible");
  const { data, error } = await createServerSupabase()
    .from("translation_verses")
    .select("chapter, verse, text, notes, status, revision_id, updated_at")
    .eq("translation", VT)
    .eq("book", book)
    .order("chapter")
    .order("verse")
    .limit(3000);
  if (error) console.error("getVtBook:", error.message);
  const verses = (data ?? []) as VtVerse[];
  const chapterNums = [...new Set(verses.map((v) => v.chapter))];
  const words = await Promise.all(chapterNums.map((c) => getChapterWords(book, c)));
  return chapterNums.map((c, i) => ({ chapter: c, verses: verses.filter((v) => v.chapter === c), words: words[i] }));
}
