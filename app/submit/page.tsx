import type { Metadata } from "next";
import { Suspense } from "react";
import SubmitEntry from "@/components/SubmitEntry";

export const metadata: Metadata = {
  title: "Share your testimony",
  description: "Write and publish your own first-hand testimony on the Witness Archive.",
};

export default function SubmitPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <p className="eyebrow mb-3">Write</p>
      <h1 className="font-display text-4xl font-light leading-tight text-parchment-50 sm:text-5xl">Share what happened to you.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-parchment-300">
        Tell it in your own words. When you&apos;re done, an assistant can tidy the grammar and paragraph breaks — it never
        changes what you said, and you approve every edit. Publish when it feels right; you can edit any time.
      </p>
      <div className="mt-10">
        <Suspense>
          <SubmitEntry />
        </Suspense>
      </div>
    </main>
  );
}
