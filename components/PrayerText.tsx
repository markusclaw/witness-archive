"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { languageDisplayName, readerLanguage } from "@/lib/reader-language";

type Text = { title: string; body: string; answer?: string | null };

/**
 * A request's title/body/answer, shown in the reader's language when it was
 * written in another. Renders the original first, then swaps in the cached
 * or freshly made translation with a small note and a way back.
 */
export default function PrayerText({
  id,
  language,
  text,
  variant,
  href,
  answered = false,
  metaLine,
  answeredLabel,
}: {
  id: string;
  language: string;
  text: Text;
  variant: "card" | "page";
  /** card: where the title links */
  href?: string;
  answered?: boolean;
  /** page: "name · date" under the title */
  metaLine?: string;
  /** page: eyebrow above the answer */
  answeredLabel?: string;
}) {
  const [translated, setTranslated] = useState<Text | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [reader, setReader] = useState<string>(language);

  useEffect(() => {
    const to = readerLanguage();
    queueMicrotask(() => setReader(to));
    if (to === language) return;
    let cancelled = false;
    fetch(`/api/prayer/translate?kind=request&id=${encodeURIComponent(id)}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { text?: Text } | null) => {
        if (!cancelled && j?.text) setTranslated(j.text);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id, language]);

  const useTranslation = !!translated && !showOriginal;
  const t = useTranslation ? translated! : text;
  const lang = useTranslation ? reader : language;
  const note = translated ? (
    <span className="text-xs text-parchment-500">
      {useTranslation ? `Translated from ${languageDisplayName(language, reader)}` : `Original (${languageDisplayName(language, reader)})`}
      {" · "}
      <button type="button" onClick={() => setShowOriginal((v) => !v)} className="underline hover:text-gold-300">
        {useTranslation ? "Show original" : "Show translation"}
      </button>
    </span>
  ) : null;

  if (variant === "card") {
    return (
      <>
        <h3 className="font-display mt-3 text-2xl font-light leading-snug text-parchment-50">
          <Link href={href ?? `/pray/${id}`} className="hover:text-gold-300" dir="auto" lang={lang}>{t.title}</Link>
        </h3>
        <p className="mt-2 line-clamp-3 text-parchment-300" dir="auto" lang={lang}>{t.body}</p>
        {answered && t.answer && (
          <p className="mt-3 border-l-2 border-gold-500/50 pl-3 text-sm text-parchment-100">
            <span className="text-gold-400">Answered: </span>
            <span className="line-clamp-2" dir="auto" lang={lang}>{t.answer}</span>
          </p>
        )}
        {note && <p className="mt-2">{note}</p>}
      </>
    );
  }

  return (
    <>
      <h1 className="font-display mt-4 text-4xl font-light leading-tight text-parchment-50" dir="auto" lang={lang}>{t.title}</h1>
      <p className="mt-3 text-sm text-parchment-500">
        {metaLine}
        {note && <> · {note}</>}
      </p>
      <div className="prose-testimony mt-8 whitespace-pre-wrap" dir="auto" lang={lang}>{t.body}</div>
      {answered && t.answer && (
        <section className="mt-10 rounded-xl border border-gold-500/40 bg-gold-500/5 p-6">
          <p className="eyebrow mb-2">{answeredLabel ?? "Answered"}</p>
          <p className="whitespace-pre-wrap text-parchment-100" dir="auto" lang={lang}>{t.answer}</p>
        </section>
      )}
    </>
  );
}

/** The same for a single reply. */
export function ReplyText({ id, content, requestLanguage }: { id: string; content: string; requestLanguage?: string }) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    const to = readerLanguage();
    // A reply is usually in the request's language; only fetch when the reader's differs or we can't tell.
    if (requestLanguage && requestLanguage === to && looksLike(content, to)) return;
    let cancelled = false;
    fetch(`/api/prayer/translate?kind=reply&id=${encodeURIComponent(id)}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { text?: { content: string } } | null) => {
        if (!cancelled && j?.text?.content && j.text.content.trim() !== content.trim()) setTranslated(j.text.content);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id, content, requestLanguage]);

  const shown = translated && !showOriginal ? translated : content;
  return (
    <>
      <p className="mt-1 whitespace-pre-wrap text-parchment-100" dir="auto">{shown}</p>
      {translated && (
        <button type="button" onClick={() => setShowOriginal((v) => !v)} className="mt-0.5 text-[0.7rem] text-parchment-700 underline hover:text-gold-300">
          {showOriginal ? "Show translation" : "Translated · show original"}
        </button>
      )}
    </>
  );
}

/** Cheap guess so replies in the reader's own language skip the round trip. */
function looksLike(text: string, lang: string): boolean {
  if (/[؀-ۿ֐-׿Ѐ-ӿ぀-ヿ一-鿿가-힯]/.test(text)) return false;
  const t = ` ${text.toLowerCase()} `;
  const marks: Record<string, RegExp> = {
    en: /\s(the|and|you|for|with|that|your)\s/,
    es: /\s(que|por|para|con|los|las|una|dios)\s/,
    pt: /\s(que|por|para|com|uma|você|deus|não)\s/,
  };
  const re = marks[lang];
  return re ? re.test(t) : true;
}
