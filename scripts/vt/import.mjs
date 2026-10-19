#!/usr/bin/env node
/**
 * Upload a Versión Testigo draft and its check report to Supabase.
 *
 *   node scripts/vt/import.mjs Ruth
 *   node scripts/vt/import.mjs Ruth --force   # also replace verses a person has edited
 *
 * Each verse becomes an "ai_draft" revision. A verse that a reviewer has
 * already edited or approved keeps its current text (the new AI draft is
 * still recorded in its history) unless you pass --force.
 * Run migration 027 first.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { OSIS, TRANSLATION, bookIndex, loadDraft, slug, supabase, vtDir } from "./lib.mjs";

const args = process.argv.slice(2);
const bookArg = args.find((a) => !a.startsWith("--"));
if (!bookArg) {
  console.error("Usage: node scripts/vt/import.mjs <Book> [--force]");
  process.exit(1);
}
const force = args.includes("--force");
const book = bookIndex(bookArg);
const draft = loadDraft(book);
const checksFile = path.join(vtDir, "reports", `${slug(book)}.checks.json`);
const report = existsSync(checksFile) ? JSON.parse(readFileSync(checksFile, "utf8")) : null;
if (!report) console.warn("No check report found — run check.mjs first to attach checks. Importing the text only.");
const db = await supabase();

const { data: current, error } = await db.from("translation_verses").select("chapter, verse, text, status, revision_id").eq("translation", TRANSLATION).eq("book", book);
if (error) {
  console.error(`Could not read translation_verses: ${error.message} (did you run migration 027?)`);
  process.exit(1);
}
const now = new Map((current ?? []).map((r) => [`${r.chapter}:${r.verse}`, r]));

// The latest AI draft of each verse, so re-importing the same draft is a no-op
// even for verses a reviewer has since edited.
const { data: drafts } = await db.from("translation_revisions").select("id, chapter, verse, text, created_at").eq("translation", TRANSLATION).eq("book", book).eq("kind", "ai_draft").order("created_at");
const lastDraft = new Map((drafts ?? []).map((r) => [`${r.chapter}:${r.verse}`, r]));

let added = 0;
let kept = 0;
let same = 0;
for (const v of draft.verses) {
  const [chapter, verse] = v.ref.split(":").map(Number);
  const existing = now.get(v.ref);
  const prior = lastDraft.get(v.ref);
  if (prior && prior.text === v.text) {
    // Already imported: just refresh its automatic checks (e.g. after check.mjs --ai).
    same++;
    const mine = (report?.checks ?? []).filter((c) => c.ref === v.ref);
    if (mine.length) {
      await db.from("translation_checks").delete().eq("revision_id", prior.id);
      const { error: cErr } = await db.from("translation_checks").insert(mine.map((c) => ({ revision_id: prior.id, translation: TRANSLATION, book, chapter, verse, kind: c.kind, severity: c.severity, message: c.message, data: c.data ?? {} })));
      if (cErr) console.error(`${v.ref} checks: ${cErr.message}`);
    }
    continue;
  }
  const { data: rev, error: rErr } = await db
    .from("translation_revisions")
    .insert({
      translation: TRANSLATION,
      book,
      chapter,
      verse,
      text: v.text,
      notes: v.notes ?? [],
      kind: "ai_draft",
      author: draft.author,
      data: { method: draft.method, promptVersion: draft.promptVersion ?? null, created: draft.created },
    })
    .select("id")
    .single();
  if (rErr) {
    console.error(`${v.ref}: ${rErr.message}`);
    process.exit(1);
  }
  added++;

  const humanTouched = existing && existing.status !== "draft";
  if (humanTouched && !force) {
    kept++;
  } else {
    const { error: uErr } = await db.from("translation_verses").upsert({ translation: TRANSLATION, book, chapter, verse, text: v.text, notes: v.notes ?? [], status: "draft", revision_id: rev.id, updated_at: new Date().toISOString() });
    if (uErr) {
      console.error(`${v.ref}: ${uErr.message}`);
      process.exit(1);
    }
  }

  const mine = (report?.checks ?? []).filter((c) => c.ref === v.ref);
  if (mine.length) {
    const { error: cErr } = await db.from("translation_checks").insert(mine.map((c) => ({ revision_id: rev.id, translation: TRANSLATION, book, chapter, verse, kind: c.kind, severity: c.severity, message: c.message, data: c.data ?? {} })));
    if (cErr) console.error(`${v.ref} checks: ${cErr.message}`);
  }
}
console.log(`${OSIS[book]}: ${added} new revisions${kept ? ` (${kept} verses kept their reviewed text)` : ""}, ${same} unchanged (checks refreshed).`);
