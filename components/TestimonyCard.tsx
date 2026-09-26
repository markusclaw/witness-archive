import Link from "next/link";
import type { Testimony } from "@/lib/types";
import { youtubeThumbnail } from "@/lib/youtube";
import { catalogNumber, formatDate } from "@/lib/format";
import { testimonyPath } from "@/lib/seo";

export default function TestimonyCard({ testimony, priority = false }: { testimony: Testimony; priority?: boolean }) {
  const thumb = youtubeThumbnail(testimony.video_url);
  return (
    <Link href={testimonyPath(testimony)} className="card group flex flex-col overflow-hidden">
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
          <div className="flex h-full w-full items-center justify-center text-parchment-700">
            <span className="font-display text-4xl">“</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-transparent" />
        <span className="absolute left-3 top-3 chip">{testimony.category}</span>
        {thumb && (
          <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink-950/70 text-gold-300 ring-1 ring-gold-500/40 backdrop-blur">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="mb-2 text-[0.65rem] tracking-[0.2em] text-parchment-700">{catalogNumber(testimony.id)}</p>
        <h3 className="font-display text-xl leading-snug text-parchment-50 group-hover:text-gold-300">
          {testimony.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-parchment-500">{testimony.description}</p>
        <div className="mt-auto flex items-center justify-between pt-5 text-xs text-parchment-700">
          <span className="truncate">
            {testimony.is_anonymous ? "Anonymous" : testimony.creator}
            {testimony.part_number > 1 && <span className="ml-2 text-gold-500">· Part {testimony.part_number}</span>}
          </span>
          <time dateTime={testimony.created_at}>{formatDate(testimony.created_at)}</time>
        </div>
      </div>
    </Link>
  );
}
