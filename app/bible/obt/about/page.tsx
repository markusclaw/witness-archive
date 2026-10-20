import type { Metadata } from "next";
import Link from "next/link";
import { BOOKS, bookSlug } from "@/lib/scripture";
import { getVtProgress } from "@/lib/vt";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open Bible Translation — about the project",
  description: "An open Bible translation made directly from the Hebrew and Greek, with the history of every verse in plain view.",
  // In progress: shared by link with reviewers, not listed in search engines yet.
  robots: { index: false, follow: false },
};

const STEPS = [
  ["A draft from the original", "An AI translates each verse from the Hebrew or Greek words, with their Strong's number, grammatical analysis and definition. It follows a public style guide and glossary, and is never shown a published translation."],
  ["Automatic checks", "The glossary (every key term always rendered the same way), the spelling of names and the style are checked, and the wording is compared with other translations so that no copyrighted text is copied."],
  ["Compared with a reference", "A second model compares the draft with the original and with the Berean Standard Bible and flags differences in meaning."],
  ["Human review", "Hebrew and Greek specialists review every verse. Each correction is recorded with the name of the person who made it and the reason."],
  ["Approval", "A committee approves the final text. Nothing changes silently: the full history of every verse is public."],
];

export default async function ObtAboutPage() {
  const progress = await getVtProgress("obt");
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-24 sm:py-16" lang="en">
      <p className="text-xs text-parchment-500">
        <Link href="/bible/obt" className="hover:text-gold-300">Open Bible Translation</Link> / About
      </p>
      <p className="eyebrow mt-6">Pilot project · draft</p>
      <h1 className="font-display mt-2 text-4xl text-parchment-50 sm:text-5xl">Open Bible Translation</h1>
      <p className="mt-4 text-lg leading-relaxed text-parchment-300">
        An open translation of the Bible made directly from the Hebrew and Greek, with the help of artificial intelligence and under human review. Every verse shows its full history: the draft, the corrections, who made them and why. The Spanish edition is the <Link href="/bible/vt" className="text-gold-400 hover:text-gold-300" lang="es">Versión Testigo</Link>.
      </p>
      <p className="mt-3 text-sm text-parchment-500">
        &ldquo;Today you are witnesses.&rdquo; — Ruth 4:9
      </p>

      <section className="mt-12">
        <h2 className="eyebrow mb-4">Progress</h2>
        {progress.length ? (
          <div className="overflow-hidden rounded-xl border border-ink-600">
            <table className="w-full text-sm">
              <thead className="bg-ink-900 text-left text-xs uppercase tracking-wider text-parchment-500">
                <tr>
                  <th className="px-4 py-2 font-normal">Book</th>
                  <th className="px-4 py-2 font-normal">Draft</th>
                  <th className="px-4 py-2 font-normal">Reviewed</th>
                  <th className="px-4 py-2 font-normal">Approved</th>
                </tr>
              </thead>
              <tbody>
                {progress.map((p) => (
                  <tr key={p.book} className="border-t border-ink-700">
                    <td className="px-4 py-3">
                      <span className="text-parchment-100">{BOOKS[p.book].names.en}</span>
                      <span className="ml-2 inline-flex flex-wrap gap-1">
                        {p.chapters.map((c) => (
                          <Link key={c} href={`/bible/obt/${bookSlug(p.book)}/${c}`} className="rounded border border-ink-600 px-1.5 text-xs text-gold-400 hover:border-gold-500/50">{c}</Link>
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
          <p className="text-parchment-500">No verses have been loaded yet.</p>
        )}
        {progress.length > 0 && (
          <p className="mt-3 text-sm">
            <Link href={`/bible/${bookSlug(progress[0].book)}/1?ver=obt`} className="text-gold-400 hover:text-gold-300">Read {BOOKS[progress[0].book].names.en} in the reader →</Link>
          </p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="eyebrow mb-4">How it is translated</h2>
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

      <section className="mt-12 space-y-3 text-sm leading-relaxed text-parchment-500">
        <h2 className="eyebrow mb-1">Source texts and license</h2>
        <p>Old Testament: Westminster Leningrad Codex, public domain. New Testament: SBL Greek New Testament (CC BY 4.0). Reference for comparison: Berean Standard Bible (public domain).</p>
        <p>The license will be settled before publication. The intent is for it to be free to read, quote, share and print.</p>
      </section>
    </main>
  );
}
