#!/usr/bin/env node
/**
 * Draft a book (or one chapter) of the Versión Testigo from the original
 * language, with Claude. Writes translation/vt/drafts/<book>.json for review —
 * nothing goes to the database until you run import.mjs.
 *
 *   node scripts/vt/draft.mjs Ruth          # whole book
 *   node scripts/vt/draft.mjs Ruth 2        # one chapter (merged into the file)
 *
 * The model sees only: the Hebrew/Greek words with Strong's numbers, grammar
 * tags and dictionary glosses, the style guide, the glossary entries for the
 * words in front of it, and the Spanish it has already drafted for context.
 * It is never shown a published translation.
 *
 * Needs ANTHROPIC_API_KEY. VT_MODEL picks the model (use the strongest one
 * you have; it's recorded with every verse).
 */
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { EDITION, OSIS, MODEL, TRANSLATION, bookIndex, claudeJSON, draftPath, lexiconEntry, loadGlossary, loadStyle, originalWords } from "./lib.mjs";

const [bookArg, chapterArg] = process.argv.slice(2);
if (!bookArg) {
  console.error("Usage: node scripts/vt/draft.mjs <Book> [chapter]");
  process.exit(1);
}
const book = bookIndex(bookArg);
const model = MODEL();
const style = loadStyle();
const glossary = loadGlossary();
const words = originalWords(book);
const language = book < 39 ? "hebreo" : "griego";
const PROMPT_VERSION = `${TRANSLATION}-draft-1`;
const CHUNK = 25;
const DRAFT_SCHEMA = {
  type: "object",
  properties: { verses: { type: "array", items: { type: "object", properties: { ref: { type: "string" }, text: { type: "string" }, notes: { type: "array", items: { type: "object", properties: { type: { type: "string" }, text: { type: "string" } }, required: ["type", "text"] } } }, required: ["ref", "text", "notes"] } } },
  required: ["verses"],
};

const SYSTEM = {
  es: `Eres el traductor de la Versión Testigo, una traducción abierta de la Biblia al español hecha directamente desde el ${language}.

Reglas:
- Traduce SOLO a partir de las palabras en ${language} que se te dan. Las glosas en inglés son ayudas de diccionario, no una traducción que seguir.
- Escribe tu propia redacción. No reproduzcas la redacción de ninguna Biblia publicada (Reina-Valera 1960, NVI, LBLA, NBLA, NTV, DHH, TLA, BLP u otras), aunque la recuerdes.
- Sigue la guía de estilo y el glosario al pie de la letra.
- Añade notas breves solo cuando ayuden de verdad (tipos: alternativa, texto, significado, medida).
- Entrega el resultado con la herramienta submit: un elemento por versículo, con ref ("c:v"), text y notes.

GUÍA DE ESTILO:
${style}`,
  en: `You are the translator of the Open Bible Translation, an open English Bible translated directly from the ${book < 39 ? "Hebrew" : "Greek"}.

Rules:
- Translate ONLY from the original-language words you are given. The English glosses are dictionary aids, not a translation to follow.
- Write your own wording. Do not reproduce the wording of any copyrighted Bible (ESV, NIV, NASB, NKJV, NLT, CSB, NRSV, NET or others), even where you remember it. Avoid runs of more than a few words that match them.
- Follow the style guide and the glossary exactly.
- Add short notes only where they truly help (types: alternative, text, meaning, measure).
- Submit the result with the submit tool: one item per verse, with ref ("c:v"), text and notes.

STYLE GUIDE:
${style}`,
};
const system = SYSTEM[EDITION.language];

function packet(ref) {
  const list = words.get(ref) ?? [];
  const seen = new Set();
  const lines = list.map((w) => {
    const lex = w.strongs ? lexiconEntry(w.strongs) : null;
    if (w.strongs) seen.add(w.strongs);
    const gloss = lex ? `${lex.lemma} (${lex.translit}): ${(lex.definition || "").slice(0, 90)} | ${(lex.kjv || "").slice(0, 60)}` : "";
    return `  ${w.text}  [${w.strongs ?? "-"} ${w.morph}]  ${gloss}`;
  });
  const terms = glossary.terms.filter((t) => seen.has(t.strongs)).map((t) => `  ${t.strongs} ${t.lemma} → ${t.es.join(" / ")}: ${t.note}`);
  return `### ${ref}\n${lines.join("\n")}${terms.length ? `\n  Glosario:\n${terms.join("\n")}` : ""}`;
}

const file = draftPath(book);
const existing = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
const drafted = new Map((existing?.verses ?? []).map((v) => [v.ref, v]));

const refs = [...words.keys()].filter((r) => !chapterArg || r.startsWith(`${chapterArg}:`));
if (!refs.length) {
  console.error("No verses found for that book/chapter.");
  process.exit(1);
}

const names = glossary.names.map((n) => n.es).join(", ");
for (let i = 0; i < refs.length; i += CHUNK) {
  const chunk = refs.slice(i, i + CHUNK);
  const before = refs.slice(Math.max(0, i - 4), i).map((r) => drafted.get(r)).filter(Boolean);
  const prompt = [
    EDITION.language === "es" ? `Libro: ${OSIS[book]}. Traduce estos versículos.` : `Book: ${OSIS[book]}. Translate these verses.`,
    EDITION.language === "es" ? `Nombres propios (grafía obligatoria): ${names}.` : `Proper names (required spelling): ${names}.`,
    before.length ? `${EDITION.language === "es" ? "Contexto (ya traducido)" : "Context (already translated)"}:\n${before.map((v) => `${v.ref} ${v.text}`).join("\n")}` : "",
    chunk.map(packet).join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
  process.stdout.write(`${OSIS[book]} ${chunk[0]}–${chunk[chunk.length - 1]}… `);
  const out = await claudeJSON({ system, prompt, model, schema: DRAFT_SCHEMA, maxTokens: 8000 });
  for (const v of out.verses ?? []) if (chunk.includes(v.ref)) drafted.set(v.ref, { ref: v.ref, text: v.text.trim(), notes: v.notes ?? [] });
  const missing = chunk.filter((r) => !drafted.has(r));
  console.log(missing.length ? `missing ${missing.join(", ")}` : "ok");
}

const order = [...words.keys()];
const result = {
  translation: TRANSLATION,
  book,
  kind: "ai_draft",
  author: `ai:${model}`,
  created: new Date().toISOString().slice(0, 10),
  promptVersion: PROMPT_VERSION,
  method: `Drafted from the ${book < 39 ? "Westminster Leningrad Codex" : "SBL Greek New Testament"} word by word (Strong's, morphology, lexicon glosses), following STYLE.md and glossary.json. No published translation shown to the model.`,
  verses: order.filter((r) => drafted.has(r)).map((r) => drafted.get(r)),
};
mkdirSync(path.dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(result, null, 2) + "\n");
console.log(`Wrote ${path.relative(process.cwd(), file)} (${result.verses.length}/${order.length} verses). Next: node scripts/vt/check.mjs ${OSIS[book]}`);
