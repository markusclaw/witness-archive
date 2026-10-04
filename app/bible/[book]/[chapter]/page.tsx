import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BIBLE_UI, BOOKS, TRANSLATION_FOR_LANGUAGE, bookBySlug, bookSlug, translationFor } from "@/lib/scripture";
import { getChapter } from "@/lib/bible";
import { BibleLanguagePicker, BibleLanguageSync } from "@/components/BibleLanguage";
import ChapterText from "@/components/ChapterText";
import TestimonyCard from "@/components/TestimonyCard";
import { getChapterMentions } from "@/lib/scripture-index";
import { formatReference } from "@/lib/scripture";

export const dynamic = "force-dynamic";

type Params = Promise<{ book: string; chapter: string }>;
type SearchParams = Promise<{ lang?: string; v?: string }>;

function readerLang(lang: string | undefined): string {
  return lang && TRANSLATION_FOR_LANGUAGE[lang] ? lang : "en";
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const p = await params;
  const b = bookBySlug(p.book);
  const chapter = Number(p.chapter);
  if (!b || !Number.isInteger(chapter) || chapter < 1 || chapter > b.chapters) return { title: "Not found", robots: { index: false } };
  const lang = readerLang((await searchParams).lang);
  const name = b.names[lang] ?? b.names.en;
  return {
    title: `${name} ${chapter} — ${translationFor(lang).name}`,
    description: `${name} ${chapter} in the ${translationFor(lang).name}. Read it here, or follow it from the testimonies that mention it.`,
    alternates: { canonical: `/bible/${bookSlug(b)}/${chapter}` },
  };
}

export default async function ChapterPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const p = await params;
  const b = bookBySlug(p.book);
  const chapter = Number(p.chapter);
  if (!b || !Number.isInteger(chapter) || chapter < 1 || chapter > b.chapters) notFound();
  const lang = readerLang((await searchParams).lang);
  const ui = BIBLE_UI[lang];
  const q = lang === "en" ? "" : `?lang=${lang}`;
  const name = b.names[lang] ?? b.names.en;
  const [{ translation, verses }, mentions] = await Promise.all([getChapter(b.index, chapter, lang), getChapterMentions(b.index, chapter)]);

  // Previous/next run across book boundaries so the reader can keep going.
  const prev = chapter > 1 ? { book: b, chapter: chapter - 1 } : b.index > 0 ? { book: BOOKS[b.index - 1], chapter: BOOKS[b.index - 1].chapters } : null;
  const next = chapter < b.chapters ? { book: b, chapter: chapter + 1 } : b.index < BOOKS.length - 1 ? { book: BOOKS[b.index + 1], chapter: 1 } : null;
  const nav = (
    <nav className="flex items-center justify-between gap-4 text-sm">
      {prev ? (
        <Link href={`/bible/${bookSlug(prev.book)}/${prev.chapter}${q}`} rel="prev" className="text-parchment-500 hover:text-gold-300" lang={lang}>
          ← {prev.book.names[lang] ?? prev.book.names.en} {prev.chapter}
        </Link>
      ) : <span />}
      {next ? (
        <Link href={`/bible/${bookSlug(next.book)}/${next.chapter}${q}`} rel="next" className="text-parchment-500 hover:text-gold-300" lang={lang}>
          {next.book.names[lang] ?? next.book.names.en} {next.chapter} →
        </Link>
      ) : <span />}
    </nav>
  );

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Suspense>
        <BibleLanguageSync current={lang} />
      </Suspense>
      <p className="text-xs text-parchment-500">
        <Link href={`/bible${q}`} className="hover:text-gold-300">{ui.bible}</Link> / <Link href={`/bible/${bookSlug(b)}${q}`} className="hover:text-gold-300" lang={lang}>{name}</Link>
      </p>
      <h1 className="font-display mt-4 text-4xl font-light leading-tight text-parchment-50 sm:text-5xl" lang={lang}>
        {name} {chapter}
      </h1>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Suspense>
          <BibleLanguagePicker current={lang} label={ui.readIn} translationName={translation.name} />
        </Suspense>
        <span className="text-xs text-parchment-700">{verses.length} {ui.verses}</span>
      </div>

      <div className="mt-10">
        {verses.length ? (
          <Suspense>
            <ChapterText verses={verses} lang={lang} />
          </Suspense>
        ) : (
          <p className="rounded-xl border border-ink-600 bg-ink-900/60 px-5 py-4 text-sm text-parchment-500" lang={lang}>{ui.notLoaded}</p>
        )}
      </div>

      <div className="mt-12 border-t border-ink-700 pt-6">{nav}</div>

      <section className="mt-14" aria-labelledby="mentions">
        <h2 id="mentions" className="eyebrow" lang={lang}>{ui.mentions}</h2>
        {mentions.length ? (
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            {mentions.map(({ testimony, refs }) => (
              <div key={testimony.id} className="flex flex-col gap-2">
                <TestimonyCard testimony={testimony} />
                <p className="flex flex-wrap gap-1.5 px-1 text-xs text-parchment-500">
                  {refs.map((r) => (
                    <Link key={formatReference(r, "en")} href={`/bible/${bookSlug(b)}/${chapter}${r.verse != null ? `?v=${r.verse}${r.verseEnd != null ? `-${r.verseEnd}` : ""}${lang === "en" ? "" : `&lang=${lang}`}` : q}`} className="chip chip-interactive" lang={lang}>
                      {formatReference(r, lang)}
                    </Link>
                  ))}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-parchment-500" lang={lang}>{ui.mentionsNone}</p>
        )}
      </section>
      <p className="mt-6 text-[0.7rem] text-parchment-700">{translation.name} · public domain</p>
    </main>
  );
}
