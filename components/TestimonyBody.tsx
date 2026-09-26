"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Read-or-listen body. "Listen" uses the browser's speech synthesis, reads
 * paragraph by paragraph, and highlights the one being spoken. No audio is
 * stored or sent anywhere.
 */
export default function TestimonyBody({ paragraphs, title }: { paragraphs: string[]; title: string }) {
  const [supported, setSupported] = useState(false);
  const [mode, setMode] = useState<"read" | "listen">("read");
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState<number>(-1);
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const rateRef = useRef(rate);
  const voiceRef = useRef(voiceURI);
  const stoppedRef = useRef(false);
  const paraRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const speakFromRef = useRef<(index: number) => void>(() => {});

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    queueMicrotask(() => setSupported(true));
    const loadVoices = () => {
      const all = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
      setVoices(all);
      if (!voiceRef.current && all.length) {
        const preferred = all.find((v) => /natural|premium|enhanced|neural/i.test(v.name)) ?? all.find((v) => v.default) ?? all[0];
        setVoiceURI(preferred.voiceURI);
        voiceRef.current = preferred.voiceURI;
      }
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

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
        return;
      }
      const u = new SpeechSynthesisUtterance(paragraphs[index]);
      u.rate = rateRef.current;
      const v = synth.getVoices().find((x) => x.voiceURI === voiceRef.current);
      if (v) u.voice = v;
      u.onstart = () => {
        setCurrent(index);
        paraRefs.current[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
      };
      u.onend = () => {
        if (!stoppedRef.current) speakFromRef.current(index + 1);
      };
      u.onerror = () => {
        if (!stoppedRef.current) setPlaying(false);
      };
      synth.speak(u);
      setPlaying(true);
    },
    [paragraphs]
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

  const changeVoice = (uri: string) => {
    setVoiceURI(uri);
    voiceRef.current = uri;
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
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-full border border-ink-600 p-0.5 text-sm">
            <button type="button" onClick={leaveListen} className={`rounded-full px-4 py-1.5 ${mode === "read" ? "bg-ink-600 text-parchment-50" : "text-parchment-500 hover:text-parchment-100"}`}>
              Read
            </button>
            <button type="button" onClick={() => setMode("listen")} className={`rounded-full px-4 py-1.5 ${mode === "listen" ? "bg-ink-600 text-parchment-50" : "text-parchment-500 hover:text-parchment-100"}`}>
              Listen
            </button>
          </div>

          {mode === "listen" && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={toggle} className="btn btn-primary !px-4 !py-1.5 text-sm" aria-label={playing ? "Pause" : "Play"}>
                {playing ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
                )}
                {playing ? "Pause" : current >= 0 ? "Resume" : "Play"}
              </button>
              {(playing || current >= 0) && (
                <button type="button" onClick={() => { stop(); setCurrent(-1); }} className="btn btn-ghost !px-3 !py-1.5 text-sm">
                  Stop
                </button>
              )}
              <label className="flex items-center gap-2 text-xs text-parchment-500">
                Speed
                <select value={rate} onChange={(e) => changeRate(Number(e.target.value))} className="input !w-auto !py-1 !text-xs">
                  {[0.8, 0.9, 1, 1.1, 1.25, 1.5].map((r) => (
                    <option key={r} value={r}>{r}×</option>
                  ))}
                </select>
              </label>
              {voices.length > 1 && (
                <label className="flex items-center gap-2 text-xs text-parchment-500">
                  Voice
                  <select value={voiceURI} onChange={(e) => changeVoice(e.target.value)} className="input !w-auto max-w-[12rem] !py-1 !text-xs">
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
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
            onClick={mode === "listen" ? () => speakFrom(i) : undefined}
            className={
              mode === "listen"
                ? `cursor-pointer rounded-md transition ${i === current ? "bg-gold-500/10 text-parchment-50 -mx-3 px-3 py-1" : "hover:text-parchment-50"}`
                : undefined
            }
            title={mode === "listen" ? "Click to start reading from here" : undefined}
          >
            {p}
          </p>
        ))}
      </div>
      {mode === "listen" && <p className="mt-6 text-xs text-parchment-700">Audio is generated by your device&apos;s built-in voice. Click any paragraph to start from there.</p>}
    </section>
  );
}
