"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import CrisisNote from "@/components/CrisisNote";
import type { PrayerRequest } from "@/lib/types";
import { PRAYER_CATEGORIES } from "@/lib/prayer";

/** Shown only to the request's author: mark answered, close, delete, or turn an answer into a testimony. */
export default function PrayerOwnerPanel({ r }: { r: PrayerRequest }) {
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(r.title);
  const [category, setCategory] = useState<string>(r.category);
  const [answer, setAnswer] = useState(r.answer ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<"held" | "crisis" | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsOwner(data.user?.id === r.user_id));
  }, [r.user_id]);

  if (!isOwner) return null;

  const call = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/prayer", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string; held?: boolean; crisis?: boolean };
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      return json;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const saveAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    const json = await call({ action: "answer", requestId: r.id, answer });
    if (!json) return;
    track("prayer_answered", { request_id: r.id });
    setNotice(json.crisis ? "crisis" : json.held ? "held" : null);
    setAnswering(false);
    router.refresh();
  };

  const saveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await call({ action: "title", requestId: r.id, title, category })) {
      setRenaming(false);
      router.refresh();
    }
  };

  const setStatus = async (status: "open" | "closed") => {
    if (await call({ action: "status", requestId: r.id, status })) router.refresh();
  };

  const remove = async () => {
    if (!window.confirm("Delete this request and everything under it? This can't be undone.")) return;
    const { error } = await supabase.from("prayer_requests").delete().eq("id", r.id);
    if (error) setError("Couldn't delete it.");
    else router.push("/pray");
  };

  const shareAsTestimony = () => {
    try {
      const content = `${r.body.trim()}\n\n${(r.answer ?? "").trim()}`.trim();
      window.localStorage.setItem("wa:draft:new", JSON.stringify({ title: r.title, content, description: "", category: "Healing", creator: "", isAnonymous: r.anonymous, authorBio: "", experiencedOn: "", videoUrl: "", savedAt: Date.now() }));
    } catch {
      /* storage unavailable */
    }
    router.push("/submit");
  };

  return (
    <div className="mb-8 rounded-lg border border-gold-500/30 bg-gold-500/5 px-4 py-3 text-sm">
      {r.review === "held" && (
        <p className="mb-2 text-gold-300">This request is awaiting a quick read by the team before it appears on the wall. Only you can see it for now.</p>
      )}
      {notice === "crisis" && <div className="mb-3"><CrisisNote /></div>}
      {notice === "held" && <p className="mb-2 text-gold-300">Thank you — your update will show once someone on the team has read it.</p>}

      {renaming ? (
        <form onSubmit={saveTitle} className="flex flex-wrap items-center gap-2">
          <input className="input !w-auto flex-1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="Title" autoFocus />
          <select className="input !w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Kind of request">
            {PRAYER_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <button type="submit" disabled={busy || title.trim().length < 3} className="btn btn-primary !py-1.5 text-xs">Save</button>
          <button type="button" onClick={() => { setRenaming(false); setTitle(r.title); }} className="btn btn-ghost !py-1.5 text-xs">Cancel</button>
          {error && <p className="w-full text-ember-500">{error}</p>}
        </form>
      ) : answering ? (
        <form onSubmit={saveAnswer} className="space-y-3">
          <label className="block text-xs uppercase tracking-[0.18em] text-parchment-500" htmlFor="pr-answer">What happened?</label>
          <textarea id="pr-answer" className="input min-h-[7rem]" value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={3000} placeholder="Tell the people who prayed how it went." />
          {error && <p className="text-ember-500">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || answer.trim().length < 5} className="btn btn-primary !py-1.5 text-xs">{busy ? "Saving…" : "Mark as answered"}</button>
            <button type="button" onClick={() => setAnswering(false)} className="btn btn-ghost !py-1.5 text-xs">Cancel</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-parchment-300">This is your request.</span>
          <span className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setRenaming(true)} className="text-gold-400 hover:text-gold-300">Edit title or kind</button>
            {r.status !== "answered" && <button type="button" onClick={() => setAnswering(true)} className="text-gold-400 hover:text-gold-300">Mark answered</button>}
            {r.status === "answered" && (
              <>
                <button type="button" onClick={() => setAnswering(true)} className="text-gold-400 hover:text-gold-300">Edit the answer</button>
                <button type="button" onClick={shareAsTestimony} className="text-gold-400 hover:text-gold-300">Share it as a testimony</button>
              </>
            )}
            {r.status === "open" && <button type="button" onClick={() => setStatus("closed")} disabled={busy} className="text-parchment-500 hover:text-parchment-100">Close</button>}
            {r.status === "closed" && <button type="button" onClick={() => setStatus("open")} disabled={busy} className="text-parchment-500 hover:text-parchment-100">Reopen</button>}
            <button type="button" onClick={remove} className="text-parchment-500 hover:text-ember-500">Delete</button>
          </span>
          {error && <p className="w-full text-ember-500">{error}</p>}
        </div>
      )}
    </div>
  );
}
