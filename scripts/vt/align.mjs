#!/usr/bin/env node
/**
 * Map every word of a translation back to the Hebrew or Greek it translates.
 *
 *   node scripts/vt/align.mjs Ruth             # Spanish (Versión Testigo)
 *   node scripts/vt/align.mjs Ruth --t obt     # English (Open Bible Translation)
 *
 * For each verse the model gets the numbered original words (with Strong's
 * glosses) and the translated verse, and returns, in reading order, which
 * word or phrase of the verse renders which original word(s). Every entry is
 * then checked: the phrase must really occur in the verse, in order, and the
 * positions must exist. Words left unmapped were supplied by the translator.
 *
 * Writes translation/<edition>/alignments/<book>.json; import.mjs uploads it.
 * Needs ANTHROPIC_API_KEY (VT_ALIGN_MODEL or VT_MODEL picks the model).
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { EDITION, OSIS, MODEL, TRANSLATION, bookIndex, claudeJSON, lexiconEntry, loadDraft, originalWords, slug, vtDir } from "./lib.mjs";
import { matchAlignment } from "./align-match.mjs";

const args = process.argv.slice(2);
const bookArg = args.find((a) => !a.startsWith("--"));
const chapterArg = args.filter((a) => !a.startsWith("--"))[1];
if (!bookArg) {
  console.error("Usage: node scripts/vt/align.mjs <Book> [chapter] [--t obt]");
  process.exit(1);
}
const book = bookIndex(bookArg);
const draft = loadDraft(book);
const original = originalWords(book);
const model = process.env.VT_ALIGN_MODEL ?? MODEL();
const he = book < 39;
const file = path.join(vtDir, "alignments", `${slug(book)}.json`);
const existing = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
const result = new Map(Object.entries(existing?.verses ?? {}));

const SCHEMA = {
  type: "object",
  properties: {
    verses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ref: { type: "string" },
          map: { type: "array", items: { type: "object", properties: { w: { type: "string" }, h: { type: "array", items: { type: "integer" } } }, required: ["w", "h"] } },
        },
        required: ["ref", "map"],
      },
    },
  },
  required: ["verses"],
};

const system = `You align a ${EDITION.languageName} Bible translation with the ${he ? "Hebrew" : "Greek"} it was translated from, word by word, like a reverse interlinear.

For each verse you get the original words, numbered, and the translated verse. Return "map": a list in the order the words appear in the TRANSLATION, where each item is
  w — a word or short phrase copied EXACTLY from the translated verse (same spelling, accents and capitals; no punctuation), and
  h — the number(s) of the original word(s) it translates.
Rules:
- Use the smallest phrase that corresponds (often one word; "in the days" can be one item if it renders one original word).
- One original word may be rendered by several separate items (e.g. a verb and its subject pronoun). One item may render several original words.
- Leave out translation words that have no counterpart in the original (supplied for sense or grammar). Don't force them onto a word.
- Original words that aren't translated by any specific word (like the object marker את) are simply not used.
- Never include a phrase that isn't in the verse.
Submit with the submit tool.`;

function packet(ref, text) {
  const list = original.get(ref) ?? [];
  const lines = list.map((w) => {
    const lex = w.strongs ? lexiconEntry(w.strongs) : null;
    return `  [${w.pos}] ${w.text}  ${w.strongs ?? ""} ${lex ? (lex.kjv || lex.definition || "").slice(0, 50) : ""}`;
  });
  return `### ${ref}\nORIGINAL:\n${lines.join("\n")}\nTRANSLATION: ${text}`;
}

const verses = draft.verses.filter((v) => !chapterArg || v.ref.startsWith(`${chapterArg}:`));
const problems = [];
for (let i = 0; i < verses.length; i += 8) {
  const chunk = verses.slice(i, i + 8);
  process.stdout.write(`${OSIS[book]} ${chunk[0].ref}–${chunk[chunk.length - 1].ref}… `);
  const out = await claudeJSON({ system, prompt: chunk.map((v) => packet(v.ref, v.text)).join("\n\n"), model, schema: SCHEMA, maxTokens: 8000 });
  for (const v of chunk) {
    const got = (out.verses ?? []).find((x) => x.ref === v.ref);
    if (!got) {
      problems.push(`${v.ref}: no alignment returned`);
      continue;
    }
    const positions = new Set((original.get(v.ref) ?? []).map((w) => w.pos));
    const { kept, dropped } = matchAlignment(v.text, got.map.filter((m) => m.h.length && m.h.every((p) => positions.has(p))));
    for (const d of dropped) problems.push(`${v.ref}: "${d.w}" not found in the verse — dropped`);
    result.set(v.ref, { text: v.text, map: kept });
  }
  console.log("ok");
}

// Coverage: how much of the original is accounted for.
let origTotal = 0;
let origMapped = 0;
for (const v of draft.verses) {
  const a = result.get(v.ref);
  const list = original.get(v.ref) ?? [];
  origTotal += list.length;
  if (!a) continue;
  const used = new Set(a.map.flatMap((m) => m.h));
  origMapped += list.filter((w) => used.has(w.pos)).length;
}

mkdirSync(path.dirname(file), { recursive: true });
const ordered = Object.fromEntries(draft.verses.filter((v) => result.has(v.ref)).map((v) => [v.ref, result.get(v.ref)]));
writeFileSync(file, JSON.stringify({ translation: TRANSLATION, book, author: `ai:${model}`, created: new Date().toISOString().slice(0, 10), verses: ordered }, null, 1) + "\n");
console.log(`${Object.keys(ordered).length} verses aligned; ${origMapped}/${origTotal} original words mapped (${Math.round((100 * origMapped) / Math.max(origTotal, 1))}%).`);
if (problems.length) console.log(`${problems.length} fixed or flagged:\n  ${problems.join("\n  ")}`);
console.log(`→ ${path.relative(process.cwd(), file)}. Next: node scripts/vt/import.mjs ${OSIS[book]}${TRANSLATION === "vt" ? "" : ` --t ${TRANSLATION}`}`);
