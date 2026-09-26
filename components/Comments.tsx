"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Comment, Profile } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { displayNameFor } from "@/lib/user";
import { fetchProfiles } from "@/lib/profiles";
import Avatar from "@/components/Avatar";

const MAX_LENGTH = 2000;

export default function Comments({ testimonyId }: { testimonyId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [user, setUser] = useState<User | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  const nameFor = (uid: string, fallback: string) => profiles[uid]?.display_name ?? fallback;
  const myName = user ? nameFor(user.id, displayNameFor(user)) : "";

  const post = async (content: string, parentId: string | null): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.from("comments").insert({
      testimony_id: testimonyId,
      user_id: user.id,
      author: myName,
      content,
      parent_id: parentId,
    });
    if (error) {
      console.error("post comment:", error.message);
      return false;
    }
    if (parentId) setExpanded((e) => ({ ...e, [parentId]: true }));
    await load();
    return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) {
      console.error("delete comment:", error.message);
      return;
    }
    setComments((c) => c.filter((x) => x.id !== id && x.parent_id !== id));
  };

  const { top, repliesOf } = useMemo(() => {
    const top = comments.filter((c) => !c.parent_id).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    const repliesOf = new Map<string, Comment[]>();
    for (const c of comments) if (c.parent_id) repliesOf.set(c.parent_id, [...(repliesOf.get(c.parent_id) ?? []), c]);
    return { top, repliesOf };
  }, [comments]);

  return (
    <div>
      <p className="mb-5 text-sm text-parchment-500">
        {comments.length === 0 ? "No responses yet" : `${comments.length} ${comments.length === 1 ? "response" : "responses"}`}
      </p>

      {/* Composer: quiet single line until focused */}
      {user ? (
        <Composer avatar={<Avatar name={myName} src={profiles[user.id]?.avatar_url} seed={user.id} size="sm" />} placeholder="Add a response…" onSubmit={(c) => post(c, null)} />
      ) : (
        <p className="mb-8 text-sm text-parchment-500">
          <Link href="/auth" className="text-gold-400 hover:text-gold-300">Sign in</Link> to add a response.
        </p>
      )}

      {/* List */}
      {!loaded ? (
        <p className="text-sm text-parchment-700">Loading responses…</p>
      ) : loadError ? (
        <p className="text-sm text-parchment-500">
          Responses couldn&apos;t be loaded right now.{" "}
          <button type="button" onClick={() => void load()} className="underline hover:text-gold-300">Try again</button>
        </p>
      ) : (
        <ol className="space-y-6">
          {top.map((c) => {
            const replies = repliesOf.get(c.id) ?? [];
            const open = expanded[c.id] ?? false;
            return (
              <li key={c.id}>
                <CommentRow
                  comment={c}
                  name={nameFor(c.user_id, c.author)}
                  avatar={profiles[c.user_id]?.avatar_url}
                  mine={user?.id === c.user_id}
                  onDelete={() => remove(c.id)}
                  onReply={user ? () => setReplyTo(replyTo === c.id ? null : c.id) : undefined}
                />

                {replyTo === c.id && user && (
                  <div className="mt-3 pl-10">
                    <Composer
                      avatar={<Avatar name={myName} src={profiles[user.id]?.avatar_url} seed={user.id} size="xs" />}
                      placeholder={`Reply to ${nameFor(c.user_id, c.author)}…`}
                      autoFocus
                      compact
                      onCancel={() => setReplyTo(null)}
                      onSubmit={async (content) => {
                        const ok = await post(content, c.id);
                        if (ok) setReplyTo(null);
                        return ok;
                      }}
                    />
                  </div>
                )}

                {replies.length > 0 && (
                  <div className="mt-2 pl-10">
                    <button type="button" onClick={() => setExpanded((e) => ({ ...e, [c.id]: !open }))} className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-gold-400 hover:bg-gold-500/10">
                      <span aria-hidden className={`inline-block transition ${open ? "rotate-180" : ""}`}>▾</span>
                      {replies.length} {replies.length === 1 ? "reply" : "replies"}
                    </button>
                    {open && (
                      <ol className="mt-3 space-y-4 border-l border-ink-700 pl-4">
                        {replies.map((r) => (
                          <li key={r.id}>
                            <CommentRow
                              comment={r}
                              name={nameFor(r.user_id, r.author)}
                              avatar={profiles[r.user_id]?.avatar_url}
                              mine={user?.id === r.user_id}
                              onDelete={() => remove(r.id)}
                              onReply={user ? () => setReplyTo(c.id) : undefined}
                              small
                            />
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ---------- One comment ---------- */

function CommentRow({
  comment,
  name,
  avatar,
  mine,
  onDelete,
  onReply,
  small = false,
}: {
  comment: Comment;
  name: string;
  avatar?: string | null;
  mine: boolean;
  onDelete: () => void;
  onReply?: () => void;
  small?: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex gap-3">
      <Avatar name={name} src={avatar} seed={comment.user_id} size={small ? "xs" : "sm"} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="font-medium text-parchment-50">{name}</span>
          <time dateTime={comment.created_at} title={new Date(comment.created_at).toLocaleString()} className="text-parchment-700">
            {timeAgo(comment.created_at)}
          </time>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-parchment-200">{comment.content}</p>
        <div className="mt-1.5 flex items-center gap-1 text-xs">
          {onReply && (
            <button type="button" onClick={onReply} className="rounded-full px-2 py-1 text-parchment-500 hover:bg-ink-800 hover:text-parchment-100">
              Reply
            </button>
          )}
          {mine &&
            (confirm ? (
              <span className="flex items-center gap-1">
                <button type="button" onClick={onDelete} className="rounded-full px-2 py-1 text-ember-500 hover:bg-ember-500/10">Delete</button>
                <button type="button" onClick={() => setConfirm(false)} className="rounded-full px-2 py-1 text-parchment-500 hover:bg-ink-800">Cancel</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirm(true)} className="rounded-full px-2 py-1 text-parchment-700 hover:bg-ink-800 hover:text-parchment-100">
                Delete
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Composer: single underline line that grows on focus ---------- */

function Composer({
  avatar,
  placeholder,
  onSubmit,
  onCancel,
  autoFocus = false,
  compact = false,
}: {
  avatar: React.ReactNode;
  placeholder: string;
  onSubmit: (content: string) => Promise<boolean>;
  onCancel?: () => void;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const [active, setActive] = useState(autoFocus);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (active) ref.current?.focus();
  }, [active]);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  };

  const cancel = () => {
    setValue("");
    setError(null);
    setActive(false);
    onCancel?.();
  };

  const submit = async () => {
    const content = value.trim();
    if (!content) return;
    setBusy(true);
    setError(null);
    const ok = await onSubmit(content);
    setBusy(false);
    if (ok) {
      setValue("");
      setActive(false);
      if (ref.current) ref.current.style.height = "";
    } else {
      setError("Couldn't post. Try again.");
    }
  };

  return (
    <div className={compact ? "mb-2" : "mb-8"}>
      <div className="flex items-start gap-3">
        <span className="mt-1">{avatar}</span>
        <div className="min-w-0 flex-1">
          <textarea
            ref={ref}
            rows={1}
            value={value}
            placeholder={placeholder}
            onFocus={() => setActive(true)}
            onChange={(e) => {
              setValue(e.target.value.slice(0, MAX_LENGTH));
              resize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit();
            }}
            className="quiet-input block w-full resize-none border-0 border-b border-ink-600 bg-transparent px-0 py-1.5 text-[0.95rem] leading-relaxed text-parchment-50 placeholder:text-parchment-700"
            aria-label={placeholder}
          />
          {active && (
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[0.7rem] text-parchment-700">{error ?? (value.length > 0 ? `${value.length}/${MAX_LENGTH}` : "")}</span>
              <span className="flex gap-2">
                <button type="button" onClick={cancel} className="rounded-full px-3 py-1.5 text-xs text-parchment-300 hover:bg-ink-800">
                  Cancel
                </button>
                <button type="button" onClick={() => void submit()} disabled={busy || !value.trim()} className="btn btn-primary !px-4 !py-1.5 text-xs">
                  {busy ? "Posting…" : onCancel ? "Reply" : "Respond"}
                </button>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
