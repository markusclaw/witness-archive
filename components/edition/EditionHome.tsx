import Link from "next/link";
import { bookSlug } from "@/lib/scripture";
import { getVtProgress } from "@/lib/vt";
import { LAYOUT } from "@/lib/vt-layout";
import { EDITIONS, type EditionCode } from "@/lib/editions";

/** An edition's front page: its table of contents — the books translated so far. */
export default async function EditionHome({ edition: code }: { edition: EditionCode }) {
  const edition = EDITIONS[code];
  const other = EDITIONS[code === "obt" ? "vt" : "obt"];
  const progress = await getVtProgress(code);
  const books = progress.filter((p) => LAYOUT[code][p.book]);
  const ui = edition.ui;
  return (
    <main className="mx-auto max-w-2xl px-6 py-14 pb-28 sm:py-20" lang={edition.lang}>
      <header className="text-center">
        <p className="text-[0.7rem] uppercase tracking-[0.35em] text-gold-500">{ui.contents}</p>
        <h1 className="font-display mt-6 text-5xl tracking-tight text-parchment-50 sm:text-6xl">{edition.name}</h1>
        <div className="mx-auto mt-6 flex w-24 items-center gap-2 text-gold-500/60" aria-hidden>
          <span className="h-px flex-1 bg-current" />
          <span className="text-xs">✦</span>
          <span className="h-px flex-1 bg-current" />
        </div>
        <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-parchment-500">{ui.contentsIntro}</p>
      </header>

      {books.length ? (
        <ol className="mt-14 divide-y divide-ink-700 border-y border-ink-700">
          {books.map((p) => {
            const layout = LAYOUT[code][p.book];
            const total = p.draft + p.reviewed + p.approved;
            return (
              <li key={p.book}>
                <Link href={`${edition.path}/${bookSlug(p.book)}`} className="group flex items-baseline justify-between gap-6 py-5">
                  <span>
                    <span className="font-display block text-3xl text-parchment-50 group-hover:text-gold-300">{layout.title}</span>
                    <span className="font-display mt-1 block text-sm italic text-parchment-500">{layout.subtitle}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-parchment-700">
                    {ui.verses(total)}
                    <span className="block">{p.approved ? ui.status.approved : p.reviewed ? ui.status.reviewed : ui.status.draft}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-14 text-center text-parchment-500">{ui.notLoaded}</p>
      )}

      <footer className="mt-20 border-t border-ink-700 pt-8 text-center text-sm">
        <p className="text-parchment-500">{ui.bookFooter}</p>
        <p className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
          <Link href={edition.about} className="text-gold-400 hover:text-gold-300">{ui.aboutLink}</Link>
        </p>
        <p className="mt-6">
          <Link href={other.path} className="text-parchment-500 hover:text-gold-300" lang={other.lang}>{ui.otherEdition} →</Link>
        </p>
      </footer>
    </main>
  );
}
