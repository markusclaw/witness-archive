#!/usr/bin/env node
/**
 * Remove repeated AI-draft entries from verse histories: an "ai_draft"
 * revision identical (text and notes) to the AI draft just before it adds
 * nothing. Keeps the earliest of each run; reviewer edits, reviews and
 * approvals are never touched. Checks attached to a removed duplicate go
 * with it (the kept copy has its own).
 *
 *   node scripts/vt/dedupe.mjs Ruth            # Spanish — shows what it would remove
 *   node scripts/vt/dedupe.mjs Ruth --apply    # …and removes it
 *   node scripts/vt/dedupe.mjs Ruth --t obt --apply
 */
import { OSIS, TRANSLATION, bookIndex, sameNotes, supabase } from "./lib.mjs";

const args = process.argv.slice(2);
const bookArg = args.find((a) => !a.startsWith("--"));
if (!bookArg) {
  console.error("Usage: node scripts/vt/dedupe.mjs <Book> [--t obt] [--apply]");
  process.exit(1);
}
const apply = args.includes("--apply");
const book = bookIndex(bookArg);
const db = await supabase();

const { data: revs, error } = await db.from("translation_revisions").select("id, chapter, verse, text, notes, kind, created_at").eq("translation", TRANSLATION).eq("book", book).order("created_at").limit(20000);
if (error) throw new Error(error.message);

const byVerse = new Map();
for (const r of revs) {
  const k = `${r.chapter}:${r.verse}`;
  if (!byVerse.has(k)) byVerse.set(k, []);
  byVerse.get(k).push(r);
}

const remove = [];
for (const list of byVerse.values()) {
  let lastDraft = null;
  for (const r of list) {
    if (r.kind !== "ai_draft") continue;
    if (lastDraft && lastDraft.text === r.text && sameNotes(lastDraft.notes, r.notes)) remove.push(r);
    else lastDraft = r;
  }
}

console.log(`${OSIS[book]} (${TRANSLATION}): ${revs.length} revisions, ${remove.length} repeated AI drafts${apply ? " — removing" : " (dry run; add --apply to remove)"}.`);
if (!apply || !remove.length) process.exit(0);

const removed = new Set(remove.map((r) => r.id));
for (let i = 0; i < remove.length; i += 100) {
  const ids = remove.slice(i, i + 100).map((r) => r.id);
  const { error: dErr } = await db.from("translation_revisions").delete().in("id", ids);
  if (dErr) throw new Error(dErr.message);
}

// Point each verse at its latest surviving revision.
let repointed = 0;
const { data: verses } = await db.from("translation_verses").select("chapter, verse, revision_id").eq("translation", TRANSLATION).eq("book", book);
for (const v of verses ?? []) {
  if (!removed.has(v.revision_id)) continue;
  const left = byVerse.get(`${v.chapter}:${v.verse}`).filter((r) => !removed.has(r.id));
  const latest = left[left.length - 1];
  const { error: uErr } = await db.from("translation_verses").update({ revision_id: latest.id }).eq("translation", TRANSLATION).eq("book", book).eq("chapter", v.chapter).eq("verse", v.verse);
  if (uErr) throw new Error(uErr.message);
  repointed++;
}
console.log(`Removed ${remove.length}; ${repointed} verses now point at their surviving revision.`);
