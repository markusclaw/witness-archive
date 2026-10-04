#!/usr/bin/env node
/**
 * Load the public-domain Bible texts in scripts/bible-data/ into Supabase.
 *
 *   node scripts/seed-bible.mjs            # all translations
 *   node scripts/seed-bible.mjs web kjv    # just these
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
 * environment or from .env.local. Safe to re-run: rows are upserted, and a
 * translation whose verse count already matches is skipped.
 * Run migration 022 first.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dataDir = path.join(root, "scripts", "bible-data");

// Minimal .env.local loader so the script works without extra packages.
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

const wanted = process.argv.slice(2);
const files = readdirSync(dataDir).filter((f) => f.endsWith(".json.gz")).filter((f) => !wanted.length || wanted.includes(f.replace(".json.gz", "")));
if (!files.length) {
  console.error("No data files matched.");
  process.exit(1);
}

const BATCH = 1000;

for (const file of files) {
  const data = JSON.parse(gunzipSync(readFileSync(path.join(dataDir, file))).toString("utf8"));
  const { code, language, name, license, verses } = data;

  const { data: existing } = await supabase.from("bible_translations").select("verse_count").eq("code", code).maybeSingle();
  if (existing && existing.verse_count === verses.length) {
    console.log(`${code}: already seeded (${verses.length} verses), skipping`);
    continue;
  }

  const { error: tErr } = await supabase.from("bible_translations").upsert({ code, language, name, license }, { onConflict: "code" });
  if (tErr) {
    console.error(`${code}: could not upsert translation row: ${tErr.message}`);
    process.exit(1);
  }

  const started = Date.now();
  for (let i = 0; i < verses.length; i += BATCH) {
    const rows = verses.slice(i, i + BATCH).map(([book, chapter, verse, text]) => ({ translation: code, book, chapter, verse, text }));
    let attempt = 0;
    for (;;) {
      const { error } = await supabase.from("bible_verses").upsert(rows, { onConflict: "translation,book,chapter,verse" });
      if (!error) break;
      if (++attempt >= 4) {
        console.error(`${code}: batch at ${i} failed: ${error.message}`);
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
    process.stdout.write(`\r${code}: ${Math.min(i + BATCH, verses.length)}/${verses.length}`);
  }
  await supabase.from("bible_translations").update({ verse_count: verses.length, seeded_at: new Date().toISOString() }).eq("code", code);
  console.log(`\r${code}: ${verses.length} verses in ${Math.round((Date.now() - started) / 1000)}s   `);
}
console.log("done");
