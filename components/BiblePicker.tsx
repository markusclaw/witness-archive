"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BOOKS, OT_COUNT, bookSlug, chapterPath, findReferences, fold } from "@/lib/scripture";

/**
 * The "go anywhere" sheet for the Bible reader: type a reference ("jn 3:16",
 * "salmos 23"), or pick a book and then a chapter. Opens from the chapter
 * title and from the phone's bottom bar.
 */
export default function BiblePicker({ open, onClose, lang, book, chapter }: { open: boolean; onClose: () => void; lang: string; book: number; chapter: number }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const ui = UI[lang] ?? UI.en;
  const q = lang === "en" ? "" : `?lang=${lang}`;

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setQuery("");
      setPicked(null);
    });
    setTimeout(() => input.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // A typed reference, or a book whose name starts with what was typed.
  const match = useMemo(() => {
    // Typed lower-case is fine here: "jn 3:16" means John 3:16.
    const t = query.trim().replace(/^(\d?\s*)(\p{L})/u, (_, n, c) => n + c.toUpperCase());
    if (!t) return null;
    const ref = findReferences(t)[0] ?? findReferences(`${t} 1`)[0];
    if (ref) return { ref, label: `${BOOKS[ref.book].names[lang] ?? BOOKS[ref.book].names.en} ${ref.chapter}${ref.verse ? `:${ref.verse}` : ""}` };
    return null;
  }, [query, lang]);
  const bookMatches = useMemo(() => {
    const t = fold(query.trim());
    if (!t || match) return [];
    return BOOKS.filter((b) => Object.values(b.names).some((n) => fold(n).startsWith(t)) || b.aliases.some((a) => a.startsWith(t))).slice(0, 8);
  }, [query, match]);

  const go = (href: string) => {
    onClose();
    // Stay in the translation being read.
    const ver = new URLSearchParams(window.location.search).get("ver");
    router.push(ver ? `${href}${href.includes("?") ? "&" : "?"}ver=${encodeURIComponent(ver)}` : href);
  };

  if (!open) return null;
  const current = picked ?? book;
  const currentBook = BOOKS[current];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={ui.title}>
      <button type="button" aria-label={ui.close} onClick={onClose} className="absolute inset-0 bg-ink-950/70" />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-2xl border border-ink-500 bg-ink-900 shadow-2xl shadow-black/60 sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-ink-700 p-3">
          <form
            className="flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (match) go(chapterPath(match.ref, lang));
              else if (bookMatches[0]) setPicked(bookMatches[0].index);
            }}
          >
            <input
              ref={input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ui.placeholder}
              className="input w-full !py-2.5 text-base"
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="go"
            />
          </form>
          <button type="button" onClick={onClose} aria-label={ui.close} className="rounded-full p-2 text-parchment-500 hover:bg-ink-800 hover:text-parchment-50">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto p-3">
          {match && (
            <button type="button" onClick={() => go(chapterPath(match.ref, lang))} className="mb-3 flex w-full items-center justify-between rounded-xl border border-gold-500/50 bg-gold-500/10 px-4 py-3 text-left text-parchment-50">
              <span className="font-display text-xl">{match.label}</span>
              <span className="text-xs text-gold-300">{ui.go} →</span>
            </button>
          )}
          {bookMatches.length > 0 && (
            <ul className="mb-3 divide-y divide-ink-800 rounded-xl border border-ink-700">
              {bookMatches.map((b) => (
                <li key={b.osis}>
                  <button type="button" onClick={() => { setPicked(b.index); setQuery(""); }} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-parchment-100 hover:bg-ink-800">
                    <span lang={lang}>{b.names[lang] ?? b.names.en}</span>
                    <span className="text-xs text-parchment-600">{b.chapters}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!query && (
            <>
              <p className="eyebrow mb-2">{ui.chaptersOf} {currentBook.names[lang] ?? currentBook.names.en}</p>
              <div className="mb-5 grid grid-cols-8 gap-1.5">
                {Array.from({ length: currentBook.chapters }, (_, i) => i + 1).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => go(`/bible/${bookSlug(currentBook)}/${c}${q}`)}
                    className={`flex h-10 items-center justify-center rounded-lg border text-sm tabular-nums ${current === book && c === chapter ? "border-gold-500 bg-gold-500/15 text-gold-300" : "border-ink-700 text-parchment-200 hover:border-gold-500/60"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="eyebrow mb-2">{ui.ot}</p>
              <BookGrid books={BOOKS.slice(0, OT_COUNT)} lang={lang} current={current} onPick={setPicked} />
              <p className="eyebrow mb-2 mt-5">{ui.nt}</p>
              <BookGrid books={BOOKS.slice(OT_COUNT)} lang={lang} current={current} onPick={setPicked} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BookGrid({ books, lang, current, onPick }: { books: typeof BOOKS; lang: string; current: number; onPick: (i: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3">
      {books.map((b) => (
        <button key={b.osis} type="button" onClick={() => onPick(b.index)} className={`rounded px-2 py-1.5 text-left text-sm ${b.index === current ? "bg-gold-500/10 text-gold-300" : "text-parchment-200 hover:bg-ink-800"}`} lang={lang}>
          {b.names[lang] ?? b.names.en}
        </button>
      ))}
    </div>
  );
}

const UI: Record<string, { title: string; close: string; placeholder: string; go: string; chaptersOf: string; ot: string; nt: string }> = {
  en: { title: "Go to", close: "Close", placeholder: "Go to… e.g. John 3:16, Psalm 23, Rom", go: "Open", chaptersOf: "Chapters of", ot: "Old Testament", nt: "New Testament" },
  es: { title: "Ir a", close: "Cerrar", placeholder: "Ir a… p. ej. Juan 3:16, Salmo 23, Rom", go: "Abrir", chaptersOf: "Capítulos de", ot: "Antiguo Testamento", nt: "Nuevo Testamento" },
  pt: { title: "Ir para", close: "Fechar", placeholder: "Ir para… ex. João 3:16, Salmo 23, Rom", go: "Abrir", chaptersOf: "Capítulos de", ot: "Antigo Testamento", nt: "Novo Testamento" },
};
