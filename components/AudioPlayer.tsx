"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * Narrated-audio player: play/pause, scrubbing, speed, time. The same file
 * for every reader on every device; the browser's lock-screen controls and
 * background playback come for free with the native <audio> element.
 */
export default function AudioPlayer({ src, title, language, labels }: { src: string; title: string; language: string; labels: { play: string; pause: string; speed: string } }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => setDuration(a.duration);
    const onPlay = () => {
      setPlaying(true);
      if (!startedRef.current) {
        startedRef.current = true;
        track("listen_start", { language, source: "narration" });
      }
    };
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      if (!completedRef.current) {
        completedRef.current = true;
        track("listen_complete", { language, source: "narration" });
      }
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, [language]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };

  const pct = duration ? (100 * time) / duration : 0;

  return (
    <div className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-ink-600 bg-ink-900/70 px-4 py-3">
      <audio ref={ref} src={src} preload="metadata" title={title} />
      <button type="button" onClick={toggle} className="btn btn-primary !h-10 !w-10 !p-0" aria-label={playing ? labels.pause : labels.play}>
        {playing ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>
      <div className="flex min-w-[10rem] flex-1 items-center gap-3">
        <span className="w-10 text-right text-xs tabular-nums text-parchment-500">{fmt(time)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.5}
          value={Math.min(time, duration || 0)}
          onChange={(e) => {
            const a = ref.current;
            if (a) a.currentTime = Number(e.target.value);
          }}
          className="h-1 flex-1 cursor-pointer accent-gold-500"
          aria-label="Position"
          style={{ background: `linear-gradient(90deg, var(--color-gold-500) ${pct}%, var(--color-ink-600) ${pct}%)` }}
        />
        <span className="w-10 text-xs tabular-nums text-parchment-500">{fmt(duration)}</span>
      </div>
      <label className="flex items-center gap-2 text-xs text-parchment-500">
        {labels.speed}
        <select
          value={rate}
          onChange={(e) => {
            const r = Number(e.target.value);
            setRate(r);
            if (ref.current) ref.current.playbackRate = r;
          }}
          className="input !w-auto !py-1 !text-xs"
        >
          {[0.8, 0.9, 1, 1.1, 1.25, 1.5].map((r) => (
            <option key={r} value={r}>{r}×</option>
          ))}
        </select>
      </label>
    </div>
  );
}
