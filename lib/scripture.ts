/**
 * Scripture references: find them in free text ("John 3:16", "Salmos 23",
 * "1 Co 13.4-7") and resolve them to book/chapter/verse so the verse can be
 * fetched in the reader's language. Pure functions, safe on client and server.
 */

export interface Book {
  /** Canonical index, Genesis = 0. Matches `bible_verses.book`. */
  index: number;
  osis: string;
  chapters: number;
  /** Display name per language. */
  names: Record<string, string>;
  /** Every spelling that should match, in any language, lower-case, accents stripped. */
  aliases: string[];
}

export interface Reference {
  book: number;
  chapter: number;
  verse?: number;
  /** Last verse of a range (same chapter unless `chapterEnd` is set). */
  verseEnd?: number;
  chapterEnd?: number;
}

export interface ReferenceMatch extends Reference {
  start: number;
  end: number;
  text: string;
}

/** Translation used for each reader language. */
export const TRANSLATION_FOR_LANGUAGE: Record<string, { code: string; name: string }> = {
  en: { code: "web", name: "World English Bible" },
  es: { code: "rv1909", name: "Reina-Valera 1909" },
  pt: { code: "aa", name: "Almeida Atualizada" },
};

export function translationFor(language: string): { code: string; name: string; language: string } {
  const t = TRANSLATION_FOR_LANGUAGE[language] ?? TRANSLATION_FOR_LANGUAGE.en;
  return { ...t, language: TRANSLATION_FOR_LANGUAGE[language] ? language : "en" };
}

