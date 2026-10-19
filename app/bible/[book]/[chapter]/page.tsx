import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BIBLE_UI, BOOKS, TRANSLATION_FOR_LANGUAGE, VERSIONS, bookBySlug, bookSlug, originalFor, translationFor } from "@/lib/scripture";
import { getChapter, getChapterWords, usableVersion } from "@/lib/bible";
import { esvEnabled } from "@/lib/esv";
import { BibleLanguagePicker, BibleLanguageSync, OriginalToggle } from "@/components/BibleLanguage";
import ChapterText from "@/components/ChapterText";
import { ChapterTitle, MobileChapterBar, TextSizeButton, TextSizeInit } from "@/components/ReaderChrome";
import TestimonyCard from "@/components/TestimonyCard";
import { getChapterMentions } from "@/lib/scripture-index";
import { formatReference } from "@/lib/scripture";

export const dynamic = "force-dynamic";

type Params = Promise<{ book: string; chapter: string }>;
type SearchParams = Promise<{ lang?: string; v?: string; orig?: string; ver?: string }>;

function readerLang(lang: string | undefined): string {
  return lang && TRANSLATION_FOR_LANGUAGE[lang] ? lang : "en";
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const p = await params;
  const b = bookBySlug(p.book);
  const chapter = Number(p.chapter);
  if (!b || !Number.isInteger(chapter) || chapter < 1 || chapter > b.chapters) return { title: "Not found", robots: { index: false } };
  const sp = await searchParams;
  const lang = readerLang(sp.lang);
  const name = b.names[lang] ?? b.names.en;
  const t = translationFor(lang, b.index, usableVersion(sp.ver));
  return {
    title: `${name} ${chapter} — ${t.name}`,
    description: `${name} ${chapter} in the ${t.name}. Read it here, or follow it from the testimonies that mention it.`,
    alternates: { canonical: `/bible/${bookSlug(b)}/${chapter}` },
  };
}

