"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { track as trackEvent } from "@/lib/analytics";

export interface PlayerTrack {
  /** testimony id */
  id: string;
  language: string;
  title: string;
  src: string;
  /** where the mini bar links back to */
  href: string;
  artwork?: string | null;
}

interface PlayerState {
  track: PlayerTrack | null;
  playing: boolean;
  time: number;
  duration: number;
  rate: number;
  /** Position restored from a previous session, shown once as "Resumed from …". */
  resumedFrom: number | null;
  load: (t: PlayerTrack, autoplay?: boolean) => void;
  toggle: () => void;
  seek: (s: number) => void;
  setRate: (r: number) => void;
  stop: () => void;
}

const Ctx = createContext<PlayerState | null>(null);

const posKey = (id: string, lang: string) => `wa:pos:${id}:${lang}`;

function readLocal(id: string, lang: string): number {
  try {
    return Number(window.localStorage.getItem(posKey(id, lang)) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/**
 * One <audio> element for the whole site. It lives in the root layout, so
 * narration keeps playing across client-side navigation; the page's player
 * and the mini bar are both just views of this state. Position is saved to
 * the browser every few seconds and, for members, to Supabase.
 */
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  const lastSavedRef = useRef(0);
  const lastRemoteRef = useRef(0);
  const startedRef = useRef<string | null>(null);

  const save = useCallback(
    async (force = false) => {
      const a = audioRef.current;
      if (!a || !track || !a.duration) return;
      const pos = Math.floor(a.currentTime);
      const completed = a.duration - a.currentTime < 8;
      const now = Date.now();
      if (!force && now - lastSavedRef.current < 4000) return;
      lastSavedRef.current = now;
      try {
        window.localStorage.setItem(posKey(track.id, track.language), String(completed ? 0 : pos));
      } catch {
        /* storage unavailable */
      }
      if (force || now - lastRemoteRef.current > 20000) {
        lastRemoteRef.current = now;
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("listening_progress").upsert(
            { user_id: user.id, testimony_id: track.id, language: track.language, position_s: completed ? 0 : pos, duration_s: Math.round(a.duration), completed, updated_at: new Date().toISOString() },
            { onConflict: "user_id,testimony_id,language" },
          );
        }
      }
    },
    [track],
  );

  // Wire the audio element once.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      setTime(a.currentTime);
      void save();
    };
    const onMeta = () => setDuration(a.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      void save(true);
    };
    const onEnded = () => {
      setPlaying(false);
      void save(true);
      if (track) trackEvent("listen_complete", { language: track.language, source: "narration" });
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
  }, [save, track]);

  // Save on tab hide / close.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void save(true);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [save]);

  const load = useCallback(
    (t: PlayerTrack, autoplay = true) => {
      const a = audioRef.current;
      if (!a) return;
      const same = track && track.id === t.id && track.language === t.language;
      if (same) {
        if (autoplay && a.paused) void a.play();
        return;
      }
      void save(true);
      setTrack(t);
      setResumedFrom(null);
      setTime(0);
      setDuration(0);
      a.src = t.src;
      a.playbackRate = rate;
      a.load();

      const begin = (from: number) => {
        if (from > 10) {
          a.currentTime = from;
          setResumedFrom(from);
        }
        if (autoplay) void a.play().catch(() => undefined);
        if (startedRef.current !== `${t.id}:${t.language}`) {
          startedRef.current = `${t.id}:${t.language}`;
          trackEvent("listen_start", { language: t.language, source: "narration", resumed: from > 10 });
        }
      };
      // Local position first (instant); a member's remote position wins if newer.
      const local = readLocal(t.id, t.language);
      let started = false;
      const onReady = () => {
        if (started) return;
        started = true;
        begin(local);
        supabase.auth.getUser().then(async ({ data }) => {
          if (!data.user) return;
          const { data: row } = await supabase.from("listening_progress").select("position_s, completed").eq("user_id", data.user.id).eq("testimony_id", t.id).eq("language", t.language).maybeSingle();
          const remote = row && !row.completed ? row.position_s : 0;
          if (remote > local + 15 && remote > 10 && a.duration && remote < a.duration - 8) {
            a.currentTime = remote;
            setResumedFrom(remote);
          }
        });
      };
      a.addEventListener("loadedmetadata", onReady, { once: true });
      if (a.readyState >= 1) onReady();

      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: "Witness Archive", ...(t.artwork ? { artwork: [{ src: t.artwork, sizes: "480x360", type: "image/jpeg" }] } : {}) });
        navigator.mediaSession.setActionHandler("play", () => void a.play());
        navigator.mediaSession.setActionHandler("pause", () => a.pause());
        navigator.mediaSession.setActionHandler("seekbackward", () => { a.currentTime = Math.max(0, a.currentTime - 15); });
        navigator.mediaSession.setActionHandler("seekforward", () => { a.currentTime = Math.min(a.duration || 0, a.currentTime + 30); });
        navigator.mediaSession.setActionHandler("seekto", (d) => { if (d.seekTime != null) a.currentTime = d.seekTime; });
      }
    },
    [track, rate, save],
  );

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !track) return;
    if (a.paused) void a.play();
    else a.pause();
  }, [track]);

  const seek = useCallback((s: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = s;
  }, []);

  const setRate = useCallback((r: number) => {
    setRateState(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  }, []);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      void save(true);
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    setTrack(null);
    setPlaying(false);
    setTime(0);
    setDuration(0);
  }, [save]);

  const value = useMemo<PlayerState>(() => ({ track, playing, time, duration, rate, resumedFrom, load, toggle, seek, setRate, stop }), [track, playing, time, duration, rate, resumedFrom, load, toggle, seek, setRate, stop]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" />
    </Ctx.Provider>
  );
}

export function usePlayer(): PlayerState {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used inside PlayerProvider");
  return v;
}

export function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
