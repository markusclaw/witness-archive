"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { PRAYER_CATEGORIES } from "@/lib/prayer";
import { LANGUAGES } from "@/lib/languages";
import { track } from "@/lib/analytics";
import CrisisNote from "@/components/CrisisNote";

/** Post a prayer request. Collapsed to one line until the member starts writing. */
export default function PrayerComposer() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("other");
  const [anonymous, setAnonymous] = useState(false);
  const [language, setLanguage] = useState("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ held: boolean; crisis: boolean; id: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/prayer", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ action: "request", title, body, category, anonymous, language }),
      });
      const json = (await res.json()) as { error?: string; held?: boolean; crisis?: boolean; request?: { id: string } };
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      track("prayer_request", { category, anonymous });
      setResult({ held: !!json.held, crisis: !!json.crisis, id: json.request?.id ?? "" });
      setTitle("");
      setBody("");
      if (!json.held) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="card p-6">
        {result.crisis ? (
          <CrisisNote />
        ) : result.held ? (
          <p className="text-parchment-100">
            Thank you. Your request has been received and will appear on the wall once someone on the team has read it — usually within a day.
          </p>
        ) : (
          <p className="text-parchment-100">
            Your request is on the wall. <Link href={`/pray/${result.id}`} className="text-gold-400 underline hover:text-gold-300">See it</Link> — you&apos;ll be able to mark it answered from there.
          </p>
        )}
        <button type="button" onClick={() => { setResult(null); setOpen(false); }} className="mt-4 text-sm text-parchment-500 underline hover:text-parchment-100">
          Post another
        </button>
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="card flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-parchment-300">Carrying something? Members can leave a request here — anonymously if you prefer.</p>
        <Link href="/auth?next=/pray" className="btn btn-primary !py-2 text-sm">Sign in to post</Link>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="card w-full p-5 text-left transition hover:border-gold-500/50">
        <span className="block font-display text-xl text-parchment-50">Ask for prayer</span>
        <span className="mt-1 block text-sm text-parchment-500">What are you carrying? Say as much or as little as you like. You can post anonymously.</span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <label htmlFor="pr-title" className="mb-1 block text-xs uppercase tracking-[0.18em] text-parchment-500">In a few words</label>
        <input id="pr-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="My mother's surgery on Tuesday" required />
      </div>
      <div>
        <label htmlFor="pr-body" className="mb-1 block text-xs uppercase tracking-[0.18em] text-parchment-500">The request</label>
        <textarea id="pr-body" className="input min-h-[8rem]" value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} placeholder="Tell us what's happening and what you're asking God for." required />
        <p className="mt-1 text-right text-xs text-parchment-700">{body.length}/3000</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-xs text-parchment-500">
          Kind of request
          <select className="input mt-1" value={category} onChange={(e) => setCategory(e.target.value)}>
            {PRAYER_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-parchment-500">
          Written in
          <select className="input mt-1" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.nativeName}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-parchment-300">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 accent-gold-500" />
          Post anonymously
        </label>
      </div>
      {error && <p className="text-sm text-ember-500">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-parchment-700">Requests appear right away. A few are read by the team first.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost !py-2 text-sm">Cancel</button>
          <button type="submit" disabled={busy || title.trim().length < 3 || body.trim().length < 10} className="btn btn-primary !py-2 text-sm">
            {busy ? "Posting…" : "Post request"}
          </button>
        </div>
      </div>
    </form>
  );
}