export default async function ChapterPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const p = await params;
  const b = bookBySlug(p.book);
  const chapter = Number(p.chapter);
  if (!b || !Number.isInteger(chapter) || chapter < 1 || chapter > b.chapters) notFound();
  const sp = await searchParams;
  const lang = readerLang(sp.lang);
  const showOriginal = sp.orig === "1";
  const ui = BIBLE_UI[lang];
  const name = b.names[lang] ?? b.names.en;
  // Translations offered in this language (live ones only when configured).
  const offered = VERSIONS[lang].filter((v) => (!v.live || esvEnabled()) && (!v.hidden || v.code === sp.ver) && (!v.books || v.books.includes(b.index)));
  const versionOptions = offered.map(({ code, abbr, name }) => ({ code, abbr, name }));
  const [{ translation, verses }, mentions, original, words] = await Promise.all([
    getChapter(b.index, chapter, lang, offered.some((v) => v.code === sp.ver) ? sp.ver : null),
    getChapterMentions(b.index, chapter),
    showOriginal ? getChapter(b.index, chapter, "orig") : Promise.resolve(null),
    showOriginal ? getChapterWords(b.index, chapter) : Promise.resolve({}),
  ]);
  const originalInfo = originalFor(b.index);
  const qp = new URLSearchParams();
  if (lang !== "en") qp.set("lang", lang);
  if (translation.code !== offered[0].code) qp.set("ver", translation.code);
  const base = qp.toString();
  const q = base ? `?${base}` : "";

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
    <main className="mx-auto max-w-3xl px-5 py-12 pb-24 sm:pb-12">
      <TextSizeInit />
      <Suspense>
        <BibleLanguageSync current={lang} version={translation.code} versions={offered.map((v) => v.code)} />
      </Suspense>
      <p className="text-xs text-parchment-500">
        <Link href={`/bible${q}`} className="hover:text-gold-300">{ui.bible}</Link> / <Link href={`/bible/${bookSlug(b)}${q}`} className="hover:text-gold-300" lang={lang}>{name}</Link>
      </p>
      <ChapterTitle lang={lang} book={b.index} chapter={chapter} name={name} />
      <p className="mt-2 text-xs text-parchment-700 sm:hidden">{translation.name}{showOriginal && ` · ${originalInfo.name}`}</p>
      <div className="mt-5 hidden flex-wrap items-center justify-between gap-3 sm:flex">
        <Suspense>
          <BibleLanguagePicker current={lang} label={ui.readIn} translationName={translation.name} version={translation.code} versions={versionOptions} />
        </Suspense>
        <span className="flex items-center gap-3 text-xs text-parchment-700">
          <Suspense>
            <OriginalToggle on={showOriginal} label={ui.original} script={originalInfo.script} />
          </Suspense>
          <span>{verses.length} {ui.verses}</span>
          <TextSizeButton label={ui.textSize} />
        </span>
      </div>

      {translation.draft && (
        <div className="mt-6 rounded-xl border border-gold-500/40 bg-gold-500/5 px-4 py-3 text-sm leading-relaxed text-parchment-300" lang="es">
          <strong className="text-gold-300">Borrador · {translation.name.replace(/ \(borrador\)$/, "")}.</strong> Traducido del {b.index < 39 ? "hebreo" : "griego"} con ayuda de IA; todavía no ha sido revisado por especialistas.{" "}
          <Link href={`/bible/vt/${bookSlug(b)}/${chapter}`} className="text-gold-400 underline-offset-2 hover:underline">Ver notas, revisiones e historial de cada versículo →</Link>
        </div>
      )}

      <div className="mt-10">
        {verses.length ? (
          <Suspense>
            <ChapterText verses={verses} lang={lang} book={name} bookIndex={b.index} chapter={chapter} translation={translation.abbr} original={original ? { language: originalInfo.language, name: originalInfo.name, verses: Object.fromEntries(original.verses.map((v) => [v.verse, v.text])), words } : null} />
          </Suspense>
        ) : (
          <p className="rounded-xl border border-ink-600 bg-ink-900/60 px-5 py-4 text-sm text-parchment-500" lang={lang}>{ui.notLoaded}</p>
        )}
      </div>

      <div className="mt-12 hidden border-t border-ink-700 pt-6 sm:block">{nav}</div>

      <section className="mt-14" aria-labelledby="mentions">
        <h2 id="mentions" className="eyebrow" lang={lang}>{ui.mentions}</h2>
        {mentions.length ? (
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            {mentions.map(({ testimony, refs }) => (
              <div key={testimony.id} className="flex flex-col gap-2">
                <TestimonyCard testimony={testimony} />
                <p className="flex flex-wrap gap-1.5 px-1 text-xs text-parchment-500">
                  {refs.map((r) => (
                    <Link key={formatReference(r, "en")} href={`/bible/${bookSlug(b)}/${chapter}${r.verse != null ? `?v=${r.verse}${r.verseEnd != null ? `-${r.verseEnd}` : ""}${base ? `&${base}` : ""}` : q}`} className="chip chip-interactive" lang={lang}>
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
      <MobileChapterBar
        lang={lang}
        book={b.index}
        chapter={chapter}
        name={name}
        prev={prev ? { href: `/bible/${bookSlug(prev.book)}/${prev.chapter}${q}`, label: `${prev.book.names[lang] ?? prev.book.names.en} ${prev.chapter}` } : null}
        next={next ? { href: `/bible/${bookSlug(next.book)}/${next.chapter}${q}`, label: `${next.book.names[lang] ?? next.book.names.en} ${next.chapter}` } : null}
        settings={{ lang, showOriginal, script: originalInfo.script, version: translation.code, versions: versionOptions, labels: { title: ui.readingSettings, textSize: ui.textSize, readIn: ui.readIn, original: ui.original, done: ui.done, version: ui.version } }}
      />
      <p className="mt-6 text-[0.7rem] text-parchment-700">
        {translation.code === "esv" ? (
          <>
            Scripture quotations are from the{" "}
            <a href="https://www.esv.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-parchment-300">ESV® Bible</a>
            {" "}(English Standard Version®), © 2001 by Crossway. Used by permission. All rights reserved.{" "}
            <Link href="/bible/copyright" className="underline underline-offset-2 hover:text-parchment-300">{ui.copyright}</Link>
          </>
        ) : (
          <>{translation.name} · {translation.credit}</>
        )}
        {original && <> · {originalInfo.name}{originalInfo.language === "el" ? " · CC BY 4.0, SBL & Logos" : " · public domain"}</>}
      </p>
    </main>
  );
}
