import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PrayedButton from "@/components/PrayedButton";
import PrayerReplies from "@/components/PrayerReplies";
import PrayerOwnerPanel from "@/components/PrayerOwnerPanel";
import PrayerText from "@/components/PrayerText";
import HeldPrayerView from "@/components/HeldPrayerView";
import { getPrayerReplies, getPrayerRequest, prayerCategory, requesterName } from "@/lib/prayer";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const r = await getPrayerRequest(id);
  if (!r) return { title: "Not found", robots: { index: false } };
  return { title: `${r.title} — prayer request`, description: r.body.slice(0, 160), robots: { index: false, follow: true } };
}

export default async function PrayerRequestPage({ params }: { params: Params }) {
  const { id } = await params;
  const r = await getPrayerRequest(id);
  // Not visible to the public: may be held for review — the author/admin can still open it.
  if (!r) return <HeldPrayerView id={id} />;
  if (r.review === "removed") notFound();
  const replies = await getPrayerReplies(id);
  const cat = prayerCategory(r.category);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <PrayerOwnerPanel r={r} />
      <p className="text-xs text-parchment-500">
        <Link href="/pray" className="hover:text-gold-300">Prayer wall</Link> / <Link href={`/pray?category=${cat.slug}`} className="hover:text-gold-300">{cat.name}</Link>
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-parchment-700">
        <span className="chip">{cat.name}</span>
        {r.status === "answered" && <span className="chip chip-active">Answered</span>}
        {r.status === "closed" && <span className="chip">Closed</span>}
      </div>
      <PrayerText
        id={r.id}
        language={r.language}
        text={{ title: r.title, body: r.body, answer: r.answer }}
        variant="page"
        answered={r.status === "answered"}
        metaLine={`${requesterName(r)} · ${formatDate(r.created_at)}`}
        answeredLabel={`Answered${r.answered_at ? ` · ${formatDate(r.answered_at)}` : ""}`}
      />

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <PrayedButton requestId={r.id} initialCount={r.prayed_count} size="md" />
        <span className="text-sm text-parchment-500">
          {r.prayed_count === 0 ? "Be the first to pray for this." : r.prayed_count === 1 ? "One person has prayed for this." : `${r.prayed_count} people have prayed for this.`}
        </span>
      </div>

      <PrayerReplies requestId={r.id} initial={replies} ownerId={r.user_id} requestLanguage={r.language} />
    </main>
  );
}
