/**
 * Shared helpers for the Versión Testigo pipeline (scripts/vt/*.mjs).
 * Everything reads local files where it can, so drafts and checks can run
 * and be reviewed before anything touches the database.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";

export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
/**
 * Which edition to work on: --t vt (Spanish, Versión Testigo — the default)
 * or --t obt (English, Open Bible Translation). The flag is removed from
 * process.argv so the scripts' own argument parsing doesn't see it.
 */
const tIndex = process.argv.indexOf("--t");
export const TRANSLATION = tIndex >= 0 ? process.argv[tIndex + 1] : "vt";
if (tIndex >= 0) process.argv.splice(tIndex, 2);
export const EDITIONS = {
  vt: { language: "es", languageName: "Spanish", name: "Versión Testigo", publicRefs: ["rv1909"] },
  obt: { language: "en", languageName: "English", name: "Open Bible Translation", publicRefs: ["kjv", "web", "bsb"] },
};
export const EDITION = EDITIONS[TRANSLATION];
if (!EDITION) throw new Error(`Unknown edition "${TRANSLATION}" — use --t vt or --t obt.`);
export const vtDir = path.join(root, "translation", TRANSLATION);
export const dataDir = path.join(root, "scripts", "bible-data");

// .env.local, without extra packages (same as the seed scripts).
const envFile = path.join(root, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

/** OSIS ids in canonical order; the index is our book number. */
export const OSIS = "Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev".split(" ");

export function bookIndex(arg) {
  if (/^\d+$/.test(arg)) return Number(arg);
  const i = OSIS.findIndex((o) => o.toLowerCase() === String(arg).toLowerCase());
  if (i < 0) throw new Error(`Unknown book "${arg}" — use an OSIS id like Ruth, Jonah, Mark.`);
  return i;
}

export function slug(book) {
  return OSIS[book].toLowerCase();
}

export function readGz(name) {
  return JSON.parse(gunzipSync(readFileSync(path.join(dataDir, `${name}.json.gz`))).toString("utf8"));
}

/** The original-language words of a book, keyed "c:v", in order. */
export function originalWords(book) {
  const code = book < 39 ? "wlc" : "sblgnt";
  const { words } = readGz(`words-${code}`);
  const out = new Map();
  for (const w of words) {
    if (w[0] !== book) continue;
    const k = `${w[1]}:${w[2]}`;
    if (!out.has(k)) out.set(k, []);
    out.get(k).push({ pos: w[3], text: w[4], strongs: w[5], morph: w[6], lemma: w[7] ?? null });
  }
  for (const list of out.values()) list.sort((a, b) => a.pos - b.pos);
  return out;
}

let lexicon;
export function lexiconEntry(id) {
  if (!lexicon) {
    lexicon = new Map();
    for (const e of readGz("lexicon").entries) lexicon.set(e[0], { id: e[0], lemma: e[1], translit: e[2], definition: e[4], kjv: e[5] });
  }
  return lexicon.get(id) ?? null;
}

/** A published translation's verses for a book, keyed "c:v" (benchmarks only). */
export function translationVerses(code, book) {
  const { verses } = readGz(code);
  const out = new Map();
  for (const [b, c, v, t] of verses) if (b === book) out.set(`${c}:${v}`, t);
  return out;
}

export function loadStyle() {
  return readFileSync(path.join(vtDir, "STYLE.md"), "utf8");
}

export function loadGlossary() {
  return JSON.parse(readFileSync(path.join(vtDir, "glossary.json"), "utf8"));
}

export function draftPath(book) {
  return path.join(vtDir, "drafts", `${slug(book)}.json`);
}

export function loadDraft(book) {
  const p = draftPath(book);
  if (!existsSync(p)) throw new Error(`No draft file at ${path.relative(root, p)}. Run draft.mjs first.`);
  return JSON.parse(readFileSync(p, "utf8"));
}

/** Private comparison texts for the echo check (gitignored; see README). */
export function referenceTexts(book) {
  const dir = path.join(vtDir, "reference");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const data = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
      const verses = new Map(Object.entries(data.verses ?? {}).filter(([k]) => k.startsWith(`${book}.`)).map(([k, t]) => [k.split(".").slice(1).join(":"), t]));
      return { name: data.name ?? f.replace(/\.json$/, ""), copyrighted: data.copyrighted !== false, verses };
    });
}

export async function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * One Claude call that must answer with structured data. The answer comes
 * back through a forced tool call, so it is always valid JSON matching
 * `schema` (free text can break on stray quotation marks). Retries twice.
 */
export async function claudeJSON({ system, prompt, model, schema, maxTokens = 2000 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Set ANTHROPIC_API_KEY in .env.local.");
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: prompt }],
          tools: [{ name: "submit", description: "Submit the result.", input_schema: schema }],
          tool_choice: { type: "tool", name: "submit" },
        }),
      });
      if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const body = await res.json();
      const call = body.content?.find((c) => c.type === "tool_use");
      if (!call) throw new Error("The model did not return a result.");
      if (body.stop_reason === "max_tokens") throw new Error("The answer was cut off (max_tokens).");
      return call.input;
    } catch (e) {
      lastError = e;
      if (attempt < 3) process.stdout.write(`(retrying: ${e.message.slice(0, 80)}) `);
    }
  }
  throw lastError;
}

export const MODEL = () => process.env.VT_MODEL ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

/** Accent-insensitive, punctuation-free words for comparisons. */
export function words(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Notes compared by content. Supabase (jsonb) stores object keys in its own
 * order, so {type, text} comes back as {text, type}; compare with sorted keys.
 */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value ?? null);
}

export function sameNotes(a, b) {
  return canonical(a ?? []) === canonical(b ?? []);
}
