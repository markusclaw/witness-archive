import type { Metadata } from "next";
import { Suspense } from "react";
import SubmitEntry from "@/components/SubmitEntry";

export const metadata: Metadata = {
  title: "Write your testimony",
  description: "Write and publish your own first-hand testimony on the Witness Archive.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/submit" },
};

export default function SubmitPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <div className="writing-chrome mb-8">
        <p className="eyebrow mb-2">Write</p>
        <p className="max-w-2xl text-parchment-500">
          Tell it the way you&apos;d tell a friend. Paste a transcript if you have one. Nothing is published until you say so.
        </p>
      </div>
      <Suspense>
        <SubmitEntry />
      </Suspense>
    </main>
  );
}
