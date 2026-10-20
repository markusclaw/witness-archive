"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ESV_LIMIT_NOTE, ESV_NOTICE } from "@/lib/bible-credits";
import { ORIGINALS, VERSIONS } from "@/lib/scripture";

/** The credits for every Bible text on the site, set small and quiet. */
export function BibleCopyrightText() {
  // Only finished texts we hold ourselves; drafts and live (licensed) ones are credited separately.
  const free = Object.values(VERSIONS)
    .flat()
    .filter((v) => !v.live && !v.draft);
  return (
    <div className="space-y-5 text-xs leading-relaxed text-parchment-500">
      <section>
        <h3 className="mb-1.5 text-[0.65rem] uppercase tracking-[0.2em] text-parchment-700">English Standard Version (ESV)</h3>
        <p>{ESV_NOTICE}</p>
        <p className="mt-1.5">{ESV_LIMIT_NOTE}</p>
        <p className="mt-1.5">
          Provided by the ESV API from Crossway ·{" "}
          <a href="https://www.esv.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-parchment-300">esv.org</a>
        </p>
      </section>
      <section>
        <h3 className="mb-1.5 text-[0.65rem] uppercase tracking-[0.2em] text-parchment-700">Public domain</h3>
        <p>{free.map((v) => `${v.name} (${v.abbr})`).join(" · ")}</p>
      </section>
      <section>
        <h3 className="mb-1.5 text-[0.65rem] uppercase tracking-[0.2em] text-parchment-700">Original languages</h3>
        <p>
          {ORIGINALS.he.name} — public domain. {ORIGINALS.el.name} — © 2010 Society of Biblical Literature and Logos Bible Software, CC BY 4.0. Strong&apos;s Hebrew and Greek dictionaries — public domain.
        </p>
      </section>
      <section>
        <h3 className="mb-1.5 text-[0.65rem] uppercase tracking-[0.2em] text-parchment-700">Versión Testigo</h3>
        <p lang="es">Borrador en revisión; la licencia se definirá antes de su publicación.</p>
      </section>
    </div>
  );
}

/**
 * A "Copyright" link that opens the credits in a small window. It's a real
 * link to /bible/copyright, so it still works without JavaScript or in a new tab.
 */
export function CopyrightLink({ className = "", children }: { className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Link
        href="/bible/copyright"
        className={className}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </Link>
      {open && (
        <div className="wa-sheet fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Bible texts and copyright">
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink-950/60" />
          <div className="relative max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-ink-600 bg-ink-900 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl shadow-black/60 sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-parchment-300">Bible texts &amp; copyright</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-parchment-500 hover:bg-ink-800 hover:text-parchment-100">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <BibleCopyrightText />
          </div>
        </div>
      )}
    </>
  );
}
