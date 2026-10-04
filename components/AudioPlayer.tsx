"use client";

import { useEffect, useState } from "react";
import { fmtTime, usePlayer, type PlayerTrack } from "@/components/PlayerProvider";

/**
 * The narration controls on a testimony page: a view of the site-wide player.
 * Pressing play hands the track to the provider; leaving the page doesn't stop it.
 */
export default function AudioPlayer({ track, labels }: { track: PlayerTrack; labels: { play: string; pause: string; speed: string } }) {
  const p = usePlayer();
  const active = p.track?.id === track.id && p.track?.language === track.language;
  const [savedPos, setSavedPos] = useState(0);

  // Before play: show where this one would resume from.
  useEffect(() => {
    if (active) return;
    const read = () => {
      try {
        setSavedPos(Number(window.localStorage.getItem(`wa:pos:${track.id}:${track.language}`) ?? 0) || 0);
      } catch {
        setSavedPos(0);
      }
    };
    queueMicrotask(read);
  }, [active, track.id, track.language]);

  const time = active ? p.time : savedPos;
  const duration = active ? p.duration : 0;
  const pct = duration ? (100 * time) / duration : 0;

  return (
    <div className="w-full">
      <div className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-ink-600 bg-ink-900/70 px-4 py-3">
        <button
          type="button"
          onClick={() => (active ? p.toggle() : p.load(track, true))}
          className="btn btn-primary !h-10 !w-10 !p-0"
          aria-label={active && p.playing ? labels.pause : labels.play}
        >
          {active && p.playing ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        <div className="flex min-w-[10rem] flex-1 items-center gap-3">
          <span className="w-10 text-right text-xs tabular-nums text-parchment-500">{fmtTime(time)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.5}
            value={Math.min(time, duration || 0)}
            onChange={(e) => active && p.seek(Number(e.target.value))}
            disabled={!active}
            className="h-1 flex-1 cursor-pointer accent-gold-500 disabled:cursor-default"
            aria-label="Position"
            style={{ background: `linear-gradient(90deg, var(--color-gold-500) ${pct}%, var(--color-ink-600) ${pct}%)` }}
          />
          <span className="w-10 text-xs tabular-nums text-parchment-500">{duration ? fmtTime(duration) : "–:––"}</span>
        </div>
        <label className="flex items-center gap-2 text-xs text-parchment-500">
          {labels.speed}
          <select value={p.rate} onChange={(e) => p.setRate(Number(e.target.value))} className="input !w-auto !py-1 !text-xs">
            {[0.8, 0.9, 1, 1.1, 1.25, 1.5].map((r) => (
              <option key={r} value={r}>{r}×</option>
            ))}
          </select>
        </label>
      </div>
      {!active && savedPos > 10 && <p className="mt-2 text-xs text-parchment-500">You left off at {fmtTime(savedPos)} — play picks up from there.</p>}
      {active && p.resumedFrom != null && p.time < p.resumedFrom + 30 && (
        <p className="mt-2 text-xs text-parchment-500">
          Resumed from {fmtTime(p.resumedFrom)}.{" "}
          <button type="button" onClick={() => p.seek(0)} className="underline hover:text-gold-300">Start over</button>
        </p>
      )}
      {active && <p className="mt-2 text-xs text-parchment-700">Keeps playing while you browse the rest of the archive.</p>}
    </div>
  );
}