// osis, chapters, en, es, pt, extra aliases (abbreviations in any language)
type Row = [string, number, string, string, string, string[]];
const ROWS: Row[] = [
  ["Gen", 50, "Genesis", "Génesis", "Gênesis", ["gen", "gn"]],
  ["Exod", 40, "Exodus", "Éxodo", "Êxodo", ["exod", "exo", "éx"]],
  ["Lev", 27, "Leviticus", "Levítico", "Levítico", ["lev", "lv"]],
  ["Num", 36, "Numbers", "Números", "Números", ["num", "nm", "nu", "nú"]],
  ["Deut", 34, "Deuteronomy", "Deuteronomio", "Deuteronômio", ["deut", "deu", "dt"]],
  ["Josh", 24, "Joshua", "Josué", "Josué", ["josh", "jos"]],
  ["Judg", 21, "Judges", "Jueces", "Juízes", ["judg", "jdg", "jue", "jz", "jgs"]],
  ["Ruth", 4, "Ruth", "Rut", "Rute", ["rut", "rt"]],
  ["1Sam", 31, "1 Samuel", "1 Samuel", "1 Samuel", ["1 sam", "1 sa", "1sam", "1sa", "i samuel", "first samuel", "primera de samuel", "1 sm"]],
  ["2Sam", 24, "2 Samuel", "2 Samuel", "2 Samuel", ["2 sam", "2 sa", "2sam", "2sa", "ii samuel", "second samuel", "segunda de samuel", "2 sm"]],
  ["1Kgs", 22, "1 Kings", "1 Reyes", "1 Reis", ["1 kgs", "1 ki", "1 kin", "1kgs", "1 re", "1 rs", "1 rey", "i kings", "first kings"]],
  ["2Kgs", 25, "2 Kings", "2 Reyes", "2 Reis", ["2 kgs", "2 ki", "2 kin", "2kgs", "2 re", "2 rs", "2 rey", "ii kings", "second kings"]],
  ["1Chr", 29, "1 Chronicles", "1 Crónicas", "1 Crônicas", ["1 chr", "1 ch", "1 chron", "1chr", "1 cr", "1 cro", "i chronicles", "first chronicles"]],
  ["2Chr", 36, "2 Chronicles", "2 Crónicas", "2 Crônicas", ["2 chr", "2 ch", "2 chron", "2chr", "2 cr", "2 cro", "ii chronicles", "second chronicles"]],
  ["Ezra", 10, "Ezra", "Esdras", "Esdras", ["ezr", "esd"]],
  ["Neh", 13, "Nehemiah", "Nehemías", "Neemias", ["neh"]],
  ["Esth", 10, "Esther", "Ester", "Ester", ["esth", "est"]],
  ["Job", 42, "Job", "Job", "Jó", ["jb"]],
  ["Ps", 150, "Psalms", "Salmos", "Salmos", ["psalm", "ps", "psa", "pss", "psm", "salmo", "sal", "sl", "slm"]],
  ["Prov", 31, "Proverbs", "Proverbios", "Provérbios", ["prov", "pro", "pr", "prv", "pv"]],
  ["Eccl", 12, "Ecclesiastes", "Eclesiastés", "Eclesiastes", ["eccl", "ecc", "ec", "ecl", "qoheleth"]],
  ["Song", 8, "Song of Solomon", "Cantares", "Cânticos", ["song of songs", "song", "sos", "cantar de los cantares", "cantares", "cant", "cnt", "ct", "cântico dos cânticos", "canticos"]],
  ["Isa", 66, "Isaiah", "Isaías", "Isaías", ["isa"]],
  ["Jer", 52, "Jeremiah", "Jeremías", "Jeremias", ["jer", "je", "jr"]],
  ["Lam", 5, "Lamentations", "Lamentaciones", "Lamentações", ["lam", "la", "lm"]],
  ["Ezek", 48, "Ezekiel", "Ezequiel", "Ezequiel", ["ezek", "eze", "ez", "ezq"]],
  ["Dan", 12, "Daniel", "Daniel", "Daniel", ["dan", "dn"]],
  ["Hos", 14, "Hosea", "Oseas", "Oséias", ["hos", "oseias"]],
  ["Joel", 3, "Joel", "Joel", "Joel", ["jl", "joe"]],
  ["Amos", 9, "Amos", "Amós", "Amós", ["amo"]],
  ["Obad", 1, "Obadiah", "Abdías", "Obadias", ["obad", "oba", "ob", "abd", "abdias"]],
  ["Jonah", 4, "Jonah", "Jonás", "Jonas", ["jon", "jnh", "jns"]],
  ["Mic", 7, "Micah", "Miqueas", "Miquéias", ["mic", "miq", "miqueias"]],
  ["Nah", 3, "Nahum", "Nahúm", "Naum", ["nah", "nahum"]],
  ["Hab", 3, "Habakkuk", "Habacuc", "Habacuque", ["hab", "hb", "hc"]],
  ["Zeph", 3, "Zephaniah", "Sofonías", "Sofonias", ["zeph", "zep", "zp", "sof", "sf"]],
  ["Hag", 2, "Haggai", "Hageo", "Ageu", ["hag", "hg"]],
  ["Zech", 14, "Zechariah", "Zacarías", "Zacarias", ["zech", "zec", "zc", "zac", "za"]],
  ["Mal", 4, "Malachi", "Malaquías", "Malaquias", ["mal", "ml"]],
  ["Matt", 28, "Matthew", "Mateo", "Mateus", ["matt", "mat", "mt", "mateo"]],
  ["Mark", 16, "Mark", "Marcos", "Marcos", ["mark", "mrk", "mk", "mc", "mar"]],
  ["Luke", 24, "Luke", "Lucas", "Lucas", ["luk", "lk", "lc", "luc"]],
  ["John", 21, "John", "Juan", "João", ["jhn", "jn", "joh", "joao"]],
  ["Acts", 28, "Acts", "Hechos", "Atos", ["act", "hch", "hech", "hechos de los apóstoles", "atos dos apóstolos"]],
  ["Rom", 16, "Romans", "Romanos", "Romanos", ["rom", "ro", "rm"]],
  ["1Cor", 16, "1 Corinthians", "1 Corintios", "1 Coríntios", ["1 cor", "1 co", "1cor", "1co", "i corinthians", "first corinthians", "1 corinthians", "1 corintios"]],
  ["2Cor", 13, "2 Corinthians", "2 Corintios", "2 Coríntios", ["2 cor", "2 co", "2cor", "2co", "ii corinthians", "second corinthians", "2 corinthians", "2 corintios"]],
  ["Gal", 6, "Galatians", "Gálatas", "Gálatas", ["gal", "gl"]],
  ["Eph", 6, "Ephesians", "Efesios", "Efésios", ["eph", "ep", "ef", "efe"]],
  ["Phil", 4, "Philippians", "Filipenses", "Filipenses", ["phil", "php", "pp", "fil", "flp", "fp"]],
  ["Col", 4, "Colossians", "Colosenses", "Colossenses", ["col", "cl"]],
  ["1Thess", 5, "1 Thessalonians", "1 Tesalonicenses", "1 Tessalonicenses", ["1 thess", "1 thes", "1 th", "1thess", "1 ts", "1 tes", "1 tess", "i thessalonians", "first thessalonians"]],
  ["2Thess", 3, "2 Thessalonians", "2 Tesalonicenses", "2 Tessalonicenses", ["2 thess", "2 thes", "2 th", "2thess", "2 ts", "2 tes", "2 tess", "ii thessalonians", "second thessalonians"]],
  ["1Tim", 6, "1 Timothy", "1 Timoteo", "1 Timóteo", ["1 tim", "1 ti", "1tim", "1 tm", "i timothy", "first timothy"]],
  ["2Tim", 4, "2 Timothy", "2 Timoteo", "2 Timóteo", ["2 tim", "2 ti", "2tim", "2 tm", "ii timothy", "second timothy"]],
  ["Titus", 3, "Titus", "Tito", "Tito", ["tit", "tt"]],
  ["Phlm", 1, "Philemon", "Filemón", "Filemom", ["phlm", "phm", "flm", "fm", "filemon"]],
  ["Heb", 13, "Hebrews", "Hebreos", "Hebreus", ["heb", "hb"]],
  ["Jas", 5, "James", "Santiago", "Tiago", ["jas", "jm", "stg", "sant", "tg", "tia"]],
  ["1Pet", 5, "1 Peter", "1 Pedro", "1 Pedro", ["1 pet", "1 pe", "1 pt", "1pet", "1 ped", "i peter", "first peter"]],
  ["2Pet", 3, "2 Peter", "2 Pedro", "2 Pedro", ["2 pet", "2 pe", "2 pt", "2pet", "2 ped", "ii peter", "second peter"]],
  ["1John", 5, "1 John", "1 Juan", "1 João", ["1 jn", "1 jo", "1 jhn", "1john", "1jn", "i john", "first john", "1 joao"]],
  ["2John", 1, "2 John", "2 Juan", "2 João", ["2 jn", "2 jo", "2 jhn", "2john", "2jn", "ii john", "second john", "2 joao"]],
  ["3John", 1, "3 John", "3 Juan", "3 João", ["3 jn", "3 jo", "3 jhn", "3john", "3jn", "iii john", "third john", "3 joao"]],
  ["Jude", 1, "Jude", "Judas", "Judas", ["jud", "jd"]],
  ["Rev", 22, "Revelation", "Apocalipsis", "Apocalipse", ["revelations", "rev", "apoc", "apocalipsis"]],
];

