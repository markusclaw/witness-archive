"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { fetchProfiles } from "@/lib/profiles";
import { timeAgo } from "@/lib/format";
import { track } from "@/lib/analytics";
import Avatar from "@/components/Avatar";
import CrisisNote from "@/components/CrisisNote";
import { ReplyText } from "@/components/PrayerText";
import type { PrayerReply, Profile } from "@/lib/types";

/** Short words left after praying. Screened like requests; held ones show only to their author. */
export default function PrayerReplies({ requestId, initial, ownerId, requestLanguage }: { requestId: string; initial: PrayerReply[]; ownerId: string; requestLanguage?: string }) {
  const [replies, setReplies] = useState<PrayerReply[]>(initial);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<"held" | "crisis" | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("prayer_replies").select("*").eq("request_id", requestId).order("created_at", { ascending: true });
    const rows = (data ?? []) as PrayerReply[];
    setReplies(rows);
    fetchProfiles(rows.map((r) => r.user_id)).then((p) => setProfiles((prev) => ({ ...prev, ...p })));
  }, [requestId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    fetchProfiles(initial.map((r) => r.user_id)).then(setProfiles);
  }, [initial]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/prayer", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ action: "reply", requestId, content: text }),
      });
      const json = (await res.json()) as { error?: string; held?: boolean; crisis?: boolean };
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      track("prayer_reply", { request_id: requestId });
      setText("");
      setNotice(json.crisis ? "crisis" : json.held ? "held" : null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("prayer_replies").delete().eq("id", id);
    if (!error) setReplies((rs) => rs.filter((r) => r.id !== id));
  };

  return (
    <section id="replies" aria-label="Words of encouragement" className="mt-12">
      <p className="eyebrow mb-2">A word</p>
      <h2 className="font-display text-2xl text-parchment-50">{replies.length === 0 ? "No words yet" : replies.length === 1 ? "One word" : `${replies.length} words`}</h2>
      <p className="mt-1 text-sm text-parchment-500">If something comes to you while you pray — a verse, a line, a blessing — leave it here. Short is fine.</p>

      <ul className="mt-6 space-y-4">
        {replies.map((r) => {
          const p = profiles[r.user_id];
          const name = p?.display_name ?? r.author;
          const mine = user?.id === r.user_id;
          return (
            <li key={r.id} className={`flex gap-3 ${r.review !== "clear" ? "opacity-60" : ""}`}>
              <Avatar name={name} src={p?.avatar_url} seed={r.user_id} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-parchment-500">
                  <span className="text-parchment-100">{name}</span>
                  {r.user_id === ownerId && <span className="ml-1 text-gold-500/80">· asked for this prayer</span>} · {timeAgo(r.created_at)}
                  {r.review === "held" && <span className="ml-1 text-gold-500/80">· awaiting review, only you can see it</span>}
                  {(mine || user?.id === ownerId) && (
                    <button type="button" onClick={() => remove(r.id)} className="ml-2 underline hover:text-ember-500">remove</button>
                  )}
                </p>
                <ReplyText id={r.id} content={r.content} requestLanguage={requestLanguage} />
              </div>
            </li>
          );
        })}
      </ul>

      {notice === "crisis" && <div className="mt-6"><CrisisNote /></div>}
      {notice === "held" && <p className="mt-6 text-sm text-parchment-500">Thank you — your word will appear once someone on the team has read it.</p>}

      {user === null ? (
        <p className="mt-8 text-sm text-parchment-500">
          <Link href={`/auth?next=/pray/${requestId}`} className="text-gold-400 underline hover:text-gold-300">Sign in</Link> to leave a word.
        </p>
      ) : (
        user && (
          <form onSubmit={post} className="mt-8 flex flex-col gap-3">
            <textarea className="input min-h-[5rem]" dir="auto" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Praying for you. …" aria-label="Your word" />
            {error && <p className="text-sm text-ember-500">{error}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={busy || !text.trim()} className="btn btn-primary !py-2 text-sm">{busy ? "Posting…" : "Leave this word"}</button>
            </div>
          </form>
        )
      )}
    </section>
  );
}
