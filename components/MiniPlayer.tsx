"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fmtTime, usePlayer } from "@/components/PlayerProvider";

/** The slim bar at the bottom while narration plays and you're elsewhere on the site. */
export default function MiniPlayer() {
  const p = usePlayer();
  const pathname = usePathname();
  if (!p.track) return null;
  const onItsPage = pathname === p.track.href || pathname.endsWith(p.track.href);
  if (onItsPage) return null;
  const pct = p.duration ? (100 * p.time) / p.duration : 0;

  return (
    <>
      <div className="h-16" aria-hidden />
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700 bg-ink-950/95 backdrop-blur-md" role="region" aria-label="Now playing">
      <div className="h-0.5 w-full bg-ink-700">
        <div className="h-full bg-gold-500 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-5">
        <button type="button" onClick={p.toggle} className="btn btn-primary !h-9 !w-9 !p-0" aria-label={p.playing ? "Pause" : "Play"}>
          {p.playing ? (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <Link href={p.track.href} className="block truncate text-sm text-parchment-50 hover:text-gold-300">{p.track.title}</Link>
          <p className="text-xs tabular-nums text-parchment-500">{fmtTime(p.time)} / {fmtTime(p.duration)}</p>
        </div>
        <button type="button" onClick={() => p.seek(Math.max(0, p.time - 15))} className="hidden text-xs text-parchment-500 hover:text-parchment-100 sm:block" aria-label="Back 15 seconds">−15s</button>
        <button type="button" onClick={() => p.seek(Math.min(p.duration, p.time + 30))} className="hidden text-xs text-parchment-500 hover:text-parchment-100 sm:block" aria-label="Forward 30 seconds">+30s</button>
        <button type="button" onClick={p.stop} className="text-parchment-500 hover:text-parchment-100" aria-label="Stop">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
        </button>
      </div>
    </div>
    </>
  );
}
