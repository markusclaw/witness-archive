"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import OriginalWords from "@/components/OriginalWords";
import type { OriginalWord } from "@/lib/bible";
import type { BookLayout } from "@/lib/vt-layout";
import type { VtVerse } from "@/lib/vt-shared";
import { EDITIONS, originalName, type EditionCode } from "@/lib/editions";

type Chapter = { chapter: number; verses: VtVerse[]; words: Record<number, OriginalWord[]> };

/** «el SEÑOR» / "the LORD" in small capitals, as printed Bibles set the divine name. */
function divineName(text: string): ReactNode[] {
  return text.split(/(SEÑOR|LORD)/).map((part, i) =>
    part === "SEÑOR" || part === "LORD" ? (
      <span key={i} className="[font-variant:small-caps]">{part === "SEÑOR" ? "Señor" : "Lord"}</span>
    ) : (
      part
    ),
  );
}

const letter = (i: number) => (i < 26 ? String.fromCharCode(97 + i) : String.fromCharCode(97 + Math.floor(i / 26) - 1) + String.fromCharCode(97 + (i % 26)));

/**
 * A book of the Versión Testigo set like a printed Bible: title, section
 * headings, paragraphs with small verse numbers, a large numeral at each
 * chapter, and translator notes gathered at the end of each chapter.
 * Tapping a verse number opens that verse in the original language, where
 * every word can be tapped for its meaning.
 */
