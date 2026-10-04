"use client";

import Link from "next/link";
import { LANGUAGES } from "@/lib/languages";
import { localizedTestimonyPath } from "@/lib/seo";
import type { Testimony } from "@/lib/types";

/** Pill row: one entry per supported language; the original is marked. */
export default function LanguageSwitcher({ testimony, current }: { testimony: Testimony; current: string }) {
  return (
    <nav aria-label="Language" className="flex flex-wrap gap-1 rounded-full border border-ink-600 p-0.5 text-xs">
      {LANGUAGES.map((l) => {
        const active = l.code === current;
        const isOriginal = l.code === testimony.language;
        return active ? (
          <span key={l.code} className="rounded-full bg-ink-600 px-3 py-1 text-parchment-50" aria-current="true" lang={l.code}>
            {l.nativeName}
            {isOriginal && <span className="ml-1 text-parchment-500">·</span>}
          </span>
        ) : (
          <Link key={l.code} href={localizedTestimonyPath(testimony, l.code)} hrefLang={l.code} lang={l.code} onClick={() => { try { window.localStorage.setItem("wa:lang", l.code); } catch { /* ignore */ } }} className="rounded-full px-3 py-1 text-parchment-500 hover:text-parchment-50" title={isOriginal ? "Original" : l.name}>
            {l.nativeName}
          </Link>
        );
      })}
    </nav>
  );
}
