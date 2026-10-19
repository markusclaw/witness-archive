import type { Metadata } from "next";
import Link from "next/link";
import { ESV_LIMIT_NOTE, ESV_NOTICE } from "@/lib/esv";
import { ORIGINALS, VERSIONS } from "@/lib/scripture";

export const metadata: Metadata = {
  title: "Bible texts and copyright",
  description: "Where the Bible translations in the Witness Archive come from, and the terms they're used under.",
  alternates: { canonical: "/bible/copyright" },
};

export default function BibleCopyrightPage() {
  const free = Object.values(VERSIONS).flat().filter((v) => !v.live);
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 pb-24 sm:py-16">
      <p className="text-xs text-parchment-500">
        <Link href="/bible" className="hover:text-gold-300">The Bible</Link> / Copyright
      </p>
      <h1 className="font-display mt-3 text-3xl text-parchment-50 sm:text-4xl">Bible texts and copyright</h1>

      <section className="mt-10">
        <h2 className="eyebrow mb-3">English Standard Version (ESV)</h2>
        <p className="leading-relaxed text-parchment-300">{ESV_NOTICE}</p>
        <p className="mt-3 leading-relaxed text-parchment-300">{ESV_LIMIT_NOTE}</p>
        <p className="mt-3 text-sm text-parchment-500">
          The ESV text is provided by the ESV API from Crossway. Read more at{" "}
          <a href="https://www.esv.org" target="_blank" rel="noopener noreferrer" className="text-gold-400 hover:text-gold-300">esv.org</a>.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="eyebrow mb-3">Public domain translations</h2>
        <ul className="space-y-1 text-parchment-300">
          {free.map((v) => (
            <li key={v.code}>{v.name} ({v.abbr})</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="eyebrow mb-3">Original languages</h2>
        <ul className="space-y-2 text-parchment-300">
          <li>{ORIGINALS.he.name} — public domain.</li>
          <li>{ORIGINALS.el.name} — © 2010 Society of Biblical Literature and Logos Bible Software, licensed CC BY 4.0.</li>
          <li>Word definitions from Strong&apos;s Hebrew and Greek dictionaries — public domain.</li>
        </ul>
      </section>
    </main>
  );
}