export default function VtBook({ edition: code, book, slug, layout, chapters }: { edition: EditionCode; book: number; slug: string; layout: BookLayout; chapters: Chapter[] }) {
  const edition = EDITIONS[code];
  const ui = edition.ui;
  const [open, setOpen] = useState<{ chapter: number; verse: VtVerse; words: OriginalWord[] } | null>(null);
  const he = book < 39;
  const paragraphStarts = new Set(layout.paragraphs);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div lang={edition.lang}>
      {/* Title page */}
      <header className="text-center">
        <p className="text-[0.7rem] uppercase tracking-[0.35em] text-gold-500">{edition.name}</p>
        <h1 className="font-display mt-6 text-6xl tracking-tight text-parchment-50 sm:text-7xl">{layout.title}</h1>
        <p className="font-display mt-3 text-lg italic text-parchment-500">{layout.subtitle}</p>
        <div className="mx-auto mt-6 flex w-24 items-center gap-2 text-gold-500/60" aria-hidden>
          <span className="h-px flex-1 bg-current" />
          <span className="text-xs">✦</span>
          <span className="h-px flex-1 bg-current" />
        </div>
        <p className="mx-auto mt-6 max-w-md text-xs leading-relaxed text-parchment-700">
          {ui.draftNote(originalName(edition, book))}
        </p>
        <nav className="mt-6 flex justify-center gap-2" aria-label={ui.chapters}>
          {chapters.map((c) => (
            <a key={c.chapter} href={`#c${c.chapter}`} className="font-display flex h-9 w-9 items-center justify-center rounded-full border border-ink-600 text-parchment-300 hover:border-gold-500/60 hover:text-gold-300">
              {c.chapter}
            </a>
          ))}
        </nav>
      </header>

      {chapters.map((c) => {
        const notes: { key: string; verse: number; type: string; text: string }[] = [];
        const paragraphs: { heading?: string; verses: VtVerse[] }[] = [];
        for (const v of c.verses) {
          const ref = `${c.chapter}:${v.verse}`;
          if (!paragraphs.length || paragraphStarts.has(ref)) paragraphs.push({ heading: layout.headings[ref], verses: [] });
          paragraphs[paragraphs.length - 1].verses.push(v);
        }
        return (
          <section key={c.chapter} id={`c${c.chapter}`} className="mt-16 scroll-mt-24" aria-label={ui.chapter(c.chapter)}>
            {paragraphs.map((p, pi) => (
              <div key={pi}>
                {p.heading && <h2 className={`font-display mb-4 text-center text-[1.05rem] italic text-gold-300 ${pi === 0 ? "" : "mt-12"}`}>{p.heading}</h2>}
                <p className={`font-display text-[1.18rem] leading-[1.85] text-parchment-100 sm:text-justify sm:hyphens-auto ${pi === 0 || p.heading ? "" : "indent-6"} ${pi === 0 ? "" : "mt-1"}`}>
                  {pi === 0 && (
                    <button
                      type="button"
                      onClick={() => setOpen({ chapter: c.chapter, verse: c.verses[0], words: c.words[c.verses[0].verse] ?? [] })}
                      className="font-display float-left mr-3 mt-1 text-[4.2rem] leading-[0.8] text-gold-400 hover:text-gold-300"
                      aria-label={`${ui.chapter(c.chapter)} · ${ui.verseOpen(1)}`}
                    >
                      {c.chapter}
                    </button>
                  )}
                  {p.verses.map((v) => {
                    const first = pi === 0 && v === p.verses[0];
                    const markers = (v.notes ?? []).map((n) => {
                      const key = letter(notes.length);
                      notes.push({ key, verse: v.verse, type: n.type, text: n.text });
                      return key;
                    });
                    return (
                      <span key={v.verse} id={`v${c.chapter}-${v.verse}`} className="scroll-mt-24">
                        {!first && (
                          <button type="button" onClick={() => setOpen({ chapter: c.chapter, verse: v, words: c.words[v.verse] ?? [] })} className="mr-1 ml-0.5 align-super font-sans text-[0.62rem] text-gold-500 hover:text-gold-300" aria-label={ui.verseOpen(v.verse)}>
                            {v.verse}
                          </button>
                        )}
                        {divineName(v.text)}
                        {markers.map((m) => (
                          <a key={m} href={`#n${c.chapter}-${m}`} className="ml-0.5 align-super font-sans text-[0.6rem] italic text-parchment-500 hover:text-gold-300">{m}</a>
                        ))}{" "}
                      </span>
                    );
                  })}
                </p>
              </div>
            ))}
            {notes.length > 0 && (
              <aside className="mt-8 border-t border-ink-700 pt-4" aria-label={ui.notesOf(c.chapter)}>
                <ol className="space-y-1.5 text-[0.78rem] leading-relaxed text-parchment-500">
                  {notes.map((n) => (
                    <li key={n.key} id={`n${c.chapter}-${n.key}`} className="scroll-mt-24">
                      <a href={`#v${c.chapter}-${n.verse}`} className="mr-1.5 italic text-parchment-300 hover:text-gold-300">{n.key}</a>
                      <span className="text-parchment-700">{c.chapter}:{n.verse} · {ui.noteType[n.type] ?? n.type}.</span> {divineName(n.text)}
                    </li>
                  ))}
                </ol>
              </aside>
            )}
          </section>
        );
      })}

      {open && (
        <div className="wa-sheet fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`${layout.title} ${open.chapter}:${open.verse.verse}`}>
          <button type="button" aria-label={ui.close} onClick={() => setOpen(null)} className="absolute inset-0 bg-ink-950/60" />
          <div className="relative max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-ink-600 bg-ink-900 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl shadow-black/60 sm:rounded-2xl">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-xl text-parchment-50">{layout.title} {open.chapter}:{open.verse.verse}</p>
              <span className="rounded-full border border-ink-500 px-2 py-0.5 text-[0.65rem] text-parchment-500">{ui.status[open.verse.status]}</span>
            </div>
            <p className="font-display mt-3 text-[1.1rem] leading-relaxed text-parchment-100">{divineName(open.verse.text)}</p>
            {open.words.length > 0 && (
              <div className="mt-5 border-t border-ink-700 pt-4">
                <p className="mb-2 text-[0.65rem] uppercase tracking-[0.2em] text-parchment-700">{he ? ui.hebrew : ui.greek} · {ui.tapWord}</p>
                <p className={he ? "text-right text-2xl leading-loose" : "text-xl leading-loose"} dir={he ? "rtl" : "ltr"}>
                  <OriginalWords words={open.words} language={he ? "he" : "el"} at={{ book, chapter: open.chapter, verse: open.verse.verse }} readerLang={edition.lang} />
                </p>
              </div>
            )}
            {open.verse.notes?.length > 0 && (
              <ul className="mt-4 space-y-1 border-l-2 border-gold-500/30 pl-3 text-sm text-parchment-300">
                {open.verse.notes.map((n, i) => (
                  <li key={i}><span className="text-parchment-500">{ui.noteType[n.type] ?? n.type}:</span> {divineName(n.text)}</li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex items-center justify-between gap-3 text-sm">
              <Link href={`${edition.path}/${slug}/${open.chapter}#v${open.verse.verse}`} className="text-gold-400 hover:text-gold-300">{ui.reviewHistory}</Link>
              <button type="button" onClick={() => setOpen(null)} className="btn btn-ghost !h-9 !px-4 !text-sm">{ui.close}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
