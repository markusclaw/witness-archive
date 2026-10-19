"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TRANSLATION_FOR_LANGUAGE } from "@/lib/scripture";
import { LANGUAGES } from "@/lib/languages";
import { readerLanguage, readerVersion, rememberVersion } from "@/lib/reader-language";

export type VersionOption = { code: string; abbr: string; name: string };

/**
 * Keeps the Bible pages in the reader's language. Without a `lang` in the
 * URL, the first visit picks up `wa:lang` (set by the testimony language
 * links); choosing a translation here writes it back, so the rest of the
 * archive follows.
 */
export function BibleLanguageSync({ current, version, versions = [] }: { current: string; /** translation shown now */ version?: string; /** translations offered in this language */ versions?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const offered = versions.join(",");
  useEffect(() => {
    const q = new URLSearchParams(params.toString());
    if (!params.has("lang")) {
      const want = readerLanguage();
      if (want !== current && TRANSLATION_FOR_LANGUAGE[want]) {
        q.set("lang", want);
        q.delete("ver");
        router.replace(`${pathname}?${q.toString()}`);
        return;
      }
    }
    // The translation this reader chose last time in this language.
    if (params.has("ver") || !version) return;
    const want = readerVersion(current);
    if (!want || want === version || !offered.split(",").includes(want)) return;
    q.set("ver", want);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }, [params, pathname, router, current, version, offered]);
  return null;
}

/** "WEB · ESV · KJV" — the translations offered in the reader's language. */
export function VersionPicker({ lang, current, versions, className = "" }: { lang: string; current: string; versions: VersionOption[]; className?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  if (versions.length < 2) return null;
  const href = (code: string) => {
    const q = new URLSearchParams(params.toString());
    if (code === versions[0].code) q.delete("ver");
    else q.set("ver", code);
    const s = q.toString();
    return s ? `${pathname}?${s}` : pathname;
  };
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {versions.map((v) => (
        <Link
          key={v.code}
          href={href(v.code)}
          scroll={false}
          onClick={() => rememberVersion(lang, v.code)}
          title={v.name}
          aria-current={v.code === current ? "true" : undefined}
          className={`rounded-full border px-2 py-0.5 text-[0.7rem] tracking-wide transition ${v.code === current ? "border-gold-500/60 bg-gold-500/10 text-gold-300" : "border-ink-600 text-parchment-500 hover:border-ink-500 hover:text-parchment-100"}`}
        >
          {v.abbr}
        </Link>
      ))}
    </span>
  );
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
export function BibleLanguagePicker({ current, label, translationName, version, versions = [] }: { current: string; label: string; translationName: string; version?: string; versions?: VersionOption[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (code: string) => {
    const q = new URLSearchParams(params.toString());
    if (code === "en") q.delete("lang");
    else q.set("lang", code);
    q.delete("ver");
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
      {versions.length > 1 && version ? <VersionPicker lang={current} current={version} versions={versions} className="ml-3 align-middle" /> : null}
      <span className="ml-3 text-parchment-700">{translationName}</span>
    </div>
  );
}
