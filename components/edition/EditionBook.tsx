import Link from "next/link";
import { notFound } from "next/navigation";
import VtBook from "@/components/VtBook";
import { bookBySlug, bookSlug } from "@/lib/scripture";
import { getVtBook } from "@/lib/vt";
import { LAYOUT } from "@/lib/vt-layout";
import { EDITIONS, type EditionCode } from "@/lib/editions";

/** One book of an edition, set as a printed book. */
export default async function EditionBook({ edition: code, slug }: { edition: EditionCode; slug: string }) {
  const edition = EDITIONS[code];
  const b = bookBySlug(slug);
  const layout = b ? LAYOUT[code][b.index] : undefined;
  if (!b || !layout) notFound();
  const chapters = await getVtBook(b.index, code);
  if (!chapters.length) notFound();
  const ui = edition.ui;
  const s = bookSlug(b.index);
  return (
    <main className="mx-auto max-w-2xl px-6 py-14 pb-28 sm:py-20" lang={edition.lang}>
      <p className="mb-10 text-center text-xs">
        <Link href={edition.path} className="text-parchment-500 hover:text-gold-300">{ui.backToContents}</Link>
      </p>
      <VtBook edition={code} book={b.index} slug={s} layout={layout} chapters={chapters} />
      <footer className="mt-20 border-t border-ink-700 pt-8 text-center text-sm">
        <p className="text-parchment-500">{ui.bookFooter}</p>
        <p className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
          <Link href={edition.about} className="text-gold-400 hover:text-gold-300">{ui.aboutLink}</Link>
          <Link href={`${edition.path}/${s}/1`} className="text-gold-400 hover:text-gold-300">{ui.reviewLink}</Link>
          <Link href={`/bible/${s}/1?${edition.lang === "en" ? "" : `lang=${edition.lang}&`}ver=${code}`} className="text-gold-400 hover:text-gold-300">{ui.readerLink}</Link>
        </p>
      </footer>
    </main>
  );
}

export function bookMetadata(code: EditionCode, slug: string) {
  const e = EDITIONS[code];
  const b = bookBySlug(slug);
  const layout = b ? LAYOUT[code][b.index] : undefined;
  return {
    title: layout ? `${layout.title} — ${e.name}` : e.name,
    description: layout ? `${layout.title} · ${layout.subtitle} · ${e.name}` : e.name,
    // In progress: shared by link, not listed in search engines yet.
    robots: { index: false, follow: false },
  };
}
