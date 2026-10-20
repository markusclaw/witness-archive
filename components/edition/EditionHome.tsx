import Link from "next/link";
import VtBook from "@/components/VtBook";
import { bookSlug } from "@/lib/scripture";
import { getVtBook } from "@/lib/vt";
import { LAYOUT } from "@/lib/vt-layout";
import { EDITIONS, type EditionCode } from "@/lib/editions";

/** The pilot book of each edition. */
export const PILOT = 7; // Ruth

/** An edition's front page: its pilot book, set as a book. */
export default async function EditionHome({ edition: code }: { edition: EditionCode }) {
  const edition = EDITIONS[code];
  const other = EDITIONS[code === "obt" ? "vt" : "obt"];
  const chapters = await getVtBook(PILOT, code);
  const layout = LAYOUT[code][PILOT];
  const ui = edition.ui;
  return (
    <main className="mx-auto max-w-2xl px-6 py-14 pb-28 sm:py-20" lang={edition.lang}>
      {chapters.length ? (
        <VtBook edition={code} book={PILOT} slug={bookSlug(PILOT)} layout={layout} chapters={chapters} />
      ) : (
        <p className="text-center text-parchment-500">{ui.notLoaded}</p>
      )}

      <footer className="mt-20 border-t border-ink-700 pt-8 text-center text-sm">
        <p className="text-parchment-500">{ui.bookFooter}</p>
        <p className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
          <Link href={edition.about} className="text-gold-400 hover:text-gold-300">{ui.aboutLink}</Link>
          <Link href={`${edition.path}/${bookSlug(PILOT)}/1`} className="text-gold-400 hover:text-gold-300">{ui.reviewLink}</Link>
          <Link href={`/bible/${bookSlug(PILOT)}/1?${edition.lang === "en" ? "" : `lang=${edition.lang}&`}ver=${code}`} className="text-gold-400 hover:text-gold-300">{ui.readerLink}</Link>
        </p>
        <p className="mt-6">
          <Link href={other.path} className="text-parchment-500 hover:text-gold-300" lang={other.lang}>{ui.otherEdition} →</Link>
        </p>
      </footer>
    </main>
  );
}
