"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AskBox from "@/components/AskBox";
import { SUGGESTED_QUESTIONS } from "@/lib/ask";
import TestimonyCard from "@/components/TestimonyCard";
import type { AskResult } from "@/lib/types";

export default function AskPanel({ initialQuestion }: { initialQuestion: string }) {
  const [state, setState] = useState<{ status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "done"; result: AskResult }>({ status: "idle" });

  useEffect(() => {
    if (!initialQuestion) {
      queueMicrotask(() => setState({ status: "idle" }));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setState({ status: "loading" }));
    fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: initialQuestion }) })
      .then(async (r) => {
        const json = (await r.json()) as AskResult & { error?: string };
        if (!r.ok) throw new Error(json.error || "Something went wrong.");
        if (!cancelled) setState({ status: "done", result: json });
      })
      .catch((e) => {
        if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong." });
      });
    return () => {
      cancelled = true;
    };
  }, [initialQuestion]);

  return (
    <div>
      <p className="eyebrow mb-3">Ask the archive</p>
      <h1 className="font-display mb-6 text-3xl font-light text-parchment-50 sm:text-4xl">
        {initialQuestion ? initialQuestion : "What would you like to know?"}
      </h1>
      <AskBox initial={initialQuestion} autoFocus={!initialQuestion} size="md" />

      {!initialQuestion && (
        <div className="mt-8">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-parchment-700">Try asking</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((s) => (
              <Link key={s} href={`/ask?q=${encodeURIComponent(s)}`} className="chip chip-interactive normal-case tracking-normal">
                {s}
              </Link>
            ))}
          </div>
          <p className="mt-8 max-w-xl text-sm leading-relaxed text-parchment-500">
            Answers are drawn only from testimonies published here, and every sentence points to the person who said it. We describe what people report — we don&apos;t claim to know what&apos;s true.
          </p>
        </div>
      )}

      {state.status === "loading" && (
        <div className="mt-10 space-y-3" aria-busy="true" aria-live="polite">
          <p className="text-sm text-gold-300">Reading the testimonies…</p>
          {[100, 92, 96, 70].map((w, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-ink-700" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {state.status === "error" && <p className="mt-10 text-sm text-ember-500">{state.message}</p>}

      {state.status === "done" && <Result result={state.result} />}
    </div>
  );
}

function Result({ result }: { result: AskResult }) {
  const bySource = new Map(result.sources.map((s) => [s.n, s]));
  const paragraphs = result.answer.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="mt-10 space-y-10">
      {result.empty ? (
        <div className="card p-6">
          <p className="font-display text-xl text-parchment-50">
            {result.matches.length ? "No testimony speaks to that directly." : "Nothing in the archive matches that yet."}
          </p>
          <p className="mt-2 text-sm text-parchment-500">
            {result.matches.length
              ? "Here are the closest matches by keyword."
              : "Try different words, browse the collections, or — if this is your story — write it."}
          </p>
        </div>
      ) : (
        <article className="card p-6 sm:p-8">
          <p className="eyebrow mb-4">From the testimonies</p>
          <div className="space-y-4 text-[1.05rem] leading-relaxed text-parchment-100">
            {paragraphs.map((p, i) => (
              <p key={i}>{renderCitations(p, bySource)}</p>
            ))}
          </div>
          {result.sources.length > 0 && (
            <ol className="mt-8 space-y-3 border-t border-ink-700 pt-6">
              {result.sources.map((s) => (
                <li key={s.n} id={`source-${s.n}`} className="flex gap-3 text-sm">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-[0.65rem] font-semibold text-gold-300">{s.n}</span>
                  <div className="min-w-0">
                    <Link href={s.path} className="font-medium text-parchment-50 hover:text-gold-300">{s.title}</Link>
                    <span className="text-parchment-500"> — {s.author} · {s.category}</span>
                    {s.snippet && <p className="mt-1 text-xs text-parchment-500">…{s.snippet}…</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-6 text-xs text-parchment-700">
            This summarizes what these authors describe. It is not a statement about what is true, and it may miss nuance — read the testimonies themselves.
          </p>
        </article>
      )}

      {result.matches.length > 0 && (
        <section>
          <p className="eyebrow mb-4">{result.empty ? "Closest matches" : "Testimonies that mention this"}</p>
          <div className="grid gap-6 sm:grid-cols-2">
            {result.matches.slice(0, 6).map((t) => (
              <TestimonyCard key={t.id} testimony={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Turn "[2]" into a small link to the numbered source. */
function renderCitations(text: string, bySource: Map<number, { path: string; title: string }>) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (!m) return <span key={i}>{part}</span>;
    const n = Number(m[1]);
    const s = bySource.get(n);
    if (!s) return null;
    return (
      <a key={i} href={s.path} title={s.title} className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500/15 px-1 align-super text-[0.6rem] font-semibold text-gold-300 hover:bg-gold-500/30">
        {n}
      </a>
    );
  });
}
