import Link from "next/link";
import PrayedButton from "@/components/PrayedButton";
import PrayerText from "@/components/PrayerText";
import { prayerCategory, requesterName } from "@/lib/prayer";
import { timeAgo } from "@/lib/format";
import type { PrayerRequest } from "@/lib/types";

export default function PrayerCard({ r }: { r: PrayerRequest }) {
  const cat = prayerCategory(r.category);
  return (
    <article className={`card p-5 ${r.status === "answered" ? "border-gold-500/40" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-parchment-700">
        <span className="chip">{cat.name}</span>
        {r.status === "answered" && <span className="chip chip-active">Answered</span>}
        <span>{requesterName(r)}</span>
        <span>·</span>
        <time dateTime={r.created_at}>{timeAgo(r.created_at)}</time>
      </div>
      <PrayerText id={r.id} language={r.language} text={{ title: r.title, body: r.body, answer: r.answer }} variant="card" answered={r.status === "answered"} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PrayedButton requestId={r.id} initialCount={r.prayed_count} />
        <Link href={`/pray/${r.id}#replies`} className="text-xs text-parchment-500 hover:text-gold-300">
          {r.reply_count === 0 ? "Leave a word" : r.reply_count === 1 ? "1 word" : `${r.reply_count} words`}
        </Link>
      </div>
    </article>
  );
}
