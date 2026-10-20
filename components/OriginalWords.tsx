"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import WordCard from "@/components/WordCard";
import type { OriginalWord } from "@/lib/bible";

/**
 * A verse in Hebrew or Greek where every word can be tapped for its root,
 * parsing, meaning and other places it appears.
 */
export default function OriginalWords({
  words,
  language,
  at,
  readerLang,
  className = "",
}: {
  words: OriginalWord[];
  language: "he" | "el";
  at: { book: number; chapter: number; verse: number };
  readerLang?: string;
  className?: string;
}) {
  const [open, setOpen] = useState<OriginalWord | null>(null);
  return (
    <>
      <span className={`${language === "he" ? "verse-he" : "verse-el"} ${className}`} lang={language} dir={language === "he" ? "rtl" : "ltr"}>
        {words.map((w) => (
          <button key={w.p} type="button" className={`ow ${open?.p === w.p ? "ow-open" : ""}`} onClick={() => setOpen(w)}>
            {w.t}
          </button>
        ))}
      </span>
      {/* Portaled so the card doesn't inherit the verse's right-to-left direction. */}
      {open && createPortal(<WordCard word={open} language={language} at={at} readerLang={readerLang} onClose={() => setOpen(null)} />, document.body)}
    </>
  );
}
