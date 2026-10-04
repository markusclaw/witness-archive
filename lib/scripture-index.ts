import { createAdminSupabase } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase-server";
import { contentHash } from "@/lib/chunks";
import { TESTIMONY_COLUMNS } from "@/lib/queries";
import { referenceKey, uniqueReferences, type Reference } from "@/lib/scripture";
import type { Testimony } from "@/lib/types";

/**
 * The reverse of the popovers: which testimonies mention a passage. Rows in
 * `testimony_scripture` are rebuilt lazily — whenever a published testimony
 * is rendered and its text hash differs from what was indexed — so nothing
 * runs at publish time and edits are picked up on the next view.
 */

function indexedText(t: Testimony): string {
  return [t.title, t.description ?? "", t.content ?? ""].join("\n\n");
}

/** Bring the index for one testimony up to date. Cheap when nothing changed (one small select). */
export async function syncScriptureIndex(t: Testimony): Promise<void> {
  if (t.status !== "published") return;
  const admin = createAdminSupabase();
  if (!admin) return;
  const text = indexedText(t);
  const hash = contentHash(text);
  try {
    const { data: existing } = await admin.from("testimony_scripture").select("source_hash").eq("testimony_id", t.id).limit(1);
    const refs = uniqueReferences(text);
    if (existing?.length ? existing[0].source_hash === hash : refs.length === 0) return;
    await admin.from("testimony_scripture").delete().eq("testimony_id", t.id);
    if (!refs.length) return;
    const rows = refs.map((r, i) => ({
      testimony_id: t.id,
      ref_key: referenceKey(r),
      book: r.book,
      chapter: r.chapter,
      verse_start: r.verse ?? null,
      verse_end: r.verseEnd ?? r.verse ?? null,
      position: i,
      source_hash: hash,
    }));
    const { error } = await admin.from("testimony_scripture").insert(rows);
    if (error) console.error("syncScriptureIndex:", error.message);
  } catch (err) {
    console.error("syncScriptureIndex:", err instanceof Error ? err.message : err);
  }
}

export interface ChapterMention {
  testimony: Testimony;
  /** The references into this chapter, in order of first mention. */
  refs: Reference[];
}

/** Published testimonies that mention a chapter (any verse in it, or the chapter itself). */
export async function getChapterMentions(book: number, chapter: number, limit = 24): Promise<ChapterMention[]> {
  const supabase = createServerSupabase();
  const { data: rows, error } = await supabase
    .from("testimony_scripture")
    .select("testimony_id, ref_key, book, chapter, verse_start, verse_end, position")
    .eq("book", book)
    .eq("chapter", chapter)
    .order("created_at", { ascending: false })
    .limit(400);
  if (error || !rows?.length) {
    if (error) console.error("getChapterMentions:", error.message);
    return [];
  }
  const byId = new Map<string, Reference[]>();
  for (const r of rows) {
    const list = byId.get(r.testimony_id) ?? [];
    list.push({ book: r.book, chapter: r.chapter, verse: r.verse_start ?? undefined, verseEnd: r.verse_end != null && r.verse_end !== r.verse_start ? r.verse_end : undefined });
    byId.set(r.testimony_id, list);
  }
  const ids = [...byId.keys()].slice(0, limit);
  const { data: ts } = await supabase.from("testimonies").select(TESTIMONY_COLUMNS).in("id", ids).eq("status", "published");
  const order = new Map(ids.map((id, i) => [id, i]));
  return ((ts ?? []) as Testimony[])
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((testimony) => ({ testimony, refs: byId.get(testimony.id) ?? [] }));
}

/** How many testimonies mention each chapter of a book, and the book overall. */
export async function getBookMentionCounts(book: number): Promise<{ byChapter: Map<number, number>; total: number }> {
  const { data } = await createServerSupabase().from("testimony_scripture").select("testimony_id, chapter").eq("book", book).limit(5000);
  const seen = new Map<number, Set<string>>();
  const all = new Set<string>();
  for (const r of data ?? []) {
    const s = seen.get(r.chapter) ?? new Set<string>();
    s.add(r.testimony_id);
    seen.set(r.chapter, s);
    all.add(r.testimony_id);
  }
  return { byChapter: new Map([...seen].map(([c, s]) => [c, s.size])), total: all.size };
}