/** Lower-case and strip accents so "Génesis", "Genesis" and "GENESIS" all match. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export const BOOKS: Book[] = ROWS.map(([osis, chapters, en, es, pt, extra], index) => {
  const aliases = new Set<string>([en, es, pt, ...extra].map(fold));
  return { index, osis, chapters, names: { en, es, pt }, aliases: [...aliases] };
});

/** Books whose single-word name is also an ordinary word or first name; a bare chapter ("Mark 3") is not treated as a reference. */
const NEEDS_VERSE = new Set(["Mark", "John", "Jas", "Jude", "Job", "Num", "Judg", "Ruth", "Joel", "Amos", "Acts", "Dan", "Jonah", "Esth", "Titus", "Phlm", "Nah", "Song", "Hos", "Mic", "Hag"]);
/** Short abbreviations are only trusted when followed by chapter:verse. */
const SHORT_ABBR_MAX = 3;

/** Aliases are stored accent-free; let the text carry accents ("João", "Génesis") and fold only the match. */
const ACCENTS: Record<string, string> = { a: "[aáàâãä]", e: "[eéèêë]", i: "[iíìîï]", o: "[oóòôõö]", u: "[uúùûü]", c: "[cç]" };

const aliasToBook = new Map<string, Book>();
for (const b of BOOKS) for (const a of b.aliases) aliasToBook.set(a, b);
/** Longest aliases first so "1 John" wins over "John" and "Song of Solomon" over "Song". */
const ALIAS_PATTERN = [...aliasToBook.keys()]
  .sort((a, b) => b.length - a.length)
  .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*").replace(/[aeiouc]/g, (ch) => ACCENTS[ch]))
  .join("|");

