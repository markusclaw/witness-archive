import type { Metadata } from "next";
import Link from "next/link";
import PrayerCard from "@/components/PrayerCard";
import PrayerComposer from "@/components/PrayerComposer";
import { PRAYER_CATEGORIES, getPrayerCounts, listPrayerRequests, type WallSort } from "@/lib/prayer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prayer wall",
  description: "Leave a prayer request, pray for others, and come back to see prayers answered. Part of the Witness Archive community.",
  alternates: { canonical: "/pray" },
};

type SearchParams = Promise<{ category?: string; show?: string; sort?: string }>;

export default async function PrayPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const category = PRAYER_CATEGORIES.some((c) => c.slug === sp.category) ? sp.category : undefined;
  const show = sp.show === "answered" ? "answered" : "open";
  const sort: WallSort = sp.sort === "most-prayed" || sp.sort === "least-prayed" ? sp.sort : "newest";
  const [requests, counts] = await Promise.all([listPrayerRequests({ category, status: show, sort }), getPrayerCounts()]);

  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const next = { category, show, sort, ...patch };
    if (next.category) q.set("category", next.category);
    if (next.show && next.show !== "open") q.set("show", next.show);
    if (next.sort && next.sort !== "newest") q.set("sort", next.sort);
    const s = q.toString();
    return s ? `/pray?${s}` : "/pray";
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <p className="eyebrow mb-3">Pray</p>
      <h1 className="font-display text-4xl font-light leading-tight text-parchment-50 sm:text-5xl">The prayer wall</h1>
      <p className="mt-4 max-w-2xl text-parchment-300">
        Leave what you&apos;re carrying. Pray for someone else and tell them you did. Come back for the answers.
      </p>
      <p className="mt-3 text-sm text-parchment-500">
        {counts.open} open · {counts.answered} answered · {counts.prayed.toLocaleString()} prayers prayed
      </p>

      <div className="mt-8">
        <PrayerComposer />
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full border border-ink-600 p-0.5 text-sm">
          <Link href={href({ show: "open" })} className={`rounded-full px-4 py-1.5 ${show === "open" ? "bg-ink-600 text-parchment-50" : "text-parchment-500 hover:text-parchment-100"}`}>Open</Link>
          <Link href={href({ show: "answered" })} className={`rounded-full px-4 py-1.5 ${show === "answered" ? "bg-ink-600 text-parchment-50" : "text-parchment-500 hover:text-parchment-100"}`}>Answered</Link>
        </div>
        <span className="mx-1 hidden h-5 w-px bg-ink-600 sm:block" aria-hidden />
        <div className="flex flex-wrap gap-1.5">
          <Link href={href({ category: undefined })} className={`chip chip-interactive ${!category ? "chip-active" : ""}`}>All</Link>
          {PRAYER_CATEGORIES.map((c) => (
            <Link key={c.slug} href={href({ category: c.slug })} className={`chip chip-interactive ${category === c.slug ? "chip-active" : ""}`}>{c.name}</Link>
          ))}
        </div>
        <span className="ml-auto text-xs text-parchment-500">
          Sort:{" "}
          {(["newest", "most-prayed", "least-prayed"] as WallSort[]).map((s, i) => (
            <span key={s}>
              {i > 0 && " · "}
              <Link href={href({ sort: s })} className={sort === s ? "text-parchment-50" : "hover:text-parchment-100"}>
                {s === "newest" ? "newest" : s === "most-prayed" ? "most prayed" : "needs prayer"}
              </Link>
            </span>
          ))}
        </span>
      </div>

      {requests.length === 0 ? (
        <p className="mt-10 text-parchment-500">{show === "answered" ? "No answered prayers here yet — they'll show as people mark them." : "Nothing here yet. Be the first to ask."}</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {requests.map((r) => (
            <PrayerCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </main>
  );
}
