"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AskBox({ initial = "", autoFocus = false, size = "lg" }: { initial?: string; autoFocus?: boolean; size?: "lg" | "md" }) {
  const [q, setQ] = useState(initial);
  const router = useRouter();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (v.length < 3) return;
    router.push(`/ask?q=${encodeURIComponent(v)}`);
  };
  return (
    <form onSubmit={submit} role="search" className="w-full">
      <label htmlFor="ask" className="sr-only">Ask the archive or search</label>
      <div className={`flex items-center gap-2 rounded-full border border-ink-500 bg-ink-900/80 pl-5 pr-1.5 shadow-glow backdrop-blur transition focus-within:border-gold-500 ${size === "lg" ? "py-1.5" : "py-1"}`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gold-500" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          id="ask"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus={autoFocus}
          maxLength={300}
          placeholder="Ask anything — “what is hell like?” — or search a name, place, or word"
          className={`quiet-input min-w-0 flex-1 bg-transparent text-parchment-50 placeholder:text-parchment-700 ${size === "lg" ? "py-2.5 text-base" : "py-2 text-sm"}`}
          enterKeyHint="search"
          autoComplete="off"
        />
        <button type="submit" className={`btn btn-primary shrink-0 ${size === "lg" ? "!px-5 !py-2.5" : "!px-4 !py-2 text-xs"}`}>
          Ask
        </button>
      </div>
    </form>
  );
}
