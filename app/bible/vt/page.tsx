import type { Metadata } from "next";
import Link from "next/link";
import VtBook from "@/components/VtBook";
import { bookSlug } from "@/lib/scripture";
import { getVtBook } from "@/lib/vt";
import { VT_LAYOUT } from "@/lib/vt-layout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rut — Versión Testigo",
  description: "El libro de Rut en la Versión Testigo: una traducción abierta al español hecha desde el hebreo.",
  // In progress: shared by link, not listed in search engines yet.
  robots: { index: false, follow: false },
};

/** The pilot book of the Versión Testigo, set as a book. */
const PILOT = 7; // Ruth

export default async function VtHomePage() {
  const chapters = await getVtBook(PILOT);
  const layout = VT_LAYOUT[PILOT];
  return (
    <main className="mx-auto max-w-2xl px-6 py-14 pb-28 sm:py-20" lang="es">
      {chapters.length ? (
        <VtBook book={PILOT} slug={bookSlug(PILOT)} layout={layout} chapters={chapters} />
      ) : (
        <p className="text-center text-parchment-500">El texto todavía no se ha cargado.</p>
      )}

      <footer className="mt-20 border-t border-ink-700 pt-8 text-center text-sm">
        <p className="text-parchment-500">
          La Versión Testigo es una traducción abierta en desarrollo, hecha desde el hebreo y el griego con ayuda de IA y revisión humana.
        </p>
        <p className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
          <Link href="/bible/vt/acerca" className="text-gold-400 hover:text-gold-300">Acerca del proyecto</Link>
          <Link href={`/bible/vt/${bookSlug(PILOT)}/1`} className="text-gold-400 hover:text-gold-300">Revisión versículo por versículo</Link>
          <Link href={`/bible/${bookSlug(PILOT)}/1?lang=es&ver=vt`} className="text-gold-400 hover:text-gold-300">Abrir en el lector</Link>
        </p>
      </footer>
    </main>
  );
}
