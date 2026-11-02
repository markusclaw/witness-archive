#!/usr/bin/env node
/**
 * Export the Open Bible Translation (every edition, every book in the
 * database) into the open repository, as plain JSON anyone can use.
 *
 *   node scripts/vt/export.mjs                          # writes ../open-bible-translation
 *   node scripts/vt/export.mjs ~/code/open-bible-translation
 *
 * What it writes (the "v1" API — once pushed to GitHub it is served free at
 * https://cdn.jsdelivr.net/gh/gregindeed/open-bible-translation@main/v1/...):
 *
 *   v1/editions.json                 every edition and its books
 *   v1/<edition>/<book>.json         a whole book
 *   v1/<edition>/<book>/<n>.json     one chapter
 *   v1/<edition>/<book>/history.json every revision of every verse
 *   editions/<edition>/STYLE.md, glossary.json, CHANGELOG.md
 *   README.md, LICENSE
 *
 * The current text is read from the database (latest revision of each
 * verse), so reviewers' corrections are included. Needs
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { EDITIONS, OSIS, root, supabase } from "./lib.mjs";

const REPO = "gregindeed/open-bible-translation";
const CDN = `https://cdn.jsdelivr.net/gh/${REPO}@main`;
const LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";
const out = path.resolve((process.argv[2] ?? path.join(root, "..", "open-bible-translation")).replace(/^~(?=$|\/)/, os.homedir()));
const today = new Date().toISOString().slice(0, 10);

// Book names in each language, read from the site's own table (lib/scripture.ts).
const NAMES = new Map();
for (const m of readFileSync(path.join(root, "lib", "scripture.ts"), "utf8").matchAll(/\["(\w+)", (\d+), "([^"]+)", "([^"]+)", "([^"]+)"/g)) {
  NAMES.set(m[1], { chapters: Number(m[2]), en: m[3], es: m[4] });
}

const ATTRIBUTION = {
  obt: "Open Bible Translation (OBT), github.com/gregindeed/open-bible-translation — CC BY-SA 4.0",
  vt: "Versión Testigo (VT), edición en español de la Open Bible Translation, github.com/gregindeed/open-bible-translation — CC BY-SA 4.0",
};
const SOURCES = {
  ot: "Westminster Leningrad Codex (public domain)",
  nt: "SBL Greek New Testament, © Society of Biblical Literature and Logos Bible Software (CC BY 4.0)",
};

const write = (rel, data) => {
  const p = path.join(out, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, typeof data === "string" ? data : JSON.stringify(data, null, 1) + "\n");
};

const db = await supabase();
const catalog = [];

for (const [code, ed] of Object.entries(EDITIONS)) {
  const { data: rows, error } = await db
    .from("translation_verses")
    .select("book, chapter, verse, text, notes, status, updated_at")
    .eq("translation", code)
    .order("book")
    .order("chapter")
    .order("verse")
    .limit(40000);
  if (error) throw new Error(`${code}: ${error.message}`);
  const books = [...new Set(rows.map((r) => r.book))];
  const entry = { code, name: ed.name, language: ed.language, license: "CC BY-SA 4.0", license_url: LICENSE_URL, attribution: ATTRIBUTION[code], status: "draft", books: [] };

  for (const book of books) {
    const osis = OSIS[book];
    const slug = osis.toLowerCase();
    const names = NAMES.get(osis) ?? { en: osis, es: osis };
    const vs = rows.filter((r) => r.book === book);
    const chapters = [...new Set(vs.map((v) => v.chapter))].map((c) => ({
      chapter: c,
      verses: vs.filter((v) => v.chapter === c).map((v) => ({ verse: v.verse, text: v.text, ...(v.notes?.length ? { notes: v.notes } : {}), status: v.status })),
    }));
    const updated = vs.reduce((m, v) => (v.updated_at > m ? v.updated_at : m), "").slice(0, 10);
    const counts = { draft: 0, reviewed: 0, approved: 0 };
    for (const v of vs) counts[v.status] = (counts[v.status] ?? 0) + 1;
    const head = {
      edition: code,
      edition_name: ed.name,
      language: ed.language,
      book: { index: book, osis, slug, name: ed.language === "es" ? names.es : names.en },
      source: book < 39 ? SOURCES.ot : SOURCES.nt,
      license: "CC BY-SA 4.0",
      license_url: LICENSE_URL,
      attribution: ATTRIBUTION[code],
      status: counts,
      updated,
    };
    write(`v1/${code}/${slug}.json`, { ...head, chapters });
    for (const ch of chapters) write(`v1/${code}/${slug}/${ch.chapter}.json`, { ...head, chapter: ch.chapter, verses: ch.verses });

    // Full history: every draft, correction, review and approval, with who and why.
    const { data: revs, error: rErr } = await db
      .from("translation_revisions")
      .select("chapter, verse, text, notes, kind, author, comment, created_at")
      .eq("translation", code)
      .eq("book", book)
      .order("chapter")
      .order("verse")
      .order("created_at")
      .limit(20000);
    if (rErr) throw new Error(`${code} history: ${rErr.message}`);
    write(`v1/${code}/${slug}/history.json`, { ...head, revisions: revs });

    entry.books.push({ ...head.book, chapters: chapters.length, verses: vs.length, status: counts, updated, url: `${CDN}/v1/${code}/${slug}.json` });
    console.log(`${code} ${osis}: ${vs.length} verses, ${chapters.length} chapters, ${revs.length} revisions`);
  }

  // Method documents for the edition.
  for (const f of ["STYLE.md", "glossary.json", "CHANGELOG.md", "README.md"]) {
    const src = path.join(root, "translation", code, f);
    if (existsSync(src)) {
      mkdirSync(path.join(out, "editions", code), { recursive: true });
      copyFileSync(src, path.join(out, "editions", code, f));
    }
  }
  catalog.push(entry);
}

write("v1/editions.json", { updated: today, api: `${CDN}/v1`, editions: catalog });

const bookList = catalog
  .map((e) => `- **${e.name}** (${e.language}): ${e.books.map((b) => `${b.name} (${b.verses} verses)`).join(", ") || "—"}`)
  .join("\n");

write(
  "README.md",
  `# Open Bible Translation

An open Bible translation made directly from the Hebrew and Greek, drafted with
AI, checked automatically, and reviewed by people — with the full history of
every verse in public. Free for anyone to use under
[CC BY-SA 4.0](${LICENSE_URL}).

**Status: draft.** Nothing here has been reviewed by the committee yet. Every
verse carries its status (\`draft\`, \`reviewed\`, \`approved\`).

## Editions

${bookList}

Read them online at [witness-archive.org/bible/obt](https://witness-archive.org/bible/obt)
(English) and [witness-archive.org/bible/vt](https://witness-archive.org/bible/vt) (Spanish).

## Free JSON API

No key, no sign-up. Files are served from GitHub through jsDelivr:

\`\`\`
${CDN}/v1/editions.json            all editions and books
${CDN}/v1/obt/mark.json            a whole book
${CDN}/v1/obt/mark/1.json          one chapter
${CDN}/v1/vt/ruth/1.json           Spanish (Versión Testigo)
${CDN}/v1/obt/mark/history.json    every revision, with who and why
\`\`\`

Each verse: \`{ "verse": 1, "text": "…", "notes": [{ "type": "meaning", "text": "…" }], "status": "draft" }\`.
Book files use the OSIS book id in lowercase (\`gen\`, \`ruth\`, \`mark\`, \`1cor\`, …).

## How it is made

1. **Drafted from the original.** An AI translates each verse from the
   Hebrew/Greek words alone, with Strong's numbers, grammar tags and
   dictionary glosses, following the public style guide and glossary in
   \`editions/<edition>/\`. It is never shown a published translation.
2. **Checked.** Glossary and name rules, style rules, a scan for wording
   copied from other Bibles, and a back-translation compared with the Berean
   Standard Bible (public domain).
3. **Reviewed by people.** Every correction is recorded with the reviewer's
   name and reason (\`history.json\`).

## Sources

- Old Testament: ${SOURCES.ot}
- New Testament: ${SOURCES.nt}
- Comparison only: Berean Standard Bible (public domain)

## License and attribution

The translation text, notes, style guides and glossaries are licensed under
[Creative Commons Attribution-ShareAlike 4.0 International](${LICENSE_URL}).
You may copy, share, adapt and build on them for any purpose, including
commercially, as long as you give credit and share changed versions under the
same license. Suggested credit:

> ${ATTRIBUTION.obt}

## Contributing

Found a mistake, or want to help review? Open an issue on this repository —
please give the verse, the problem and, where you can, the Hebrew or Greek
behind it.

---

This repository is generated from the Witness Archive translation pipeline
(\`scripts/vt/export.mjs\`). Last export: ${today}.
`,
);

write(
  "LICENSE",
  `Open Bible Translation — text, notes, style guides and glossaries

Copyright © ${new Date().getFullYear()} the Open Bible Translation contributors.

Licensed under the Creative Commons Attribution-ShareAlike 4.0 International
License (CC BY-SA 4.0). You are free to share and adapt this material for any
purpose, even commercially, under these terms:

  Attribution — give appropriate credit, provide a link to the license, and
  indicate if changes were made.
  ShareAlike — if you remix, transform, or build upon the material, you must
  distribute your contributions under the same license as the original.

Full legal code: https://creativecommons.org/licenses/by-sa/4.0/legalcode

Source texts: the Old Testament is translated from the Westminster Leningrad
Codex (public domain); the New Testament from the SBL Greek New Testament,
© Society of Biblical Literature and Logos Bible Software, used under CC BY 4.0.
`,
);

console.log(`\nWrote ${out}. Next: cd into it, then git add -A && git commit -m "Export ${today}" && git push`);
