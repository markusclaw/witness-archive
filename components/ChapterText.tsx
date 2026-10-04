"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";
import { HIGHLIGHT_COLORS, loadHighlights, setHighlight, type ChapterHighlights, type HighlightColor } from "@/lib/highlights";
import WordCard from "@/components/WordCard";
import type { OriginalWord } from "@/lib/bible";

/**
 * The verses of a chapter. Hover a verse and it lifts; click to select it,
 * click more to add, shift-click to extend a run. A small bar then offers
 * copy, share, ask and "write a testimony with this". The selection lives
 * in `?v=` ("16", "16-18", "3,7-9") so the link carries it.
 */
export default function ChapterText({
  verses,
  lang,
  book,
  bookIndex,
  chapter,
  translation,
  original = null,
}: {
  verses: { verse: number; text: string }[];
  lang: string;
  /** Localized book name, e.g. "Números". */
  book: string;
  bookIndex: number;
  chapter: number;
  translation: string;
  /** The Hebrew or Greek of this chapter, verse → text, when the reader turned it on. */
  original?: { language: "he" | "el"; name: string; verses: Record<number, string>; words: Record<number, OriginalWord[]> } | null;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState<"text" | "link" | null>(null);
  const anchor = useRef<number | null>(null);
  const [marks, setMarks] = useState<ChapterHighlights>({});
  const [openWord, setOpenWord] = useState<{ word: OriginalWord; verse: number } | null>(null);
  const ui = UI[lang] ?? UI.en;

  // The reader's own highlighter marks for this chapter.
  useEffect(() => {
    let cancelled = false;
    loadHighlights(bookIndex, chapter).then(({ marks }) => !cancelled && setMarks(marks));
    return () => {
      cancelled = true;
    };
  }, [bookIndex, chapter]);


  // URL → selection (initial load, back/forward, and links from popovers).
  useEffect(() => {
    const next = parseSel(params.get("v"));
    queueMicrotask(() => setSelected(next));
    const first = [...next].sort((a, b) => a - b)[0];
    if (first) {
      const el = document.getElementById(`v${first}`);
      if (el) setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
    }
  }, [params]);

  const commit = useCallback(
    (next: Set<number>) => {
      setSelected(next);
      const q = new URLSearchParams(params.toString());
      const v = formatSel(next);
      if (v) q.set("v", v);
      else q.delete("v");
      const s = q.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  const onVerseClick = (n: number, shift: boolean) => {
    const next = new Set(selected);
    if (shift && anchor.current != null) {
      const [a, b] = [Math.min(anchor.current, n), Math.max(anchor.current, n)];
      for (let i = a; i <= b; i++) next.add(i);
    } else if (next.has(n)) {
      next.delete(n);
    } else {
      next.add(n);
      anchor.current = n;
    }
    commit(next);
  };

  const clear = () => {
    anchor.current = null;
    commit(new Set());
  };

  const reference = `${book} ${chapter}${selected.size ? ":" + formatSel(selected).replace(/-/g, "–") : ""}`;
  const selectedText = verses
    .filter((v) => selected.has(v.verse))
    .map((v) => (selected.size > 1 ? `${v.verse} ${v.text}` : v.text))
    .join(" ");

  const paint = (color: HighlightColor | null) => {
    const verses = [...selected];
    setMarks((m) => {
      const next = { ...m };
      for (const v of verses) {
        if (color) next[v] = color;
        else delete next[v];
      }
      return next;
    });
    void setHighlight(bookIndex, chapter, verses, color);
    track("scripture_share", { reference, action: color ? `highlight_${color}` : "unhighlight" });
    clear();
  };

  const shareUrl = () => (typeof window === "undefined" ? "" : window.location.href);

  const copyText = async () => {
    try {
      const orig = original ? "\n" + verses.filter((v) => selected.has(v.verse) && original.verses[v.verse]).map((v) => original.verses[v.verse]).join(" ") + `\n— ${original.name}` : "";
      await navigator.clipboard.writeText(`“${selectedText}”\n— ${reference} (${translation})${orig}\n${shareUrl()}`);
      setCopied("text");
      setTimeout(() => setCopied(null), 1600);
      track("scripture_share", { reference, action: "copy" });
    } catch {
      /* clipboard blocked */
    }
  };

  const share = async () => {
    const data = { title: reference, text: `“${selectedText}” — ${reference}`, url: shareUrl() };
    try {
      if (navigator.share) {
        await navigator.share(data);
        track("scripture_share", { reference, action: "share" });
        return;
      }
    } catch {
      return; // user dismissed the sheet
    }
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied("link");
      setTimeout(() => setCopied(null), 1600);
      track("scripture_share", { reference, action: "copy_link" });
    } catch {
      /* ignore */
    }
  };

  const writeWith = () => {
    try {
      const content = `“${selectedText}”\n— ${reference}\n\n`;
      window.localStorage.setItem("wa:draft:new", JSON.stringify({ title: "", content, description: "", category: "", creator: "", isAnonymous: false, authorBio: "", experiencedOn: "", videoUrl: "", savedAt: Date.now() }));
    } catch {
      /* ignore */
    }
    track("scripture_share", { reference, action: "write" });
    router.push("/submit");
  };

  const askHref = `/ask?q=${encodeURIComponent(ui.askQuestion(reference))}`;

  return (
    <>
      <div className={`prose-testimony prose-chapter select-text ${original ? "prose-interlinear" : ""}`} lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
        <p>
          {verses.map((v) => {
            const hit = selected.has(v.verse);
            const mark = marks[v.verse];
            return (
              <span
                key={v.verse}
                id={`v${v.verse}`}
                role="button"
                tabIndex={0}
                aria-pressed={hit}
                onClick={(e) => onVerseClick(v.verse, e.shiftKey)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onVerseClick(v.verse, e.shiftKey);
                  }
                }}
                className={`verse ${mark ? `hl-${mark}` : ""} ${hit ? "verse-hit" : ""}`}
              >
                <span className="verse-num" aria-hidden>{v.verse}</span>
                {v.text}{" "}
                {original?.verses[v.verse] && (
                  <span className={`verse-original ${original.language === "he" ? "verse-he" : "verse-el"}`} lang={original.language} dir={original.language === "he" ? "rtl" : "ltr"}>
                    {original.words[v.verse]?.length
                      ? original.words[v.verse].map((w) => (
                          <button
                            key={w.p}
                            type="button"
                            className={`ow ${openWord?.verse === v.verse && openWord.word.p === w.p ? "ow-open" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenWord({ word: w, verse: v.verse });
                            }}
                          >
                            {w.t}
                          </button>
                        ))
                      : original.verses[v.verse]}
                  </span>
                )}
              </span>
            );
          })}
        </p>
      </div>
      <p className="mt-4 text-xs text-parchment-700" lang={lang}>
        {ui.hint}
        {original && ` ${ui.wordHint}`}
      </p>
      {openWord && original && <WordCard word={openWord.word} language={original.language} at={{ book: bookIndex, chapter, verse: openWord.verse }} onClose={() => setOpenWord(null)} />}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4" role="toolbar" aria-label={reference}>
          <div className="flex max-w-full flex-wrap items-center gap-1 rounded-2xl border border-ink-500 bg-ink-900/95 px-3 py-2 shadow-2xl shadow-black/60 backdrop-blur-md">
            <span className="font-display mr-2 truncate text-base text-parchment-50" lang={lang}>{reference}</span>
            <span className="mr-1 flex items-center gap-1" role="group" aria-label={ui.highlight}>
              {HIGHLIGHT_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => paint(c)} aria-label={`${ui.highlight}: ${ui.colors[c]}`} title={ui.colors[c]} className={`hl-swatch hl-${c}`} />
              ))}
              {[...selected].some((v) => marks[v]) && (
                <button type="button" onClick={() => paint(null)} aria-label={ui.removeHighlight} title={ui.removeHighlight} className="hl-swatch hl-none">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              )}
            </span>
            <button type="button" onClick={copyText} className="btn btn-ghost !h-8 !px-3 !text-xs">
              {copied === "text" ? ui.copied : ui.copy}
            </button>
            <button type="button" onClick={share} className="btn btn-ghost !h-8 !px-3 !text-xs">
              {copied === "link" ? ui.linkCopied : ui.share}
            </button>
            <Link href={askHref} className="btn btn-ghost !h-8 !px-3 !text-xs" onClick={() => track("scripture_share", { reference, action: "ask" })}>
              {ui.ask}
            </Link>
            <button type="button" onClick={writeWith} className="btn btn-ghost !h-8 !px-3 !text-xs">
              {ui.write}
            </button>
            <button type="button" onClick={clear} aria-label={ui.clear} className="ml-1 rounded-full p-1.5 text-parchment-500 hover:bg-ink-700 hover:text-parchment-50">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** "3,7-9" → {3,7,8,9} */
function parseSel(v: string | null): Set<number> {
  const out = new Set<number>();
  if (!v) return out;
  for (const part of v.split(",")) {
    const m = /^(\d{1,3})(?:-(\d{1,3}))?$/.exec(part.trim());
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2] ?? m[1]);
    for (let i = Math.min(a, b); i <= Math.max(a, b) && i - a < 200; i++) out.add(i);
  }
  return out;
}

/** {3,7,8,9} → "3,7-9" */
function formatSel(s: Set<number>): string {
  const sorted = [...s].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j > i ? `${sorted[i]}-${sorted[j]}` : String(sorted[i]));
    i = j + 1;
  }
  return parts.join(",");
}

const UI: Record<string, { wordHint: string; highlight: string; removeHighlight: string; colors: Record<HighlightColor, string>; hint: string; copy: string; copied: string; share: string; linkCopied: string; ask: string; write: string; clear: string; askQuestion: (ref: string) => string }> = {
  en: { wordHint: "Tap any Hebrew or Greek word for its root and meaning.", highlight: "Highlight", removeHighlight: "Remove highlight", colors: { yellow: "Yellow", green: "Green", blue: "Blue", pink: "Pink", violet: "Violet" }, hint: "Click a verse to select it; click more to add, or hold Shift to select a run. Pick a color to keep a highlight; sign in and it follows you to any device.", copy: "Copy", copied: "Copied", share: "Share", linkCopied: "Link copied", ask: "Ask about this", write: "Write a testimony", clear: "Clear selection", askQuestion: (ref) => `Which testimonies speak to ${ref}, and what does this passage say?` },
  es: { wordHint: "Toca cualquier palabra hebrea o griega para ver su raíz y significado.", highlight: "Resaltar", removeHighlight: "Quitar resaltado", colors: { yellow: "Amarillo", green: "Verde", blue: "Azul", pink: "Rosa", violet: "Violeta" }, hint: "Haz clic en un versículo para seleccionarlo; sigue haciendo clic para añadir, o mantén Shift para un rango. Elige un color para guardar un resaltado; con sesión iniciada te sigue a cualquier dispositivo.", copy: "Copiar", copied: "Copiado", share: "Compartir", linkCopied: "Enlace copiado", ask: "Preguntar sobre esto", write: "Escribir un testimonio", clear: "Quitar selección", askQuestion: (ref) => `¿Qué testimonios hablan de ${ref} y qué dice este pasaje?` },
  pt: { wordHint: "Toque em qualquer palavra hebraica ou grega para ver sua raiz e significado.", highlight: "Destacar", removeHighlight: "Remover destaque", colors: { yellow: "Amarelo", green: "Verde", blue: "Azul", pink: "Rosa", violet: "Violeta" }, hint: "Clique num versículo para selecioná-lo; continue clicando para adicionar, ou segure Shift para um trecho. Escolha uma cor para guardar um destaque; com sessão iniciada ele segue você em qualquer dispositivo.", copy: "Copiar", copied: "Copiado", share: "Compartilhar", linkCopied: "Link copiado", ask: "Perguntar sobre isto", write: "Escrever um testemunho", clear: "Limpar seleção", askQuestion: (ref) => `Quais testemunhos falam de ${ref} e o que diz esta passagem?` },
};
