#!/usr/bin/env node
/**
 * Record a reviewer's work on the Versión Testigo. Every action becomes a
 * public revision with the reviewer's name — nothing changes silently.
 *
 * Edit a verse (a reason is required):
 *   node scripts/vt/review.mjs Ruth 1:16 --by "Ana Pérez" --edit "Nuevo texto…" --why "Sigue mejor el hebreo"
 *
 * Mark verses reviewed or approved (a verse, a chapter, or "all"):
 *   node scripts/vt/review.mjs Ruth 1:16 --by "Ana Pérez" --reviewed [--why "comentario"]
 *   node scripts/vt/review.mjs Ruth 2 --by "Comité" --approved
 *
 * Show a verse with its history:
 *   node scripts/vt/review.mjs Ruth 1:16
 */
import { OSIS, TRANSLATION, bookIndex, supabase } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const [bookArg, target] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!bookArg || !target) {
  console.error("Usage: node scripts/vt/review.mjs <Book> <c:v | chapter | all> [--by Name] [--edit text --why reason | --reviewed | --approved]");
  process.exit(1);
}
const book = bookIndex(bookArg);
const by = opt("by");
const why = opt("why");
const edit = opt("edit");
const action = edit != null ? "edit" : args.includes("--approved") ? "approval" : args.includes("--reviewed") ? "review" : null;
const db = await supabase();

let q = db.from("translation_verses").select("*").eq("translation", TRANSLATION).eq("book", book).order("chapter").order("verse");
if (target.includes(":")) {
  const [c, v] = target.split(":").map(Number);
  q = q.eq("chapter", c).eq("verse", v);
} else if (target !== "all") {
  q = q.eq("chapter", Number(target));
}
const { data: verses, error } = await q;
if (error) throw new Error(error.message);
if (!verses?.length) {
  console.error("No such verses in the Versión Testigo yet.");
  process.exit(1);
}

if (!action) {
  for (const v of verses) {
    console.log(`\n${OSIS[book]} ${v.chapter}:${v.verse}  [${v.status}]\n  ${v.text}`);
    const { data: hist } = await db.from("translation_revisions").select("kind, author, comment, text, created_at").eq("translation", TRANSLATION).eq("book", book).eq("chapter", v.chapter).eq("verse", v.verse).order("created_at");
    for (const h of hist ?? []) console.log(`  · ${h.created_at.slice(0, 10)} ${h.kind} by ${h.author}${h.comment ? ` — ${h.comment}` : ""}${h.kind === "edit" || h.kind === "ai_draft" ? `\n      ${h.text}` : ""}`);
  }
  process.exit(0);
}

if (!by) {
  console.error("Say who is doing this: --by \"Name\".");
  process.exit(1);
}
if (action === "edit") {
  if (verses.length !== 1) {
    console.error("Edit one verse at a time (c:v).");
    process.exit(1);
  }
  if (!why) {
    console.error("Every edit needs a reason: --why \"…\".");
    process.exit(1);
  }
}

const status = { edit: "reviewed", review: "reviewed", approval: "approved" }[action];
for (const v of verses) {
  const text = action === "edit" ? edit : v.text;
  const { data: rev, error: rErr } = await db
    .from("translation_revisions")
    .insert({ translation: TRANSLATION, book, chapter: v.chapter, verse: v.verse, text, notes: v.notes, kind: action, author: by, comment: why ?? null, data: action === "edit" ? { previous: v.text } : {} })
    .select("id")
    .single();
  if (rErr) throw new Error(rErr.message);
  const { error: uErr } = await db.from("translation_verses").update({ text, status, revision_id: rev.id, updated_at: new Date().toISOString() }).eq("translation", TRANSLATION).eq("book", book).eq("chapter", v.chapter).eq("verse", v.verse);
  if (uErr) throw new Error(uErr.message);
}
console.log(`${OSIS[book]} ${target}: ${verses.length} verse(s) → ${status} by ${by}.`);
