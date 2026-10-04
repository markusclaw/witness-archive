"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchMyProfile } from "@/lib/profiles";
import { timeAgo } from "@/lib/format";
import { prayerCategory } from "@/lib/prayer";
import type { PrayerReply, PrayerRequest } from "@/lib/types";

/** Admin-only queue: held requests and replies, with the screener's reason. */
export default function PrayerReviewQueue() {
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [replies, setReplies] = useState<(PrayerReply & { request_title?: string })[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: rq }, { data: rp }] = await Promise.all([
      supabase.from("prayer_requests").select("*").eq("review", "held").order("created_at", { ascending: true }),
      supabase.from("prayer_replies").select("*").eq("review", "held").order("created_at", { ascending: true }),
    ]);
    setRequests((rq ?? []) as PrayerRequest[]);
    setReplies((rp ?? []) as PrayerReply[]);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return setState("denied");
      const p = await fetchMyProfile(data.user.id);
      if (p?.role !== "admin") return setState("denied");
      await load();
      setState("ready");
    });
  }, [load]);

  const decide = async (payload: { requestId?: string; replyId?: string }, decision: "clear" | "removed") => {
    setBusy(payload.replyId ?? payload.requestId ?? null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await fetch("/api/prayer", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ action: "review", ...payload, decision }),
    });
    await load();
    setBusy(null);
  };

  if (state === "loading") return <p className="text-parchment-500">Loading…</p>;
  if (state === "denied") return <p className="text-parchment-500">This page is for the team. <Link href="/pray" className="text-gold-400 underline">Back to the wall</Link>.</p>;
  if (requests.length === 0 && replies.length === 0) return <p className="text-parchment-500">Nothing waiting. 🙏</p>;

  return (
    <div className="space-y-8">
      {requests.map((r) => (
        <article key={r.id} className="card p-5">
          <p className="text-xs text-parchment-700">
            Request · {prayerCategory(r.category).name} · {r.anonymous ? "anonymous" : r.display_name} · {timeAgo(r.created_at)}
          </p>
          <h3 className="font-display mt-2 text-xl text-parchment-50" dir="auto">{r.title}</h3>
          <p className="mt-2 whitespace-pre-wrap text-parchment-300" dir="auto">{r.body}</p>
          {r.answer && <p className="mt-2 border-l-2 border-gold-500/50 pl-3 text-sm text-parchment-100">Answer: {r.answer}</p>}
          {r.review_note && <p className="mt-3 text-xs text-gold-500/80">Screener: {r.review_note}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={busy === r.id} onClick={() => decide({ requestId: r.id }, "clear")} className="btn btn-primary !py-1.5 text-xs">Publish</button>
            <button type="button" disabled={busy === r.id} onClick={() => decide({ requestId: r.id }, "removed")} className="btn btn-ghost !py-1.5 text-xs">Remove</button>
            <Link href={`/pray/${r.id}`} className="ml-auto self-center text-xs text-parchment-500 hover:text-gold-300">Open</Link>
          </div>
        </article>
      ))}
      {replies.map((r) => (
        <article key={r.id} className="card p-5">
          <p className="text-xs text-parchment-700">Reply · {r.author} · {timeAgo(r.created_at)}</p>
          <p className="mt-2 whitespace-pre-wrap text-parchment-300" dir="auto">{r.content}</p>
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={busy === r.id} onClick={() => decide({ replyId: r.id }, "clear")} className="btn btn-primary !py-1.5 text-xs">Publish</button>
            <button type="button" disabled={busy === r.id} onClick={() => decide({ replyId: r.id }, "removed")} className="btn btn-ghost !py-1.5 text-xs">Remove</button>
            <Link href={`/pray/${r.request_id}`} className="ml-auto self-center text-xs text-parchment-500 hover:text-gold-300">Open request</Link>
          </div>
        </article>
      ))}
    </div>
  );
}
