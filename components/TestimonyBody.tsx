"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { languageByCode } from "@/lib/languages";
import { pickVoice, selectVoices, voiceLabel } from "@/lib/voices";
import { splitSentences, isHeadingLine } from "@/lib/speech";
import { track } from "@/lib/analytics";
import AudioPlayer from "@/components/AudioPlayer";
import { ScriptureText } from "@/components/ScriptureRef";
import ScriptureStrip from "@/components/ScriptureStrip";
import type { PlayerTrack } from "@/components/PlayerProvider";

/**
 * Read-or-listen body. "Listen" uses the browser's speech synthesis, reads
 * paragraph by paragraph, and highlights the one being spoken. No audio is
 * stored or sent anywhere.
 */
export default function TestimonyBody({ paragraphs, title, lang = "en", audio = null }: { paragraphs: string[]; title: string; lang?: string; audio?: PlayerTrack | null }) {
  const narrated = !!audio;
  const language = languageByCode(lang) ?? languageByCode("en")!;
  const ui = language.ui;
  const speechPrefix = language.speech;
  const [supported, setSupported] = useState(false);
  const [mode, setMode] = useState<"read" | "listen">("read");
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState<number>(-1);
  const [rate, setRate] = useState(0.95);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const rateRef = useRef(rate);
  const voiceRef = useRef(voiceURI);
  const stoppedRef = useRef(false);
  const runRef = useRef(0);
  const paraRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const speakFromRef = useRef<(index: number) => void>(() => {});

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (narrated) queueMicrotask(() => setSupported(true));
    if (!("speechSynthesis" in window)) return;
    queueMicrotask(() => setSupported(true));
    const loadVoices = () => {
      const all = window.speechSynthesis.getVoices();
      setVoices(selectVoices(all, speechPrefix, 5));
      const best = pickVoice(all, speechPrefix);
      if (best && voiceRef.current !== best.voiceURI) {
        setVoiceURI(best.voiceURI);
        voiceRef.current = best.voiceURI;
      }
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, [speechPrefix, narrated]);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);
  useEffect(() => {
    voiceRef.current = voiceURI;
  }, [voiceURI]);

  const speakFrom = useCallback(
    (index: number) => {
      const synth = window.speechSynthesis;
      synth.cancel();
      stoppedRef.current = false;
      if (index >= paragraphs.length) {
        setPlaying(false);
        setCurrent(-1);
        track("listen_complete", { language: lang, paragraphs: paragraphs.length });
        return;
      }
      if (index === 0) track("listen_start", { language: lang, paragraphs: paragraphs.length });
      const v = synth.getVoices().find((x) => x.voiceURI === voiceRef.current);
      const heading = isHeadingLine(paragraphs[index]);
      // One utterance per sentence: natural breaths between sentences, and no
      // single utterance long enough to trip Chrome's ~15s cutoff on network voices.
      const sentences = splitSentences(paragraphs[index]);
      const token = ++runRef.current;
      const speakSentence = (si: number) => {
        if (stoppedRef.current || runRef.current !== token) return;
        if (si >= sentences.length) {
          // Breath between paragraphs; a little longer after a heading.
          window.setTimeout(() => {
            if (!stoppedRef.current && runRef.current === token) speakFromRef.current(index + 1);
          }, heading ? 650 : 420);
          return;
        }
        const u = new SpeechSynthesisUtterance(sentences[si]);
        u.lang = speechPrefix;
        u.rate = rateRef.current;
        if (v) u.voice = v;
        if (si === 0) {
          u.onstart = () => {
            setCurrent(index);
            paraRefs.current[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
          };
        }
        u.onend = () => {
          if (stoppedRef.current || runRef.current !== token) return;
          window.setTimeout(() => speakSentence(si + 1), 160);
        };
        u.onerror = (e) => {
          if (e.error === "interrupted" || e.error === "canceled") return;
          if (!stoppedRef.current) setPlaying(false);
        };
        synth.speak(u);
      };
      speakSentence(0);
      setPlaying(true);
    },
    [paragraphs, speechPrefix, lang]
  );
  useEffect(() => {
    speakFromRef.current = speakFrom;
  }, [speakFrom]);

  const stop = () => {
    stoppedRef.current = true;
    window.speechSynthesis.cancel();
    setPlaying(false);
  };

  const toggle = () => {
    if (playing) {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        setPlaying(false);
      }
      return;
    }
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setPlaying(true);
      return;
    }
    speakFrom(current >= 0 ? current : 0);
  };

  const changeRate = (r: number) => {
    setRate(r);
    rateRef.current = r;
    if (playing && current >= 0) speakFrom(current);
  };

  const leaveListen = () => {
    stop();
    setCurrent(-1);
    setMode("read");
  };

  return (
    <section aria-label="Written account">
      {supported && (
        <div className={`mb-8 flex flex-wrap items-center gap-3 ${mode === "listen" ? "listen-bar" : ""}`}>
          <div className="flex gap-1 rounded-full border border-ink-600 p-0.5 text-sm">
            <button type="button" onClick={leaveListen} className={`rounded-full px-4 py-1.5 ${mode === "read" ? "bg-ink-600 text-parchment-50" : "text-parchment-500 hover:text-parchment-100"}`}>
              {ui.read}
            </button>
            <button type="button" onClick={() => setMode("listen")} className={`rounded-full px-4 py-1.5 ${mode === "listen" ? "bg-ink-600 text-parchment-50" : "text-parchment-500 hover:text-parchment-100"}`}>
              {ui.listen}
            </button>
          </div>

          {mode === "listen" && narrated && audio && (
            <div className="w-full sm:w-auto sm:flex-1">
              <AudioPlayer track={audio} labels={{ play: ui.play, pause: ui.pause, speed: ui.speed }} />
            </div>
          )}
          {mode === "listen" && !narrated && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={toggle} className="btn btn-primary !px-4 !py-1.5 text-sm" aria-label={playing ? "Pause" : "Play"}>
                {playing ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
                )}
                {playing ? ui.pause : current >= 0 ? ui.resume : ui.play}
              </button>
              {(playing || current >= 0) && (
                <button type="button" onClick={() => { stop(); setCurrent(-1); }} className="btn btn-ghost !px-3 !py-1.5 text-sm">
                  {ui.stop}
                </button>
              )}
              <label className="flex items-center gap-2 text-xs text-parchment-500">
                {ui.speed}
                <select value={rate} onChange={(e) => changeRate(Number(e.target.value))} className="input !w-auto !py-1 !text-xs">
                  {[0.8, 0.9, 0.95, 1, 1.1, 1.25, 1.5].map((r) => (
                    <option key={r} value={r}>{r}×</option>
                  ))}
                </select>
              </label>
              {voices.length > 1 && (
                <label className="flex items-center gap-2 text-xs text-parchment-500">
                  {ui.voice}
                  <select
                    value={voiceURI}
                    onChange={(e) => {
                      setVoiceURI(e.target.value);
                      voiceRef.current = e.target.value;
                      if (playing && current >= 0) speakFrom(current);
                    }}
                    className="input !w-auto !max-w-[11rem] !py-1 !text-xs"
                  >
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>{voiceLabel(v)}</option>
                    ))}
                  </select>
                </label>
              )}
              <span className="sr-only" aria-live="polite">{playing ? `Reading ${title}, paragraph ${current + 1} of ${paragraphs.length}` : ""}</span>
            </div>
          )}
        </div>
      )}

      <div className="prose-testimony">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            ref={(el) => { paraRefs.current[i] = el; }}
            onClick={mode === "listen" && !narrated ? () => speakFrom(i) : undefined}
            className={
              mode === "listen" && !narrated
                ? `cursor-pointer rounded-md transition ${i === current ? "bg-gold-500/10 text-parchment-50 -mx-3 px-3 py-1" : "hover:text-parchment-50"}`
                : undefined
            }
            title={mode === "listen" && !narrated ? "Click to start reading from here" : undefined}
          >
            <ScriptureText text={p} />
          </p>
        ))}
      </div>
      <ScriptureStrip text={paragraphs.join("\n")} lang={lang} />
      {mode === "listen" && <p className="mt-6 text-xs text-parchment-700">{narrated ? ui.narratedHint : ui.audioHint}</p>}
    </section>
  );
}