// book  chapter  [sep verse [- verseEnd | - chapterEnd:verseEnd]]
const REF_RE = new RegExp(
  `(?<![\\p{L}\\d])(${ALIAS_PATTERN})\\.?\\s*(\\d{1,3})(?:\\s*[:.]\\s*(\\d{1,3})[abc]?(?:\\s*[-–—]\\s*(\\d{1,3})(?:\\s*[:.]\\s*(\\d{1,3}))?)?)?(?![\\p{L}\\d])`,
  "giu"
);

/** Every scripture reference in a text, in order, with its position. */
export function findReferences(text: string): ReferenceMatch[] {
  const out: ReferenceMatch[] = [];
  REF_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = REF_RE.exec(text))) {
    const alias = fold(m[1].replace(/\s+/g, " "));
    const book = aliasToBook.get(alias) ?? aliasToBook.get(alias.replace(/\s+/g, ""));
    if (!book) continue;
    const chapter = Number(m[2]);
    if (chapter < 1 || chapter > book.chapters) continue;
    const ref: ReferenceMatch = { book: book.index, chapter, start: m.index, end: m.index + m[0].length, text: m[0] };
    if (m[3]) {
      ref.verse = Number(m[3]);
      if (m[5]) {
        ref.chapterEnd = Number(m[4]);
        ref.verseEnd = Number(m[5]);
        if (ref.chapterEnd < chapter || ref.chapterEnd > book.chapters) continue;
      } else if (m[4]) {
        ref.verseEnd = Number(m[4]);
        if (ref.verseEnd < ref.verse) continue;
      }
    } else {
      // Chapter only: be conservative with ambiguous names and terse abbreviations.
      if (NEEDS_VERSE.has(book.osis) || alias.replace(/\s/g, "").length <= SHORT_ABBR_MAX) continue;
    }
    // "my job 3:16 shift", "mark 3:00": ambiguous names count only when written as a name.
    if (NEEDS_VERSE.has(book.osis) && !/^\d?\s*\p{Lu}/u.test(m[1])) continue;
    out.push(ref);
  }
  return out;
}

/** Deduplicated references in reading order (for the "Scripture in this testimony" strip). */
export function uniqueReferences(text: string): Reference[] {
  const seen = new Set<string>();
  const out: Reference[] = [];
  for (const r of findReferences(text)) {
    const key = referenceKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ book: r.book, chapter: r.chapter, verse: r.verse, verseEnd: r.verseEnd, chapterEnd: r.chapterEnd });
  }
  return out;
}

/** Compact key, also the `ref` query value: "42.3.16", "42.3.16-18", "42.3.16-4.2", "18.23". */
export function referenceKey(r: Reference): string {
  let k = `${r.book}.${r.chapter}`;
  if (r.verse != null) {
    k += `.${r.verse}`;
    if (r.chapterEnd != null && r.verseEnd != null) k += `-${r.chapterEnd}.${r.verseEnd}`;
    else if (r.verseEnd != null) k += `-${r.verseEnd}`;
  }
  return k;
}

export function parseReferenceKey(key: string): Reference | null {
  const m = /^(\d{1,2})\.(\d{1,3})(?:\.(\d{1,3})(?:-(?:(\d{1,3})\.)?(\d{1,3}))?)?$/.exec(key.trim());
  if (!m) return null;
  const book = Number(m[1]);
  if (book < 0 || book > 65) return null;
  const r: Reference = { book, chapter: Number(m[2]) };
  if (m[3]) r.verse = Number(m[3]);
  if (m[5]) {
    r.verseEnd = Number(m[5]);
    if (m[4]) r.chapterEnd = Number(m[4]);
  }
  return r;
}

