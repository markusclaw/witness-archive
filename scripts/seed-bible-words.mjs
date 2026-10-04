#!/usr/bin/env node
/**
 * Load the word-level data for the originals (scripts/bible-data/words-*.json.gz)
 * and the Strong's lexicon into Supabase. Run migration 025 first, and
 * scripts/seed-bible.mjs before this (the words reference the wlc/sblgnt rows).
 *
 *   node scripts/seed-bible-words.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
 * environment or .env.local. About 440,000 rows; a few minutes. Re-runnable.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dataDir = path.join(root, "scripts", "bible-data");
const envFile = path.join(root, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or put them in .env.local).");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const load = (f) => JSON.parse(gunzipSync(readFileSync(path.join(dataDir, f))).toString("utf8"));

async function upsertBatches(table, rows, onConflict, label) {
  const BATCH = 1000;
  const started = Date.now();
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    let attempt = 0;
    for (;;) {
      const { error } = await supabase.from(table).upsert(slice, { onConflict });
      if (!error) break;
      if (++attempt >= 4) {
        console.error(`\n${label}: batch at ${i} failed: ${error.message}`);
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
    process.stdout.write(`\r${label}: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  console.log(`\r${label}: ${rows.length} rows in ${Math.round((Date.now() - started) / 1000)}s   `);
}

// Words first, counting occurrences per Strong's number as we go.
const occurrences = new Map();
for (const code of ["wlc", "sblgnt"]) {
  const { words } = load(`words-${code}.json.gz`);
  const rows = words.map(([book, chapter, verse, position, text, strongs, morph, lemma]) => {
    if (strongs) occurrences.set(strongs, (occurrences.get(strongs) ?? 0) + 1);
    return { translation: code, book, chapter, verse, position, text, strongs: strongs ?? null, morph, lemma: lemma ?? null };
  });
  const { count } = await supabase.from("bible_words").select("*", { count: "exact", head: true }).eq("translation", code);
  if (count === rows.length) {
    console.log(`${code} words: already loaded (${count}), skipping`);
    continue;
  }
  await upsertBatches("bible_words", rows, "translation,book,chapter,verse,position", `${code} words`);
}

const { entries } = load("lexicon.json.gz");
const lex = entries.map(([id, lemma, translit, pronunciation, definition, kjv_def, derivation]) => ({ id, lemma, translit, pronunciation, definition, kjv_def, derivation, occurrences: occurrences.get(id) ?? 0 }));
await upsertBatches("bible_lexicon", lex, "id", "lexicon");
console.log("done");
