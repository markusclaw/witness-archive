import Link from "next/link";
import { notFound } from "next/navigation";
import { BOOKS, bookBySlug, bookSlug } from "@/lib/scripture";
import { getVtChapter, type VtCheck } from "@/lib/vt";
import { EDITIONS, originalName, type EditionCode } from "@/lib/editions";
import { getChapterWords } from "@/lib/bible";
import OriginalWords from "@/components/OriginalWords";

type Params = Promise<{ book: string; chapter: string }>;

export function reviewMetadata(code: EditionCode, slug: string, chapter: string) {
  const b = bookBySlug(slug);
  const e = EDITIONS[code];
  return { title: b ? `${b.names[e.lang] ?? b.names.en} ${chapter} — ${e.name} (${e.ui.review.title})` : e.name, robots: { index: false, follow: false } };
}

const SEVERITY_CLS: Record<VtCheck["severity"], string> = {
  error: "border-ember-500/50 text-ember-500",
  warn: "border-gold-500/50 text-gold-300",
  info: "border-ink-500 text-parchment-500",
};
const STATUS_CLS = { draft: "border-ink-500 text-parchment-500", reviewed: "border-sky-400/50 text-sky-300", approved: "border-emerald-400/50 text-emerald-300" } as const;
/** One chapter of an edition, verse by verse, with everything a reviewer needs. */
export default async function EditionReview({ edition: code, params }: { edition: EditionCode; params: Params }) {
  const edition = EDITIONS[code];
  const ui = edition.ui;
  const r = ui.review;
  const date = (iso: string) => new Date(iso).toLocaleDateString(edition.lang, { day: "numeric", month: "short", year: "numeric" });
  const p = await params;
  const b = bookBySlug(p.book);
  const chapter = Number(p.chapter);
  if (!b || !Number.isInteger(chapter) || chapter < 1 || chapter > b.chapters) notFound();
  const [{ verses, revisions, checks, original, bsb }, words] = await Promise.all([getVtChapter(b.index, chapter, code), getChapterWords(b.index, chapter)]);
  if (!verses.length) notFound();
  const name = b.names[edition.lang] ?? b.names.en;
  const he = b.index < 39;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-24 sm:py-16" lang={edition.lang}>
      <p className="text-xs text-parchment-500">
        <Link href={edition.path} className="hover:text-gold-300">{edition.name}</Link> / {name} {chapter}
      </p>
      <h1 className="font-display mt-3 text-3xl text-parchment-50 sm:text-4xl">{name} {chapter} <span className="text-parchment-500">· {r.title}</span></h1>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link href={`/bible/${bookSlug(b)}/${chapter}?${edition.lang === "en" ? "" : `lang=${edition.lang}&`}ver=${code}`} className="text-gold-400 hover:text-gold-300">{r.reader}</Link>
        {chapter > 1 && <Link href={`${edition.path}/${bookSlug(b)}/${chapter - 1}`} className="text-parchment-500 hover:text-parchment-100">← {name} {chapter - 1}</Link>}
        {chapter < b.chapters && <Link href={`${edition.path}/${bookSlug(b)}/${chapter + 1}`} className="text-parchment-500 hover:text-parchment-100">{name} {chapter + 1} →</Link>}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-parchment-500">
        {r.intro(originalName(edition, b.index))}
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
                <span className={`rounded-full border px-2 py-0.5 text-[0.7rem] ${STATUS_CLS[v.status]}`}>{ui.status[v.status]}</span>
              </div>
              <p className="mt-2 text-[1.05rem] leading-relaxed text-parchment-50">{v.text}</p>

              {v.notes?.length > 0 && (
                <ul className="mt-3 space-y-1 border-l-2 border-gold-500/30 pl-3 text-sm text-parchment-300">
                  {v.notes.map((n, i) => (
                    <li key={i}><span className="text-parchment-500">{ui.noteType[n.type] ?? n.type}:</span> {n.text}</li>
                  ))}
                </ul>
              )}

              {words[v.verse]?.length ? (
                <p className={`mt-4 text-parchment-100 ${he ? "text-right text-xl" : ""}`} dir={he ? "rtl" : "ltr"}>
                  <OriginalWords words={words[v.verse]} language={he ? "he" : "el"} at={{ book: b.index, chapter, verse: v.verse }} readerLang={edition.lang} />
                </p>
              ) : original.get(v.verse) && (
                <p className={`mt-4 text-parchment-100 ${he ? "verse-he text-right text-xl" : "verse-el"}`} lang={he ? "he" : "el"} dir={he ? "rtl" : "ltr"}>{original.get(v.verse)}</p>
              )}
              {bsb.get(v.verse) && (
                <p className="mt-2 text-sm text-parchment-500" lang="en"><span className="text-parchment-700">{r.bsb}</span> {bsb.get(v.verse)}</p>
              )}
              {back && (
                <p className="mt-1 text-sm text-parchment-500" lang="en"><span className="text-parchment-700">{r.back}</span> {back.message}</p>
              )}

              {flags.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {flags.map((c, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className={`h-fit shrink-0 rounded border px-1.5 text-[0.65rem] uppercase tracking-wide ${SEVERITY_CLS[c.severity]}`}>{r.severity[c.severity]}</span>
                      <span className="text-parchment-300">
                        <span className="text-parchment-700">{r.checkKind[c.kind] ?? c.kind}{c.revision_id !== v.revision_id ? r.olderVersion : ""}: </span>
                        {c.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {hist.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-parchment-500 hover:text-parchment-100">{r.history(hist.length)}</summary>
                  <ol className="mt-2 space-y-2 border-l border-ink-600 pl-3">
                    {hist.map((h) => (
                      <li key={h.id}>
                        <span className="text-parchment-300">{ui.kind[h.kind]}</span>
                        <span className="text-parchment-700"> · {h.author.startsWith("ai:") ? r.ai(h.author.slice(3)) : h.author} · {date(h.created_at)}</span>
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
        {r.sources(BOOKS[b.index].names[edition.lang] ?? BOOKS[b.index].names.en)}
      </p>
    </main>
  );
}
