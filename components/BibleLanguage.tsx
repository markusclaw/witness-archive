"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TRANSLATION_FOR_LANGUAGE } from "@/lib/scripture";
import { LANGUAGES } from "@/lib/languages";
import { readerLanguage } from "@/lib/reader-language";

/**
 * Keeps the Bible pages in the reader's language. Without a `lang` in the
 * URL, the first visit picks up `wa:lang` (set by the testimony language
 * links); choosing a translation here writes it back, so the rest of the
 * archive follows.
 */
export function BibleLanguageSync({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    if (params.has("lang")) return;
    const want = readerLanguage();
    if (want === current || !TRANSLATION_FOR_LANGUAGE[want]) return;
    const q = new URLSearchParams(params.toString());
    q.set("lang", want);
    router.replace(`${pathname}?${q.toString()}`);
  }, [params, pathname, router, current]);
  return null;
}

/** "Read in: English · Español · Português" with the translation name under the active one. */
export function BibleLanguagePicker({ current, label, translationName }: { current: string; label: string; translationName: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (code: string) => {
    const q = new URLSearchParams(params.toString());
    if (code === "en") q.delete("lang");
    else q.set("lang", code);
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
  return (
    <div className="text-xs text-parchment-500">
      <span className="mr-2">{label}:</span>
      {LANGUAGES.filter((l) => TRANSLATION_FOR_LANGUAGE[l.code]).map((l, i) => (
        <span key={l.code}>
          {i > 0 && <span className="mx-1.5 text-parchment-700">·</span>}
          <Link href={href(l.code)} onClick={() => remember(l.code)} lang={l.code} className={l.code === current ? "text-gold-300" : "hover:text-parchment-100"} aria-current={l.code === current ? "true" : undefined}>
            {l.nativeName}
          </Link>
        </span>
      ))}
      <span className="ml-3 text-parchment-700">{translationName}</span>
    </div>
  );
}
