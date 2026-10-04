"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { chapterPath, findReferences, formatReference, referenceKey, type Reference } from "@/lib/scripture";
import { readerLanguage } from "@/lib/reader-language";
import { track } from "@/lib/analytics";

/**
 * Scripture in the page: references become links that open the verse in a
 * small popover, in the reader's own language. `ScriptureText` finds them in
 * a run of text; `ScriptureRef` is one link.
 */

interface Passage {
  reference: string;
  translation: { code: string; name: string; language: string };
  verses: { chapter: number; verse: number; text: string }[];
  truncated: boolean;
}

const cache = new Map<string, Promise<Passage | null>>();

function fetchPassage(key: string, lang: string): Promise<Passage | null> {
  const k = `${key}|${lang}`;
  let p = cache.get(k);
  if (!p) {
    p = fetch(`/api/bible?ref=${encodeURIComponent(key)}&lang=${lang}`)
      .then((r) => (r.ok ? (r.json() as Promise<Passage>) : null))
      .catch(() => null);
    cache.set(k, p);
    p.then((v) => v === null && cache.delete(k));
  }
  return p;
}

const UI: Record<string, { from: string; loading: string; unavailable: string; close: string; more: string; open: string }> = {
  en: { from: "From the", loading: "Opening…", unavailable: "This passage isn't available yet.", close: "Close", more: "Chapter continues…", open: "Open chapter" },
  es: { from: "De la", loading: "Abriendo…", unavailable: "Este pasaje aún no está disponible.", close: "Cerrar", more: "El capítulo continúa…", open: "Abrir capítulo" },
  pt: { from: "Da", loading: "Abrindo…", unavailable: "Esta passagem ainda não está disponível.", close: "Fechar", more: "O capítulo continua…", open: "Abrir capítulo" },
};

/** One reference as a link with a verse popover. `label` defaults to the reference as written. */
export function ScriptureRef({ reference, label, chip = false, lang: initialLang = "en" }: { reference: Reference; label?: ReactNode; chip?: boolean; /** language for the label before the popover opens */ lang?: string }) {
  const [open, setOpen] = useState(false);
  const [passage, setPassage] = useState<Passage | null | undefined>(undefined);
  const [lang, setLang] = useState(initialLang);
  const [flip, setFlip] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const id = useId();
  const key = referenceKey(reference);

  const show = useCallback(() => {
    const l = readerLanguage();
    setLang(l);
    setOpen(true);
    setPassage(undefined);
    fetchPassage(key, l).then(setPassage);
    track("scripture_open", { reference: key, language: l });
    const r = wrap.current?.getBoundingClientRect();
    if (r) setFlip(r.left > window.innerWidth * 0.55);
  }, [key]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const ui = UI[lang] ?? UI.en;
  const text = label ?? formatReference(reference, lang);

  return (
    <span ref={wrap} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (open) setOpen(false);
          else show();
        }}
        aria-expanded={open}
        aria-controls={id}
        className={
          chip
            ? "rounded-full border border-gold-500/40 bg-gold-500/5 px-3 py-1 text-xs text-gold-300 transition hover:border-gold-500 hover:bg-gold-500/10"
            : "scripture-ref"
        }
      >
        {text}
      </button>
      {open && (
        <span
          id={id}
          role="dialog"
          aria-label={passage?.reference ?? formatReference(reference, lang)}
          className={`absolute top-full z-30 mt-2 block w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-ink-500 bg-ink-900 p-4 text-left shadow-2xl shadow-black/50 ${flip ? "right-0" : "left-0"}`}
          dir={passage?.translation.language === "ar" ? "rtl" : "ltr"}
          lang={passage?.translation.language ?? lang}
        >
          <span className="flex items-start justify-between gap-3">
            <span className="font-display block text-lg leading-tight text-parchment-50">{passage?.reference ?? formatReference(reference, lang)}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label={ui.close} className="-mr-1 -mt-1 rounded p-1 text-parchment-500 hover:text-parchment-50">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </span>
          {passage === undefined && <span className="mt-3 block text-sm text-parchment-500">{ui.loading}</span>}
          {passage === null && (
            <span className="mt-3 block text-sm text-parchment-500">
              {ui.unavailable} <Link href={chapterPath(reference, lang)} className="text-gold-400 hover:text-gold-300">{ui.open} →</Link>
            </span>
          )}
          {passage && (
            <>
              <span className="mt-3 block max-h-72 overflow-y-auto pr-1 text-[0.95rem] leading-relaxed text-parchment-100">
                {passage.verses.map((v) => (
                  <span key={`${v.chapter}:${v.verse}`}>
                    <sup className="mr-1 text-[0.6rem] text-gold-400">{passage.verses[0].chapter !== passage.verses[passage.verses.length - 1].chapter ? `${v.chapter}:${v.verse}` : v.verse}</sup>
                    {v.text}{" "}
                  </span>
                ))}
                {passage.truncated && <span className="block pt-2 text-xs text-parchment-500">{ui.more}</span>}
              </span>
              <span className="mt-3 flex items-center justify-between gap-3 text-[0.7rem] text-parchment-700">
                <span>{ui.from} {passage.translation.name}</span>
                <Link href={chapterPath(reference, lang)} className="whitespace-nowrap text-gold-400 hover:text-gold-300">{ui.open} →</Link>
              </span>
            </>
          )}
        </span>
      )}
    </span>
  );
}

/** A run of text with its scripture references turned into `ScriptureRef` links. */
export function ScriptureText({ text }: { text: string }) {
  const refs = findReferences(text);
  if (!refs.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let pos = 0;
  refs.forEach((r, i) => {
    if (r.start > pos) out.push(text.slice(pos, r.start));
    out.push(<ScriptureRef key={`${i}-${r.start}`} reference={r} label={r.text} />);
    pos = r.end;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return <>{out}</>;
}
