/**
 * The Open Bible Translation is published in editions, one per language,
 * each translated directly from the Hebrew and Greek. Everything the pages
 * say is here, so a new language is one more entry (plus its layout).
 */

export type EditionCode = "obt" | "vt";

export interface Edition {
  code: EditionCode;
  /** Reader language. */
  lang: "en" | "es";
  name: string;
  short: string;
  path: string;
  /** Path of the about page. */
  about: string;
  ui: {
    draftNote: (original: string) => string;
    hebrew: string;
    greek: string;
    tapWord: string;
    chapters: string;
    chapter: (n: number) => string;
    verseOpen: (n: number) => string;
    notesOf: (c: number) => string;
    reviewHistory: string;
    close: string;
    notLoaded: string;
    bookFooter: string;
    aboutLink: string;
    reviewLink: string;
    readerLink: string;
    otherEdition: string;
    status: Record<"draft" | "reviewed" | "approved", string>;
    kind: Record<"ai_draft" | "edit" | "review" | "approval", string>;
    noteType: Record<string, string>;
    review: {
      title: string;
      intro: (original: string) => string;
      reader: string;
      original: string;
      bsb: string;
      back: string;
      history: (n: number) => string;
      ai: (model: string) => string;
      olderVersion: string;
      severity: Record<"error" | "warn" | "info", string>;
      checkKind: Record<string, string>;
      sources: (book: string) => string;
    };
    banner: { draft: string; body: (original: string) => string; link: string };
  };
}

const ORIGINAL_EN = (he: boolean) => (he ? "Hebrew" : "Greek");
const ORIGINAL_ES = (he: boolean) => (he ? "hebreo" : "griego");

export const EDITIONS: Record<EditionCode, Edition> = {
  obt: {
    code: "obt",
    lang: "en",
    name: "Open Bible Translation",
    short: "OBT",
    path: "/bible/obt",
    about: "/bible/obt/about",
    ui: {
      draftNote: (o) => `Unreviewed draft, translated with the help of AI. Tap a verse number to see the original ${o} and the meaning of each word.`,
      hebrew: "Hebrew",
      greek: "Greek",
      tapWord: "tap a word",
      chapters: "Chapters",
      chapter: (n) => `Chapter ${n}`,
      verseOpen: (n) => `Verse ${n}: see the original`,
      notesOf: (c) => `Notes on chapter ${c}`,
      reviewHistory: "Review & history →",
      close: "Close",
      notLoaded: "The text hasn't been loaded yet.",
      bookFooter: "The Open Bible Translation is an open translation in progress, made from the Hebrew and Greek with the help of AI and reviewed by people.",
      aboutLink: "About the project",
      reviewLink: "Verse-by-verse review",
      readerLink: "Open in the reader",
      otherEdition: "Leer en español: Versión Testigo",
      status: { draft: "Draft", reviewed: "Reviewed", approved: "Approved" },
      kind: { ai_draft: "AI draft", edit: "Correction", review: "Review", approval: "Approval" },
      noteType: { alternative: "Alternative", text: "Text", meaning: "Meaning", measure: "Measure" },
      review: {
        title: "review",
        intro: (o) => `For each verse: the current text and its status, the translator's notes, the original ${o} (tap any word for its root and meaning), the Berean Standard Bible as a reference, the automatic checks, and the full history.`,
        reader: "Read in the reader →",
        original: "",
        bsb: "BSB:",
        back: "Back into English:",
        history: (n) => `History · ${n} ${n === 1 ? "entry" : "entries"}`,
        ai: (m) => `AI (${m})`,
        olderVersion: " · on an earlier version",
        severity: { error: "Error", warn: "Check", info: "Note" },
        checkKind: { glossary: "glossary", names: "names", style: "style", echo: "shared wording", benchmark: "compared with BSB" },
        sources: (b) => `${b}: Hebrew text from the Leningrad Codex (public domain); English reference: Berean Standard Bible (public domain).`,
      },
      banner: {
        draft: "Draft · Open Bible Translation.",
        body: (o) => `Translated from the ${o} with the help of AI; not yet reviewed by specialists.`,
        link: "See the notes, revisions and history of each verse →",
      },
    },
  },
  vt: {
    code: "vt",
    lang: "es",
    name: "Versión Testigo",
    short: "VT",
    path: "/bible/vt",
    about: "/bible/vt/acerca",
    ui: {
      draftNote: (o) => `Borrador sin revisar, traducido con ayuda de IA. Toca el número de un versículo para ver el ${o} original y el significado de cada palabra.`,
      hebrew: "Hebreo",
      greek: "Griego",
      tapWord: "toca una palabra",
      chapters: "Capítulos",
      chapter: (n) => `Capítulo ${n}`,
      verseOpen: (n) => `Versículo ${n}: ver el original`,
      notesOf: (c) => `Notas del capítulo ${c}`,
      reviewHistory: "Revisión e historial →",
      close: "Cerrar",
      notLoaded: "El texto todavía no se ha cargado.",
      bookFooter: "La Versión Testigo es la edición en español de la Open Bible Translation: una traducción abierta en desarrollo, hecha desde el hebreo y el griego con ayuda de IA y revisión humana.",
      aboutLink: "Acerca del proyecto",
      reviewLink: "Revisión versículo por versículo",
      readerLink: "Abrir en el lector",
      otherEdition: "Read in English: Open Bible Translation",
      status: { draft: "Borrador", reviewed: "Revisado", approved: "Aprobado" },
      kind: { ai_draft: "Borrador de IA", edit: "Corrección", review: "Revisión", approval: "Aprobación" },
      noteType: { alternativa: "Alternativa", texto: "Texto", significado: "Significado", medida: "Medida" },
      review: {
        title: "revisión",
        intro: (o) => `Para cada versículo: el texto actual y su estado, las notas del traductor, el ${o} original (toca cualquier palabra para ver su raíz y significado), la Berean Standard Bible como referencia, las comprobaciones automáticas y el historial completo.`,
        reader: "Leer en el lector →",
        original: "",
        bsb: "BSB:",
        back: "De vuelta al inglés:",
        history: (n) => `Historial · ${n} ${n === 1 ? "entrada" : "entradas"}`,
        ai: (m) => `IA (${m})`,
        olderVersion: " · sobre una versión anterior",
        severity: { error: "Error", warn: "Revisar", info: "Nota" },
        checkKind: { glossary: "glosario", names: "nombres", style: "estilo", echo: "redacción compartida", benchmark: "contraste con BSB" },
        sources: (b) => `${b}: texto hebreo del Códice de Leningrado (dominio público); referencia en inglés: Berean Standard Bible (dominio público).`,
      },
      banner: {
        draft: "Borrador · Versión Testigo.",
        body: (o) => `Traducido del ${o} con ayuda de IA; todavía no ha sido revisado por especialistas.`,
        link: "Ver notas, revisiones e historial de cada versículo →",
      },
    },
  },
};

export function originalName(edition: Edition, book: number): string {
  return edition.lang === "es" ? ORIGINAL_ES(book < 39) : ORIGINAL_EN(book < 39);
}

export function editionFor(code: string | undefined | null): Edition | null {
  return code && code in EDITIONS ? EDITIONS[code as EditionCode] : null;
}
