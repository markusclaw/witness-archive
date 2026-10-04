"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { describeMorph } from "@/lib/morph";
import { chapterPath } from "@/lib/scripture";
import { readerLanguage } from "@/lib/reader-language";
import { track } from "@/lib/analytics";
import type { OriginalWord, WordInfo } from "@/lib/bible";

/**
 * The card that opens when a Hebrew or Greek word is tapped: the word as it
 * stands, its dictionary form and Strong's number, the parsing in plain
 * words, the gloss, how often it appears, and a few other places it does.
 */
export default function WordCard({
  word,
  language,
  at,
  onClose,
}: {
  word: OriginalWord;
  language: "he" | "el";
  at: { book: number; chapter: number; verse: number };
  onClose: () => void;
}) {
  const [info, setInfo] = useState<WordInfo | null | undefined>(undefined);
  const [lang, setLang] = useState("en");
  const ui = UI[lang] ?? UI.en;

  useEffect(() => {
    const l = readerLanguage();
    queueMicrotask(() => setLang(l));
    if (!word.s) {
      queueMicrotask(() => setInfo(null));
      return;
    }
    let cancelled = false;
    fetch(`/api/bible/word?strongs=${word.s}&lang=${l}&at=${at.book}.${at.chapter}.${at.verse}`)
      .then((r) => (r.ok ? (r.json() as Promise<WordInfo>) : null))
      .then((j) => !cancelled && setInfo(j))
      .catch(() => !cancelled && setInfo(null));
    track("scripture_word", { strongs: word.s, language });
    return () => {
      cancelled = true;
    };
  }, [word.s, at.book, at.chapter, at.verse, language]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const parsing = describeMorph(language, word.m);
  const entry = info?.entry;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 sm:px-4 sm:pb-4" role="dialog" aria-label={word.t}>
      <button type="button" className="fixed inset-0 -z-10 bg-ink-950/40" aria-label={ui.close} onClick={onClose} />
      <div className="w-full max-w-xl rounded-2xl border border-ink-500 bg-ink-900 p-5 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-2xl leading-tight text-parchment-50 ${language === "he" ? "verse-he" : "verse-el"}`} lang={language} dir={language === "he" ? "rtl" : "ltr"}>
              {word.t}
            </p>
            {entry && (
              <p className="mt-1 text-sm text-parchment-300">
                <span className={language === "he" ? "verse-he" : "verse-el"} lang={language}>{entry.lemma}</span>
                {entry.translit && <span className="ml-2 italic text-parchment-400">{entry.translit}</span>}
                {entry.pronunciation && <span className="ml-2 text-parchment-600">{entry.pronunciation}</span>}
                <span className="ml-2 text-xs text-gold-500">{entry.id}</span>
              </p>
            )}
            {!entry && word.l && (
              <p className="mt-1 text-sm text-parchment-300"><span className="verse-el" lang="el">{word.l}</span></p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label={ui.close} className="-mr-1 -mt-1 rounded p-1 text-parchment-500 hover:text-parchment-50">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {parsing && <p className="mt-3 text-xs uppercase tracking-[0.12em] text-parchment-500">{parsing}</p>}

        {info === undefined && <p className="mt-3 text-sm text-parchment-500">{ui.loading}</p>}
        {info === null && <p className="mt-3 text-sm text-parchment-500">{ui.noEntry}</p>}
        {entry && (
          <>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-parchment-100">{entry.definition.replace(/^\s*[,;]\s*/, "")}</p>
            {entry.kjv_def && (
              <p className="mt-2 text-sm text-parchment-400">
                <span className="text-parchment-600">{ui.rendered}: </span>
                {entry.kjv_def}
              </p>
            )}
            {entry.derivation && <p className="mt-1 text-xs text-parchment-600">{entry.derivation}</p>}
            <p className="mt-3 text-xs text-parchment-500">{ui.occurs(entry.occurrences)}</p>
            {info.also.length > 0 && (
              <div className="mt-3 max-h-56 overflow-y-auto border-t border-ink-700 pt-3">
                <p className="eyebrow mb-2">{ui.alsoIn}</p>
                <ul className="space-y-2 text-sm">
                  {info.also.map((a) => (
                    <li key={`${a.book}.${a.chapter}.${a.verse}`}>
                      <Link href={chapterPath({ book: a.book, chapter: a.chapter, verse: a.verse }, lang) + "&orig=1"} className="text-gold-300 hover:text-gold-200" onClick={onClose}>
                        {a.reference}
                      </Link>
                      {a.text && <span className="ml-2 text-parchment-400">{a.text.length > 140 ? a.text.slice(0, 140) + "…" : a.text}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        <p className="mt-4 text-[0.65rem] text-parchment-700">{ui.credit}</p>
      </div>
    </div>
  );
}

const UI: Record<string, { close: string; loading: string; noEntry: string; rendered: string; alsoIn: string; credit: string; occurs: (n: number) => string }> = {
  en: { close: "Close", loading: "Looking it up…", noEntry: "No dictionary entry for this form.", rendered: "Rendered in the KJV as", alsoIn: "Also in", credit: "Strong's lexicon (1890) · morphology from OpenScriptures and MorphGNT", occurs: (n) => `Appears ${n.toLocaleString()} ${n === 1 ? "time" : "times"} in the Bible.` },
  es: { close: "Cerrar", loading: "Buscando…", noEntry: "No hay entrada de diccionario para esta forma.", rendered: "Traducido en la KJV como", alsoIn: "También en", credit: "Léxico de Strong (1890) · morfología de OpenScriptures y MorphGNT", occurs: (n) => `Aparece ${n.toLocaleString()} ${n === 1 ? "vez" : "veces"} en la Biblia.` },
  pt: { close: "Fechar", loading: "Procurando…", noEntry: "Sem entrada de dicionário para esta forma.", rendered: "Traduzido na KJV como", alsoIn: "Também em", credit: "Léxico de Strong (1890) · morfologia de OpenScriptures e MorphGNT", occurs: (n) => `Aparece ${n.toLocaleString()} ${n === 1 ? "vez" : "vezes"} na Bíblia.` },
};
