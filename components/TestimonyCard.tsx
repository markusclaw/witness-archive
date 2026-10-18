import Link from "next/link";
import type { Testimony } from "@/lib/types";
import { youtubeThumbnail } from "@/lib/youtube";
import { catalogNumber, formatDate, timeAgo } from "@/lib/format";
import { testimonyPath } from "@/lib/seo";
import { compactNumber, formatLocation, isTruncatedExcerpt } from "@/lib/format";

/** "12:04" / "1:02:33" for a video length. */
function duration(s: number | null | undefined): string | null {
  if (!s || s < 1) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(Math.floor(s % 60)).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function byline(t: Testimony): string {
  if (t.witness_relationship === "shared") return t.witness_name || "Unnamed witness";
  return t.is_anonymous ? "Anonymous" : t.creator;
}

function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "W";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/**
 * A testimony in a list. On phones it's a feed item like a video app's —
 * the picture edge to edge, then a byline badge, the title and one meta line.
 * From tablet width up it's the bordered card in a grid.
 */
export default function TestimonyCard({ testimony, priority = false }: { testimony: Testimony; priority?: boolean }) {
  const thumb = youtubeThumbnail(testimony.video_url);
  const len = duration(testimony.video_duration_s);
  const who = byline(testimony);
  const meta = [
    testimony.view_count > 0 ? `${compactNumber(testimony.view_count)} views` : null,
    timeAgo(testimony.created_at),
  ].filter(Boolean).join(" · ");

  return (
    <Link href={testimonyPath(testimony)} className="feed-card card group flex flex-col overflow-hidden">
      <div className="relative aspect-video w-full overflow-hidden bg-ink-800">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={`${testimony.title} — video thumbnail`}
            loading={priority ? "eager" : "lazy"}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          // Written testimonies get a typographic cover instead of an empty frame.
          <div className="flex h-full w-full flex-col justify-end bg-gradient-to-br from-ink-700 via-ink-800 to-ink-950 p-5">
            <span className="font-display text-5xl leading-none text-gold-500/40" aria-hidden>“</span>
            <span className="font-display line-clamp-2 text-xl leading-snug text-parchment-100/90">{testimony.title}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
        <span className="chip absolute left-3 top-3">{testimony.category}</span>
        {thumb && len ? (
          <span className="absolute bottom-2 right-2 rounded bg-ink-950/85 px-1.5 py-0.5 text-[0.7rem] font-medium tabular-nums text-parchment-50">{len}</span>
        ) : thumb ? (
          <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink-950/70 text-gold-300 ring-1 ring-gold-500/40 backdrop-blur">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          </span>
        ) : (
          <span className="absolute bottom-2 right-2 rounded bg-ink-950/85 px-1.5 py-0.5 text-[0.7rem] font-medium text-parchment-200">Written</span>
        )}
      </div>

      {/* Phones: byline badge · title · one meta line */}
      <div className="flex gap-3 px-4 pb-1 pt-3 sm:hidden">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-500/40 bg-ink-800 text-[0.7rem] font-semibold text-gold-300" aria-hidden>
          {initials(who)}
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 text-[0.98rem] font-medium leading-snug text-parchment-50">{testimony.title}</span>
          <span className="mt-1 block truncate text-xs text-parchment-500">
            {who}
            {testimony.part_number > 1 && <span className="text-gold-500"> · Part {testimony.part_number}</span>}
            {meta && ` · ${meta}`}
          </span>
        </span>
      </div>

      {/* Tablet and up: the card */}
      <div className="hidden flex-1 flex-col p-5 sm:flex">
        <p className="mb-2 text-[0.65rem] tracking-[0.2em] text-parchment-700">{catalogNumber(testimony.id)}</p>
        <h3 className="font-display text-xl leading-snug text-parchment-50 group-hover:text-gold-300">
          {testimony.title}
        </h3>
        {!isTruncatedExcerpt(testimony.description, testimony.content) && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-parchment-500">{testimony.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-5 text-xs text-parchment-700">
          <span className="truncate">
            {who}
            {testimony.part_number > 1 && <span className="ml-2 text-gold-500">· Part {testimony.part_number}</span>}
          </span>
          <span className="truncate pl-3 text-right">
            {testimony.heart_count > 0 && <span className="mr-2 text-parchment-700">♥ {compactNumber(testimony.heart_count)}</span>}
            {testimony.view_count > 0 && <span className="mr-2 text-parchment-700">{compactNumber(testimony.view_count)} views</span>}
            {formatLocation(testimony) ?? formatDate(testimony.created_at)}
          </span>
        </div>
      </div>
    </Link>
  );
}
