import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BIBLE_UI, BOOKS, OT_COUNT, TRANSLATION_FOR_LANGUAGE, bookSlug, translationFor } from "@/lib/scripture";
import { BibleLanguagePicker, BibleLanguageSync } from "@/components/BibleLanguage";

export const metadata: Metadata = {
  title: "The Bible",
  description: "Read the Bible in English, Spanish or Portuguese — the same public-domain texts that open behind every scripture reference in the archive.",
  alternates: { canonical: "/bible" },
};

type SearchParams = Promise<{ lang?: string }>;

function readerLang(lang: string | undefined): string {
  return lang && TRANSLATION_FOR_LANGUAGE[lang] ? lang : "en";
}

export default async function BiblePage({ searchParams }: { searchParams: SearchParams }) {
  const lang = readerLang((await searchParams).lang);
  const ui = BIBLE_UI[lang];
  const t = translationFor(lang);
  const q = lang === "en" ? "" : `?lang=${lang}`;

  const grid = (books: typeof BOOKS) => (
    <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 md:grid-cols-4">
      {books.map((b) => (
        <li key={b.osis}>
          <Link href={`/bible/${bookSlug(b)}${q}`} className="flex items-baseline justify-between gap-2 rounded px-1 py-0.5 text-parchment-200 hover:bg-ink-800 hover:text-gold-300" lang={lang}>
            <span>{b.names[lang] ?? b.names.en}</span>
            <span className="text-xs tabular-nums text-parchment-700">{b.chapters}</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <Suspense>
        <BibleLanguageSync current={lang} />
      </Suspense>
      <p className="eyebrow mb-3">Scripture</p>
      <h1 className="font-display text-4xl font-light leading-tight text-parchment-50 sm:text-5xl" lang={lang}>{ui.bible}</h1>
      <div className="mt-5">
        <Suspense>
          <BibleLanguagePicker current={lang} label={ui.readIn} translationName={t.name} />
        </Suspense>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-parchment-100" lang={lang}>{ui.ot}</h2>
        {grid(BOOKS.slice(0, OT_COUNT))}
      </section>
      <section className="mt-10">
        <h2 className="font-display text-2xl text-parchment-100" lang={lang}>{ui.nt}</h2>
        {grid(BOOKS.slice(OT_COUNT))}
      </section>
    </main>
  );
}
