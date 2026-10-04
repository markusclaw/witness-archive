import { DEFAULT_LANGUAGE, LANGUAGES } from "@/lib/languages";

/**
 * The language a visitor reads in. Until the site has a global language
 * switch this comes from the browser; a `wa:lang` entry in localStorage
 * (set by the testimony language links) wins when present.
 */
export function readerLanguage(): string {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const stored = window.localStorage.getItem("wa:lang");
    if (stored && LANGUAGES.some((l) => l.code === stored)) return stored;
  } catch {
    /* ignore */
  }
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const p of prefs) {
    const code = (p ?? "").slice(0, 2).toLowerCase();
    if (LANGUAGES.some((l) => l.code === code)) return code;
  }
  return DEFAULT_LANGUAGE;
}

/** "Arabic", "Español"… in the reader's language, via the browser's own tables. */
export function languageDisplayName(code: string, inLanguage: string): string {
  try {
    return new Intl.DisplayNames([inLanguage], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}