/** "John 3:16–18" in the given language. */
export function formatReference(r: Reference, language = "en"): string {
  const book = BOOKS[r.book];
  let name = book.names[language] ?? book.names.en;
  // One psalm is "Psalm 23", not "Psalms 23".
  if (book.osis === "Ps" && r.chapterEnd == null) name = { en: "Psalm", es: "Salmo", pt: "Salmo" }[language] ?? name;
  let s = `${name} ${r.chapter}`;
  if (r.verse != null) {
    s += `:${r.verse}`;
    if (r.chapterEnd != null && r.verseEnd != null) s += `–${r.chapterEnd}:${r.verseEnd}`;
    else if (r.verseEnd != null) s += `–${r.verseEnd}`;
  }
  return s;
}

/** Any language text with at least one reference? Cheap check before rendering linkified text. */
export function hasReference(text: string): boolean {
  return findReferences(text).length > 0;
}

/** URL slug for a book: its OSIS id, lower-case ("gen", "1cor", "john"). */
export function bookSlug(book: Book | number): string {
  return (typeof book === "number" ? BOOKS[book] : book).osis.toLowerCase();
}

export function bookBySlug(slug: string): Book | undefined {
  const s = fold(slug).replace(/[^a-z0-9]/g, "");
  return BOOKS.find((b) => b.osis.toLowerCase() === s) ?? aliasToBook.get(s) ?? [...aliasToBook.entries()].find(([a]) => a.replace(/\s/g, "") === s)?.[1];
}

/** Reader page for a reference: /bible/john/3?v=16-18&lang=es */
export function chapterPath(r: Reference, language?: string): string {
  const q = new URLSearchParams();
  if (r.verse != null) q.set("v", r.verseEnd != null && r.chapterEnd == null ? `${r.verse}-${r.verseEnd}` : String(r.verse));
  if (language && language !== "en" && TRANSLATION_FOR_LANGUAGE[language]) q.set("lang", language);
  const s = q.toString();
  return `/bible/${bookSlug(r.book)}/${r.chapter}${s ? `?${s}` : ""}`;
}

/** Old Testament is the first 39 books. */
export const OT_COUNT = 39;

export const BIBLE_UI: Record<string, { bible: string; ot: string; nt: string; chapters: string; chapter: string; prev: string; next: string; readIn: string; openChapter: string; notLoaded: string; verses: string; mentions: string; mentionsNone: string; mentioned: (n: number) => string }> = {
  en: { bible: "The Bible", ot: "Old Testament", nt: "New Testament", chapters: "Chapters", chapter: "Chapter", prev: "Previous", next: "Next", readIn: "Read in", openChapter: "Open chapter", notLoaded: "The scripture texts haven't been loaded yet.", verses: "verses", mentions: "Testimonies that mention this chapter", mentionsNone: "No testimony in the archive mentions this chapter yet.", mentioned: (n) => `${n} ${n === 1 ? "testimony" : "testimonies"}` },
  es: { bible: "La Biblia", ot: "Antiguo Testamento", nt: "Nuevo Testamento", chapters: "Capítulos", chapter: "Capítulo", prev: "Anterior", next: "Siguiente", readIn: "Leer en", openChapter: "Abrir capítulo", notLoaded: "Los textos bíblicos aún no se han cargado.", verses: "versículos", mentions: "Testimonios que mencionan este capítulo", mentionsNone: "Ningún testimonio del archivo menciona este capítulo todavía.", mentioned: (n) => `${n} ${n === 1 ? "testimonio" : "testimonios"}` },
  pt: { bible: "A Bíblia", ot: "Antigo Testamento", nt: "Novo Testamento", chapters: "Capítulos", chapter: "Capítulo", prev: "Anterior", next: "Próximo", readIn: "Ler em", openChapter: "Abrir capítulo", notLoaded: "Os textos bíblicos ainda não foram carregados.", verses: "versículos", mentions: "Testemunhos que mencionam este capítulo", mentionsNone: "Nenhum testemunho do arquivo menciona este capítulo ainda.", mentioned: (n) => `${n} ${n === 1 ? "testemunho" : "testemunhos"}` },
};
