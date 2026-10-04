import type { Metadata } from "next";
import PrayerReviewQueue from "@/components/PrayerReviewQueue";

export const metadata: Metadata = { title: "Prayer wall — review", robots: { index: false, follow: false } };

export default function PrayerReviewPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="eyebrow mb-3">Prayer wall</p>
      <h1 className="font-display text-4xl font-light leading-tight text-parchment-50">Held for review</h1>
      <p className="mt-3 text-parchment-500">Posts the screener wasn&apos;t sure about. Clear them to publish, or remove them. Nobody else can see these.</p>
      <div className="mt-8">
        <PrayerReviewQueue />
      </div>
    </main>
  );
}
