"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import BiblePicker from "@/components/BiblePicker";
import { LANGUAGES } from "@/lib/languages";
import { TRANSLATION_FOR_LANGUAGE } from "@/lib/scripture";

/**
 * The reader's navigation furniture: a tappable chapter title that opens the
 * go-to sheet, a bottom bar on phones (previous · title · text size · next),
 * swipe left/right between chapters, and a remembered text size.
 */

type Neighbour = { href: string; label: string } | null;

/** What the phone's reading-settings sheet needs: language, original text, size. */
export interface ReadingSettingsProps {
  lang: string;
  showOriginal: boolean;
  script: string;
  labels: { title: string; textSize: string; readIn: string; original: string; done: string };
}

/**
 * Phones: one sheet behind the Aa button for everything about how the page
 * reads — text size, language, and the original Hebrew/Greek — instead of a
 * row of controls above the text.
 */
function ReadingSettings({ open, onClose, lang, showOriginal, script, labels }: ReadingSettingsProps & { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [size, setSize] = useState<Size>("m");
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => setSize(readSize()));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;

  const withParams = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    return s ? `${pathname}?${s}` : pathname;
  };
  const remember = (code: string) => {
    try {
      window.localStorage.setItem("wa:lang", code);
    } catch {
      /* ignore */
    }
  };
  const pill = (active: boolean) => `flex h-11 flex-1 items-center justify-center rounded-xl border text-sm transition ${active ? "border-gold-500 bg-gold-500/15 text-gold-300" : "border-ink-600 text-parchment-200 active:bg-ink-800"}`;

  return (
    <div className="wa-sheet fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={labels.title}>
      <button type="button" aria-label={labels.done} onClick={onClose} className="absolute inset-0 bg-ink-950/60" />
      <div className="relative w-full max-w-lg rounded-t-2xl border border-ink-500 bg-ink-900 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl shadow-black/60">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-600" aria-hidden />
        <p className="eyebrow mb-2">{labels.textSize}</p>
        <div className="flex gap-2">
          {SIZES.map((s, i) => (
            <button key={s} type="button" onClick={() => { setSize(s); applySize(s); }} className={pill(size === s)} aria-pressed={size === s}>
              <span style={{ fontSize: `${0.8 + i * 0.18}rem` }}>Aa</span>
            </button>
          ))}
        </div>
        <p className="eyebrow mb-2 mt-5">{labels.readIn}</p>
        <div className="flex gap-2">
          {LANGUAGES.filter((l) => TRANSLATION_FOR_LANGUAGE[l.code]).map((l) => (
            <Link key={l.code} href={withParams({ lang: l.code === "en" ? null : l.code })} onClick={() => { remember(l.code); onClose(); }} className={pill(l.code === lang)} lang={l.code} scroll={false}>
              {l.nativeName}
            </Link>
          ))}
        </div>
        <Link
          href={withParams({ orig: showOriginal ? null : "1" })}
          onClick={onClose}
          scroll={false}
          role="switch"
          aria-checked={showOriginal}
          className="mt-5 flex items-center justify-between rounded-xl border border-ink-600 px-4 py-3 text-parchment-100 active:bg-ink-800"
        >
          <span>
            {labels.original} <span className="text-parchment-500">· {script}</span>
          </span>
          <span className={`relative h-6 w-10 rounded-full transition ${showOriginal ? "bg-gold-500" : "bg-ink-600"}`} aria-hidden>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-parchment-50 transition-all ${showOriginal ? "left-[1.1rem]" : "left-0.5"}`} />
          </span>
        </Link>
        <button type="button" onClick={onClose} className="btn btn-ghost mt-5 w-full !h-11">{labels.done}</button>
      </div>
    </div>
  );
}

const SIZES = ["s", "m", "l", "xl"] as const;
type Size = (typeof SIZES)[number];
const SIZE_KEY = "wa:textsize";

function readSize(): Size {
  try {
    const v = window.localStorage.getItem(SIZE_KEY);
    return SIZES.includes(v as Size) ? (v as Size) : "m";
  } catch {
    return "m";
  }
}

function applySize(s: Size) {
  document.documentElement.dataset.textsize = s;
  try {
    window.localStorage.setItem(SIZE_KEY, s);
  } catch {
    /* ignore */
  }
}

/** Apply the saved size as early as possible on any Bible page. */
export function TextSizeInit() {
  useEffect(() => {
    document.documentElement.dataset.textsize = readSize();
    return () => {
      delete document.documentElement.dataset.textsize;
    };
  }, []);
  return null;
}

export function TextSizeButton({ label }: { label: string }) {
  const [size, setSize] = useState<Size>("m");
  useEffect(() => {
    queueMicrotask(() => setSize(readSize()));
  }, []);
  const cycle = () => {
    const next = SIZES[(SIZES.indexOf(size) + 1) % SIZES.length];
    setSize(next);
    applySize(next);
  };
  return (
    <button type="button" onClick={cycle} aria-label={`${label}: ${size.toUpperCase()}`} title={label} className="inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-parchment-300 hover:bg-ink-800 hover:text-parchment-50">
      <span className="text-[0.7rem]">A</span>
      <span className="text-[1.05rem]">a</span>
      <span className="ml-1 text-[0.6rem] uppercase text-parchment-600">{size}</span>
    </button>
  );
}

export function ChapterTitle({ lang, book, chapter, name }: { lang: string; book: number; chapter: number; name: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group mt-4 flex items-baseline gap-3 text-left" aria-haspopup="dialog">
        <h1 className="font-display text-4xl font-light leading-tight text-parchment-50 sm:text-5xl" lang={lang}>
          {name} {chapter}
        </h1>
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-parchment-600 transition group-hover:text-gold-300" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <BiblePicker open={open} onClose={close} lang={lang} book={book} chapter={chapter} />
    </>
  );
}

export function MobileChapterBar({ lang, book, chapter, name, prev, next, settings }: { lang: string; book: number; chapter: number; name: string; prev: Neighbour; next: Neighbour; settings: ReadingSettingsProps }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const router = useRouter();

  // Tell the mini player how tall we are on phones.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => document.documentElement.style.setProperty("--wa-bottom", mq.matches ? "3.5rem" : "0px");
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      document.documentElement.style.setProperty("--wa-bottom", "0px");
    };
  }, []);

  // Swipe between chapters (phones): a clear horizontal flick, not a scroll, not a text selection.
  useEffect(() => {
    let start: { x: number; y: number; t: number } | null = null;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || (e.target as HTMLElement).closest("[role=dialog], [role=toolbar]")) {
        start = null;
        return;
      }
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const dx = e.changedTouches[0].clientX - start.x;
      const dy = e.changedTouches[0].clientY - start.y;
      const dt = Date.now() - start.t;
      start = null;
      if (dt > 600 || Math.abs(dx) < 80 || Math.abs(dy) > 60 || window.getSelection()?.toString()) return;
      const target = dx < 0 ? next : prev;
      if (target) router.push(target.href);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [prev, next, router]);

  return (
    <>
      <div className="wa-bottombar fixed inset-x-0 bottom-0 z-30 border-t border-ink-700 bg-ink-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden" role="navigation" aria-label="Chapter">
        <div className="flex h-14 items-center justify-between px-1">
          {prev ? (
            <Link href={prev.href} rel="prev" aria-label={prev.label} className="flex h-12 w-12 items-center justify-center rounded-full text-parchment-300 active:bg-ink-800">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
            </Link>
          ) : <span className="h-12 w-12" />}
          <button type="button" onClick={() => setOpen(true)} className="font-display flex min-w-0 flex-1 items-center justify-center gap-1.5 truncate px-2 text-lg text-parchment-50" aria-haspopup="dialog" lang={lang}>
            <span className="truncate">{name} {chapter}</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-parchment-500" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <button type="button" onClick={() => setSettingsOpen(true)} aria-haspopup="dialog" aria-label={settings.labels.title} className="flex h-12 min-w-12 items-center justify-center rounded-full px-2 text-parchment-300 active:bg-ink-800">
            <span className="text-[0.75rem]">A</span>
            <span className="text-[1.15rem]">a</span>
            {settings.lang !== "en" && <span className="ml-1 text-[0.6rem] uppercase text-gold-400">{settings.lang}</span>}
          </button>
          {next ? (
            <Link href={next.href} rel="next" aria-label={next.label} className="flex h-12 w-12 items-center justify-center rounded-full text-parchment-300 active:bg-ink-800">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
            </Link>
          ) : <span className="h-12 w-12" />}
        </div>
      </div>
      <BiblePicker open={open} onClose={close} lang={lang} book={book} chapter={chapter} />
      <ReadingSettings open={settingsOpen} onClose={closeSettings} {...settings} />
    </>
  );
}

/** A search-box-shaped button on the index and book pages that opens the go-to sheet. */
export function GoToBar({ lang, book = 0, placeholder }: { lang: string; book?: number; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="mt-6 flex w-full items-center gap-3 rounded-xl border border-ink-600 bg-ink-900/70 px-4 py-3 text-left text-parchment-500 transition hover:border-ink-500 hover:text-parchment-300">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <span className="truncate">{placeholder}</span>
      </button>
      <BiblePicker open={open} onClose={close} lang={lang} book={book} chapter={0} />
    </>
  );
}
