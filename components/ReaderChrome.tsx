"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BiblePicker from "@/components/BiblePicker";

/**
 * The reader's navigation furniture: a tappable chapter title that opens the
 * go-to sheet, a bottom bar on phones (previous · title · text size · next),
 * swipe left/right between chapters, and a remembered text size.
 */

type Neighbour = { href: string; label: string } | null;

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

export function MobileChapterBar({ lang, book, chapter, name, prev, next, sizeLabel }: { lang: string; book: number; chapter: number; name: string; prev: Neighbour; next: Neighbour; sizeLabel: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const router = useRouter();

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
          <TextSizeButton label={sizeLabel} />
          {next ? (
            <Link href={next.href} rel="next" aria-label={next.label} className="flex h-12 w-12 items-center justify-center rounded-full text-parchment-300 active:bg-ink-800">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
            </Link>
          ) : <span className="h-12 w-12" />}
        </div>
      </div>
      <BiblePicker open={open} onClose={close} lang={lang} book={book} chapter={chapter} />
    </>
  );
}
