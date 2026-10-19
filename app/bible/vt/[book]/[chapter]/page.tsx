import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BOOKS, bookBySlug, bookSlug } from "@/lib/scripture";
import { KIND_LABEL, NOTE_LABEL, STATUS_LABEL, getVtChapter, type VtCheck } from "@/lib/vt";

export const dynamic = "force-dynamic";

type Params = Promise<{ book: string; chapter: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await params;
  const b = bookBySlug(p.book);
  return { title: b ? `${b.names.es} ${p.chapter} — Versión Testigo (revisión)` : "Versión Testigo", robots: { index: false, follow: false } };
}

const SEVERITY: Record<VtCheck["severity"], { label: string; cls: string }> = {
  error: { label: "Error", cls: "border-ember-500/50 text-ember-500" },
  warn: { label: "Revisar", cls: "border-gold-500/50 text-gold-300" },
  info: { label: "Nota", cls: "border-ink-500 text-parchment-500" },
};
const STATUS_CLS = { draft: "border-ink-500 text-parchment-500", reviewed: "border-sky-400/50 text-sky-300", approved: "border-emerald-400/50 text-emerald-300" } as const;
const CHECK_KIND: Record<string, string> = { glossary: "glosario", names: "nombres", style: "estilo", echo: "redacción compartida", benchmark: "contraste con BSB" };

const date = (iso: string) => new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });

export default async function VtChapterPage({ params }: { params: Params }) {
  const p = await params;
  const b = bookBySlug(p.book);
  const chapter = Number(p.chapter);
  if (!b || !Number.isInteger(chapter) || chapter < 1 || chapter > b.chapters) notFound();
  const { verses, revisions, checks, original, bsb } = await getVtChapter(b.index, chapter);
  if (!verses.length) notFound();
  const name = b.names.es;
  const he = b.index < 39;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-24 sm:py-16" lang="es">
      <p className="text-xs text-parchment-500">
        <Link href="/bible/vt" className="hover:text-gold-300">Versión Testigo</Link> / {name} {chapter}
      </p>
      <h1 className="font-display mt-3 text-3xl text-parchment-50 sm:text-4xl">{name} {chapter} <span className="text-parchment-500">· revisión</span></h1>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link href={`/bible/${bookSlug(b)}/${chapter}?lang=es&ver=vt`} className="text-gold-400 hover:text-gold-300">Leer en el lector →</Link>
        {chapter > 1 && <Link href={`/bible/vt/${bookSlug(b)}/${chapter - 1}`} className="text-parchment-500 hover:text-parchment-100">← {name} {chapter - 1}</Link>}
        {chapter < b.chapters && <Link href={`/bible/vt/${bookSlug(b)}/${chapter + 1}`} className="text-parchment-500 hover:text-parchment-100">{name} {chapter + 1} →</Link>}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-parchment-500">
        Para cada versículo: el texto actual y su estado, las notas del traductor, el {he ? "hebreo" : "griego"} original, la Berean Standard Bible como referencia, las comprobaciones automáticas y el historial completo.
      </p>

      <ol className="mt-10 space-y-6">
        {verses.map((v) => {
          const hist = revisions.get(v.verse) ?? [];
          const vChecks = (checks.get(v.verse) ?? []).filter((c) => !c.resolved);
          const back = vChecks.find((c) => c.kind === "backtranslation");
          const flags = vChecks.filter((c) => c.kind !== "backtranslation").sort((a, z) => ["error", "warn", "info"].indexOf(a.severity) - ["error", "warn", "info"].indexOf(z.severity));
          return (
            <li key={v.verse} id={`v${v.verse}`} className="scroll-mt-24 rounded-xl border border-ink-600 bg-ink-900/40 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <a href={`#v${v.verse}`} className="font-display text-lg text-gold-300">{chapter}:{v.verse}</a>
                <span className={`rounded-full border px-2 py-0.5 text-[0.7rem] ${STATUS_CLS[v.status]}`}>{STATUS_LABEL[v.status]}</span>
              </div>
              <p className="mt-2 text-[1.05rem] leading-relaxed text-parchment-50">{v.text}</p>

              {v.notes?.length > 0 && (
                <ul className="mt-3 space-y-1 border-l-2 border-gold-500/30 pl-3 text-sm text-parchment-300">
                  {v.notes.map((n, i) => (
                    <li key={i}><span className="text-parchment-500">{NOTE_LABEL[n.type] ?? n.type}:</span> {n.text}</li>
                  ))}
                </ul>
              )}

              {original.get(v.verse) && (
                <p className={`mt-4 text-parchment-100 ${he ? "verse-he text-right text-xl" : "verse-el"}`} lang={he ? "he" : "el"} dir={he ? "rtl" : "ltr"}>{original.get(v.verse)}</p>
              )}
              {bsb.get(v.verse) && (
                <p className="mt-2 text-sm text-parchment-500" lang="en"><span className="text-parchment-700">BSB:</span> {bsb.get(v.verse)}</p>
              )}
              {back && (
                <p className="mt-1 text-sm text-parchment-500" lang="en"><span className="text-parchment-700">De vuelta al inglés:</span> {back.message}</p>
              )}

              {flags.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {flags.map((c, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className={`h-fit shrink-0 rounded border px-1.5 text-[0.65rem] uppercase tracking-wide ${SEVERITY[c.severity].cls}`}>{SEVERITY[c.severity].label}</span>
                      <span className="text-parchment-300">
                        <span className="text-parchment-700">{CHECK_KIND[c.kind] ?? c.kind}{c.revision_id !== v.revision_id ? " · sobre una versión anterior" : ""}: </span>
                        {c.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {hist.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-parchment-500 hover:text-parchment-100">Historial · {hist.length} {hist.length === 1 ? "entrada" : "entradas"}</summary>
                  <ol className="mt-2 space-y-2 border-l border-ink-600 pl-3">
                    {hist.map((h) => (
                      <li key={h.id}>
                        <span className="text-parchment-300">{KIND_LABEL[h.kind]}</span>
                        <span className="text-parchment-700"> · {h.author.startsWith("ai:") ? `IA (${h.author.slice(3)})` : h.author} · {date(h.created_at)}</span>
                        {h.comment && <span className="block text-parchment-300">«{h.comment}»</span>}
                        {(h.kind === "ai_draft" || h.kind === "edit") && <span className="block text-parchment-500">{h.text}</span>}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-10 text-xs text-parchment-700">
        {BOOKS[b.index].names.es}: texto hebreo del Códice de Leningrado (dominio público); referencia en inglés: Berean Standard Bible (dominio público).
      </p>
    </main>
  );
}
