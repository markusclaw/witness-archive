"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Comment } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { displayNameFor } from "@/lib/user";
import { fetchProfiles } from "@/lib/profiles";
import type { Profile } from "@/lib/types";
import Avatar from "@/components/Avatar";

const MAX_LENGTH = 2000;

export default function Comments({ testimonyId }: { testimonyId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [user, setUser] = useState<User | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("testimony_id", testimonyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Comment[];
      setComments(rows);
      setLoadError(false);
      fetchProfiles(rows.map((r) => r.user_id)).then((p) => setProfiles((prev) => ({ ...prev, ...p })));
    } catch (err) {
      console.error("comments:", err instanceof Error ? err.message : err);
      setLoadError(true);
    } finally {
      setLoaded(true);
    }
  }, [testimonyId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) fetchProfiles([data.user.id]).then((p) => setProfiles((prev) => ({ ...prev, ...p })));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    void Promise.resolve().then(load);
    return () => subscription.unsubscribe();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const content = draft.trim();
    if (!content) return;
    setPosting(true);
    setError(null);
    const { error } = await supabase.from("comments").insert({
      testimony_id: testimonyId,
      user_id: user.id,
      author: profiles[user.id]?.display_name ?? displayNameFor(user),
      content,
    });
    if (error) {
      setError("Your response could not be posted. Please try again.");
      console.error("post comment:", error.message);
    } else {
      setDraft("");
      await load();
    }
    setPosting(false);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) {
      console.error("delete comment:", error.message);
      return;
    }
    setComments((c) => c.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-10">
      {user ? (
        <form onSubmit={submit} className="card p-5">
          <label htmlFor="comment" className="mb-3 flex items-center gap-3 text-sm text-parchment-500">
            <Avatar name={profiles[user.id]?.display_name ?? displayNameFor(user)} src={profiles[user.id]?.avatar_url} seed={user.id} size="sm" />
            <span>Responding as <span className="text-parchment-100">{profiles[user.id]?.display_name ?? displayNameFor(user)}</span></span>
          </label>
          <textarea
            id="comment"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
            placeholder="A question, a reflection, or your own experience…"
            rows={4}
            className="input resize-y"
          />
          <div className="mt-3 flex items-center justify-between gap-4">
            <span className="text-xs text-parchment-700">
              {draft.length}/{MAX_LENGTH}
            </span>
            <button type="submit" disabled={posting || !draft.trim()} className="btn btn-primary !py-2">
              {posting ? "Posting…" : "Post response"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-ember-500">{error}</p>}
        </form>
      ) : (
        <div className="card flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-parchment-300">Sign in to join the conversation.</p>
          <Link href="/auth" className="btn btn-ghost !py-2 text-sm">
            Sign in or create an account
          </Link>
        </div>
      )}

      {!loaded ? (
        <p className="text-sm text-parchment-700">Loading responses…</p>
      ) : loadError ? (
        <p className="text-sm text-parchment-500">
          Responses couldn&apos;t be loaded right now.{" "}
          <button type="button" onClick={() => void load()} className="underline hover:text-gold-300">
            Try again
          </button>
        </p>
      ) : comments.length === 0 ? (
        <p className="text-parchment-500">No responses yet. Be the first to acknowledge this story.</p>
      ) : (
        <ol className="space-y-6">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-4">
              <Avatar name={profiles[c.user_id]?.display_name ?? c.author} src={profiles[c.user_id]?.avatar_url} seed={c.user_id} size="md" className="mt-0.5" />
              <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-medium text-parchment-50">{profiles[c.user_id]?.display_name ?? c.author}</p>
                <div className="flex items-center gap-3 text-xs text-parchment-700">
                  <time dateTime={c.created_at} title={new Date(c.created_at).toLocaleString()}>
                    {timeAgo(c.created_at)}
                  </time>
                  {user?.id === c.user_id && (
                    <button type="button" onClick={() => remove(c.id)} className="hover:text-ember-500">
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed text-parchment-300">{c.content}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
