#!/usr/bin/env node
/**
 * Check a Versión Testigo draft before people review it.
 *
 *   node scripts/vt/check.mjs Ruth          # rule checks on the draft file
 *   node scripts/vt/check.mjs Ruth --ai     # + back-translation and BSB comparison (needs ANTHROPIC_API_KEY)
 *
 * Checks:
 *   glossary   key Hebrew/Greek terms rendered as glossary.json says
 *   names      proper names spelled the agreed way
 *   style      no vosotros, no «Jehová», no archaisms
 *   echo       long runs of identical wording shared with another
 *              translation. Public-domain texts in scripts/bible-data are
 *              always compared (informational). Copyrighted texts can be
 *              added privately in translation/vt/reference/*.json (that
 *              folder is gitignored) — an 8+ word match there is a warning.
 *   benchmark  (--ai) a second model translates the Spanish back into
 *              English, compares it with the Berean Standard Bible and the
 *              original, and reports differences in meaning.
 *
 * Writes translation/vt/reports/<book>.checks.json (import.mjs uploads it)
 * and a readable translation/vt/reports/<book>.md.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { OSIS, MODEL, bookIndex, claudeJSON, lexiconEntry, loadDraft, loadGlossary, originalWords, referenceTexts, slug, translationVerses, vtDir, words } from "./lib.mjs";

const args = process.argv.slice(2);
const bookArg = args.find((a) => !a.startsWith("--"));
if (!bookArg) {
  console.error("Usage: node scripts/vt/check.mjs <Book> [--ai]");
  process.exit(1);
}
const useAI = args.includes("--ai");
const book = bookIndex(bookArg);
const draft = loadDraft(book);
const glossary = loadGlossary();
const original = originalWords(book);
const checks = []; // { ref, kind, severity, message, data }
const add = (ref, kind, severity, message, data = {}) => checks.push({ ref, kind, severity, message, data });

// --- completeness -----------------------------------------------------------
const drafted = new Map(draft.verses.map((v) => [v.ref, v]));
for (const ref of original.keys()) {
  const v = drafted.get(ref);
  if (!v || !v.text?.trim()) add(ref, "style", "error", "Verse missing from the draft.");
}

// --- glossary, names, style ---------------------------------------------------
const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
for (const v of draft.verses) {
  const strongs = new Set((original.get(v.ref) ?? []).map((w) => w.strongs).filter(Boolean));
  for (const t of glossary.terms) {
    if (!strongs.has(t.strongs)) continue;
    const ok = t.es.some((e) => (e !== e.toLowerCase() ? v.text.includes(e) : fold(v.text).includes(fold(e))));
    if (!ok) add(v.ref, "glossary", t.severity, `${t.strongs} ${t.lemma} should be rendered «${t.es.join("» / «")}».`, { strongs: t.strongs });
  }
  for (const n of glossary.names) {
    for (const bad of n.avoid) {
      const m = v.text.match(new RegExp(bad, "u"));
      if (m) add(v.ref, "names", "error", `Spell «${n.es}», not «${m[0]}».`);
    }
  }
  for (const f of glossary.forbidden) {
    if (new RegExp(f.pattern, "iu").test(v.text)) add(v.ref, "style", "error", f.message);
  }
}

// --- echo: shared runs of identical wording ------------------------------------
function longestRun(a, b) {
  // Longest common run of consecutive words.
  let best = 0;
  let at = -1;
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0;
      if (prev[j] > best) {
        best = prev[j];
        at = i;
      }
      diag = tmp;
    }
  }
  return { length: best, words: best ? a.slice(at - best, at).join(" ") : "" };
}

const publicRefs = [{ name: "Reina-Valera 1909", copyrighted: false, verses: translationVerses("rv1909", book) }];
const privateRefs = referenceTexts(book);
const echoSummary = [];
for (const ref of [...publicRefs, ...privateRefs]) {
  let shared = 0;
  let longest = { length: 0 };
  for (const v of draft.verses) {
    const other = ref.verses.get(v.ref);
    if (!other) continue;
    const run = longestRun(words(v.text), words(other));
    if (run.length > longest.length) longest = { ...run, ref: v.ref };
    if (run.length >= 8) {
      shared++;
      add(v.ref, "echo", ref.copyrighted ? "warn" : "info", `${run.length} words in a row identical to ${ref.name}: «${run.words}»${ref.copyrighted ? " — reword unless the phrasing is unavoidable." : " (public domain — allowed)."}`, { reference: ref.name, length: run.length });
    }
  }
  echoSummary.push({ name: ref.name, copyrighted: ref.copyrighted, versesWithLongRuns: shared, longest });
}

// --- AI: back-translation + benchmark against the BSB ---------------------------
const CHECK_SCHEMA = {
  type: "object",
  properties: {
    verses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ref: { type: "string" },
          back: { type: "string" },
          issues: { type: "array", items: { type: "object", properties: { severity: { type: "string", enum: ["error", "warn", "info"] }, message: { type: "string" } }, required: ["severity", "message"] } },
        },
        required: ["ref", "back", "issues"],
      },
    },
  },
  required: ["verses"],
};
if (useAI) {
  const bsb = translationVerses("bsb", book);
  const model = process.env.VT_CHECK_MODEL ?? MODEL();
  const system = `You review a draft Spanish Bible translation made directly from the ${book < 39 ? "Hebrew" : "Greek"}. For each verse:
1. Translate the Spanish draft back into English as literally as possible (do not look at or copy the BSB for this).
2. Compare the meaning of the draft with the original-language words and with the Berean Standard Bible (BSB), a trusted reference.
3. Report only real differences in MEANING: something added, left out, mistranslated, or a choice the BSB and most scholars would dispute. Not style.
Severity: "error" = wrong meaning, "warn" = questionable or missing nuance, "info" = defensible difference worth a note.
Submit the result with the submit tool: one entry per verse with ref ("c:v"), back (the back-translation) and issues (empty if none).`;
  const refs = draft.verses.map((v) => v.ref);
  for (let i = 0; i < refs.length; i += 15) {
    const chunk = refs.slice(i, i + 15);
    const prompt = chunk
      .map((ref) => {
        const orig = (original.get(ref) ?? []).map((w) => `${w.text}[${w.strongs ?? "-"}${w.strongs ? ":" + (lexiconEntry(w.strongs)?.kjv ?? "").slice(0, 25) : ""}]`).join(" ");
        return `### ${ref}\nORIGINAL: ${orig}\nBSB: ${bsb.get(ref) ?? "(missing)"}\nDRAFT: ${drafted.get(ref)?.text ?? ""}`;
      })
      .join("\n\n");
    process.stdout.write(`benchmark ${chunk[0]}–${chunk[chunk.length - 1]}… `);
    const out = await claudeJSON({ system, prompt, model, schema: CHECK_SCHEMA, maxTokens: 8000 });
    for (const v of out.verses ?? []) {
      if (!chunk.includes(v.ref)) continue;
      add(v.ref, "backtranslation", "info", v.back, { model });
      for (const issue of v.issues ?? []) add(v.ref, "benchmark", ["error", "warn", "info"].includes(issue.severity) ? issue.severity : "warn", issue.message, { model, bsb: bsb.get(v.ref) });
    }
    console.log("ok");
  }
}

// --- write -------------------------------------------------------------------------
const outDir = path.join(vtDir, "reports");
mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${slug(book)}.checks.json`);
writeFileSync(file, JSON.stringify({ book, draftAuthor: draft.author, created: new Date().toISOString(), ai: useAI, echo: echoSummary, checks }, null, 2) + "\n");

const count = (s) => checks.filter((c) => c.severity === s && c.kind !== "backtranslation").length;
const md = [
  `# Versión Testigo — ${OSIS[book]}: check report`,
  "",
  `Draft by \`${draft.author}\` on ${draft.created}. Checked ${new Date().toISOString().slice(0, 10)}${useAI ? " with back-translation and BSB comparison" : " (rule checks only; run with --ai for the BSB comparison)"}.`,
  "",
  `**${draft.verses.length} verses · ${count("error")} errors · ${count("warn")} warnings · ${count("info")} notes**`,
  "",
  "## Shared wording with other translations",
  "",
  ...echoSummary.map((e) => `- ${e.name}${e.copyrighted ? " (copyrighted)" : " (public domain)"}: ${e.versesWithLongRuns} verses share 8+ words in a row; longest run ${e.longest.length} words${e.longest.ref ? ` at ${e.longest.ref}` : ""}.`),
  privateRefs.length ? "" : "- No copyrighted reference texts loaded, so the echo check against modern versions did not run. See README.md.",
  "",
  "## By verse",
  "",
  ...draft.verses.flatMap((v) => {
    const mine = checks.filter((c) => c.ref === v.ref);
    if (!mine.length) return [];
    return [`### ${v.ref}`, "", `> ${v.text}`, "", ...mine.map((c) => (c.kind === "backtranslation" ? `- back-translation: _${c.message}_` : `- **${c.severity}** · ${c.kind}: ${c.message}`)), ""];
  }),
].join("\n");
writeFileSync(path.join(outDir, `${slug(book)}.md`), md + "\n");
console.log(`${count("error")} errors, ${count("warn")} warnings, ${count("info")} notes → translation/vt/reports/${slug(book)}.md`);
