import type { Metadata } from "next";
import Link from "next/link";
import { BibleCopyrightText } from "@/components/BibleCopyright";

export const metadata: Metadata = {
  title: "Bible texts and copyright",
  description: "Where the Bible translations in the Witness Archive come from, and the terms they're used under.",
  alternates: { canonical: "/bible/copyright" },
};

/** The credits as a page: the same quiet text the copyright popup shows. */
export default function BibleCopyrightPage() {
  return (
    <main className="mx-auto max-w-xl px-5 py-12 pb-24 sm:py-16">
      <p className="text-xs text-parchment-700">
        <Link href="/bible" className="hover:text-gold-300">The Bible</Link> / Copyright
      </p>
      <h1 className="mt-3 mb-8 text-sm text-parchment-300">Bible texts &amp; copyright</h1>
      <BibleCopyrightText />
    </main>
  );
}
