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

/** Show/hide the Hebrew or Greek under each verse (?orig=1). */
export function OriginalToggle({ on, label, script }: { on: boolean; label: string; script: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const q = new URLSearchParams(params.toString());
  if (on) q.delete("orig");
  else q.set("orig", "1");
  const s = q.toString();
  return (
    <Link
      href={s ? `${pathname}?${s}` : pathname}
      scroll={false}
      role="switch"
      aria-checked={on}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition ${on ? "border-gold-500/60 bg-gold-500/10 text-gold-300" : "border-ink-600 text-parchment-500 hover:border-ink-500 hover:text-parchment-100"}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-gold-400" : "bg-ink-500"}`} aria-hidden />
      {label} <span className="text-parchment-700">· {script}</span>
    </Link>
  );
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
