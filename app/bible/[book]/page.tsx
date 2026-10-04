import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BIBLE_UI, OT_COUNT, TRANSLATION_FOR_LANGUAGE, bookBySlug, bookSlug, translationFor } from "@/lib/scripture";
import { BibleLanguagePicker, BibleLanguageSync } from "@/components/BibleLanguage";

type Params = Promise<{ book: string }>;
type SearchParams = Promise<{ lang?: string }>;

function readerLang(lang: string | undefined): string {
  return lang && TRANSLATION_FOR_LANGUAGE[lang] ? lang : "en";
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const b = bookBySlug((await params).book);
  if (!b) return { title: "Not found", robots: { index: false } };
  const lang = readerLang((await searchParams).lang);
  const name = b.names[lang] ?? b.names.en;
  return { title: `${name} — ${BIBLE_UI[lang].bible}`, description: `${name}: ${b.chapters} ${BIBLE_UI[lang].chapters.toLowerCase()}, ${translationFor(lang).name}.`, alternates: { canonical: `/bible/${bookSlug(b)}` } };
}

export default async function BookPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const b = bookBySlug((await params).book);
  if (!b) notFound();
  const lang = readerLang((await searchParams).lang);
  const ui = BIBLE_UI[lang];
  const t = translationFor(lang);
  const q = lang === "en" ? "" : `?lang=${lang}`;
  const name = b.names[lang] ?? b.names.en;

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <Suspense>
        <BibleLanguageSync current={lang} />
      </Suspense>
      <p className="text-xs text-parchment-500">
        <Link href={`/bible${q}`} className="hover:text-gold-300">{ui.bible}</Link> / <span lang={lang}>{b.index < OT_COUNT ? ui.ot : ui.nt}</span>
      </p>
      <h1 className="font-display mt-4 text-4xl font-light leading-tight text-parchment-50 sm:text-5xl" lang={lang}>{name}</h1>
      <div className="mt-5">
        <Suspense>
          <BibleLanguagePicker current={lang} label={ui.readIn} translationName={t.name} />
        </Suspense>
      </div>
      <h2 className="eyebrow mt-10" lang={lang}>{ui.chapters}</h2>
      <ol className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-10">
        {Array.from({ length: b.chapters }, (_, i) => i + 1).map((c) => (
          <li key={c}>
            <Link href={`/bible/${bookSlug(b)}/${c}${q}`} className="flex h-11 items-center justify-center rounded-lg border border-ink-600 text-sm tabular-nums text-parchment-200 transition hover:border-gold-500 hover:text-gold-300">
              {c}
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
