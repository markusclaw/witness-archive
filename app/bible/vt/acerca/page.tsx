import type { Metadata } from "next";
import Link from "next/link";
import { BOOKS, bookSlug } from "@/lib/scripture";
import { getVtProgress } from "@/lib/vt";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Versión Testigo — acerca del proyecto",
  description: "Una traducción abierta de la Biblia al español, hecha desde el hebreo y el griego, con el historial de cada versículo a la vista.",
  // In progress: shared by link with reviewers, not listed in search engines yet.
  robots: { index: false, follow: false },
};

const STEPS = [
  ["Borrador desde el original", "Una IA traduce cada versículo a partir de las palabras hebreas o griegas, con su número Strong, su análisis gramatical y su definición. Sigue una guía de estilo y un glosario públicos, y nunca ve una traducción publicada."],
  ["Comprobaciones automáticas", "Se verifica el glosario (cada término clave traducido siempre igual), la ortografía de los nombres y el estilo, y se compara la redacción con otras traducciones para no copiar textos con derechos de autor."],
  ["Contraste con una referencia", "Otro modelo traduce el borrador de vuelta al inglés y lo compara con el original y con la Berean Standard Bible, señalando diferencias de significado."],
  ["Revisión humana", "Especialistas en hebreo y griego revisan cada versículo. Cada corrección queda registrada con el nombre de quien la hizo y el motivo."],
  ["Aprobación", "Un comité aprueba el texto final. Nada cambia en silencio: el historial completo de cada versículo es público."],
];

export default async function VtProjectPage() {
  const progress = await getVtProgress();
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-24 sm:py-16" lang="es">
      <p className="text-xs text-parchment-500">
        <Link href="/bible/vt" className="hover:text-gold-300">Versión Testigo</Link> / Acerca del proyecto
      </p>
      <p className="eyebrow mt-6">Proyecto piloto · borrador</p>
      <h1 className="font-display mt-2 text-4xl text-parchment-50 sm:text-5xl">Versión Testigo</h1>
      <p className="mt-4 text-lg leading-relaxed text-parchment-300">
        La edición en español de la <Link href="/bible/obt/about" className="text-gold-400 hover:text-gold-300" lang="en">Open Bible Translation</Link>: una traducción abierta de la Biblia, hecha directamente desde el hebreo y el griego, con ayuda de inteligencia artificial y bajo revisión humana. Cada versículo muestra su historial completo: el borrador, las correcciones, quién las hizo y por qué.
      </p>
      <p className="mt-3 text-sm text-parchment-500">
        «Ustedes son hoy testigos» — Rut 4:9
      </p>

      <section className="mt-12">
        <h2 className="eyebrow mb-4">Progreso</h2>
        {progress.length ? (
          <div className="overflow-hidden rounded-xl border border-ink-600">
            <table className="w-full text-sm">
              <thead className="bg-ink-900 text-left text-xs uppercase tracking-wider text-parchment-500">
                <tr>
                  <th className="px-4 py-2 font-normal">Libro</th>
                  <th className="px-4 py-2 font-normal">Borrador</th>
                  <th className="px-4 py-2 font-normal">Revisado</th>
                  <th className="px-4 py-2 font-normal">Aprobado</th>
                </tr>
              </thead>
              <tbody>
                {progress.map((p) => (
                  <tr key={p.book} className="border-t border-ink-700">
                    <td className="px-4 py-3">
                      <span className="text-parchment-100">{BOOKS[p.book].names.es}</span>
                      <span className="ml-2 inline-flex flex-wrap gap-1">
                        {p.chapters.map((c) => (
                          <Link key={c} href={`/bible/vt/${bookSlug(p.book)}/${c}`} className="rounded border border-ink-600 px-1.5 text-xs text-gold-400 hover:border-gold-500/50">{c}</Link>
                        ))}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-parchment-300">{p.draft}</td>
                    <td className="px-4 py-3 tabular-nums text-parchment-300">{p.reviewed}</td>
                    <td className="px-4 py-3 tabular-nums text-parchment-300">{p.approved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-parchment-500">Todavía no hay versículos cargados.</p>
        )}
        {progress.length > 0 && (
          <p className="mt-3 text-sm">
            <Link href={`/bible/${bookSlug(progress[0].book)}/1?lang=es&ver=vt`} className="text-gold-400 hover:text-gold-300">Leer {BOOKS[progress[0].book].names.es} en el lector →</Link>
          </p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="eyebrow mb-4">Cómo se traduce</h2>
        <ol className="space-y-4">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold-500/50 text-xs text-gold-300">{i + 1}</span>
              <span>
                <span className="block text-parchment-100">{title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-parchment-500">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="eyebrow mb-4">Cómo usamos otras traducciones</h2>
        <div className="space-y-3 leading-relaxed text-parchment-300">
          <p>
            Traducida directamente del hebreo y del griego. Cada versículo lo redacta una IA solo a partir de las palabras del idioma original, sin consultar ninguna traducción publicada. Después se compara con el original y con la Berean Standard Bible, una traducción de dominio público de confianza, y una persona evalúa cada diferencia de significado.
          </p>
          <p>
            Cuando la comparación lleva a un cambio, el motivo queda registrado en el historial público de ese versículo. La Berean Standard Bible sirve como una segunda opinión que detecta errores, no como un texto que copiamos, y no siempre tiene la razón: algunas de sus sugerencias se aceptan y otras no.
          </p>
          <p className="text-sm text-parchment-500">
            Los modelos de IA han leído muchas Biblias durante su entrenamiento, así que no solo prometemos independencia: medimos cuánto coincide nuestra redacción con otras traducciones y lo publicamos en el informe de cada libro.
          </p>
        </div>
      </section>

      <section className="mt-12 space-y-3 text-sm leading-relaxed text-parchment-500">
        <h2 className="eyebrow mb-1">Textos de partida y licencia</h2>
        <p>Antiguo Testamento: Códice de Leningrado (Westminster Leningrad Codex), dominio público. Nuevo Testamento: SBL Greek New Testament (CC BY 4.0). Referencia de contraste: Berean Standard Bible (dominio público).</p>
        <p>La licencia de la Versión Testigo se definirá antes de su publicación. La intención es que sea libre para leer, citar, compartir e imprimir.</p>
      </section>
    </main>
  );
}
