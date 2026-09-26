"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/categories";
import { diffStats, diffWords } from "@/lib/diff";
import { extractYouTubeId } from "@/lib/youtube";
import { displayNameFor } from "@/lib/user";
import { TESTIMONY_COLUMNS } from "@/lib/queries";
import type { FormatSuggestion, Testimony } from "@/lib/types";

const COLUMNS = TESTIMONY_COLUMNS;

type SeriesOption = { series_id: string; title: string; nextPart: number };

interface Props {
  /** When editing, the existing row (must belong to the signed-in user). */
  existing?: Testimony;
  /** When adding a part to a series, prefill from that series. */
  continueSeries?: { series_id: string; title: string; nextPart: number; category: string; creator: string; is_anonymous: boolean; author_bio: string | null };
}

export default function TestimonyEditor({ existing, continueSeries }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  // ---- form state ----
  const [title, setTitle] = useState(existing?.title ?? "");
  const [experiencedOn, setExperiencedOn] = useState(existing?.experienced_on ?? "");
  const [creator, setCreator] = useState(existing?.creator ?? continueSeries?.creator ?? "");
  const [isAnonymous, setIsAnonymous] = useState(existing?.is_anonymous ?? continueSeries?.is_anonymous ?? false);
  const [authorBio, setAuthorBio] = useState(existing?.author_bio ?? continueSeries?.author_bio ?? "");
  const [category, setCategory] = useState(existing?.category ?? continueSeries?.category ?? CATEGORIES[0].name);
  const [videoUrl, setVideoUrl] = useState(existing?.video_url ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [seriesId, setSeriesId] = useState<string>(existing?.series_id ?? continueSeries?.series_id ?? "");
  const [partNumber, setPartNumber] = useState<number>(existing?.part_number ?? continueSeries?.nextPart ?? 1);
  const [seriesOptions, setSeriesOptions] = useState<SeriesOption[]>([]);

  // ---- assistant state ----
  const [suggestion, setSuggestion] = useState<FormatSuggestion | null>(null);
  const [originalBeforePolish, setOriginalBeforePolish] = useState<string | null>(null);
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [view, setView] = useState<"diff" | "preview">("diff");

  // ---- save state ----
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(existing?.id ?? null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user && !existing && !continueSeries && !creator) setCreator(displayNameFor(data.user));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the member's existing series so they can attach a new part.
  useEffect(() => {
    if (!user) return;
    supabase
      .from("testimonies")
      .select("series_id, title, part_number")
      .eq("author_id", user.id)
      .order("part_number", { ascending: true })
      .then(({ data }) => {
        const bySeries = new Map<string, SeriesOption>();
        for (const row of data ?? []) {
          const cur = bySeries.get(row.series_id);
          if (!cur) bySeries.set(row.series_id, { series_id: row.series_id, title: row.title, nextPart: row.part_number + 1 });
          else cur.nextPart = Math.max(cur.nextPart, row.part_number + 1);
        }
        if (existing) bySeries.delete(existing.series_id);
        setSeriesOptions([...bySeries.values()]);
      });
  }, [user, existing]);

  const videoOk = !videoUrl.trim() || !!extractYouTubeId(videoUrl);
  const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);
  const canSave = title.trim().length >= 3 && content.trim().length >= 40 && videoOk && (isAnonymous || creator.trim().length >= 2);

  const diff = useMemo(() => (suggestion && originalBeforePolish !== null ? diffWords(originalBeforePolish, suggestion.formatted) : null), [suggestion, originalBeforePolish]);
  const stats = useMemo(() => (diff ? diffStats(diff) : null), [diff]);

  // ---------- assistant ----------
  const polish = async () => {
    setPolishing(true);
    setPolishError(null);
    setSuggestion(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/format", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ content }),
      });
      const json = (await res.json()) as FormatSuggestion & { error?: string };
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setOriginalBeforePolish(content);
      setSuggestion(json);
      setView("diff");
    } catch (err) {
      setPolishError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPolishing(false);
    }
  };

  const acceptSuggestion = () => {
    if (!suggestion) return;
    setContent(suggestion.formatted);
    setSuggestion(null);
  };
  const rejectSuggestion = () => setSuggestion(null);

  // ---------- save ----------
  const save = async (status: "draft" | "published") => {
    if (!user) return;
    setSaving(status === "draft" ? "draft" : "publish");
    setSaveError(null);

    const description = makeDescription(content);
    const row = {
      title: title.trim(),
      description,
      video_url: videoUrl.trim() || null,
      creator: isAnonymous ? "Anonymous" : creator.trim(),
      category,
      content: content.trim(),
      author_id: user.id,
      is_anonymous: isAnonymous,
      author_bio: isAnonymous ? null : authorBio.trim() || null,
      experienced_on: experiencedOn || null,
      part_number: partNumber,
      status,
      ...(seriesId ? { series_id: seriesId } : {}),
    };

    let id = savedId;
    let error;
    if (id) {
      ({ error } = await supabase.from("testimonies").update(row).eq("id", id));
    } else {
      const res = await supabase.from("testimonies").insert(row).select(COLUMNS).single();
      error = res.error;
      id = (res.data as Testimony | null)?.id ?? null;
    }

    if (error || !id) {
      console.error("save testimony:", error?.message);
      setSaveError("Couldn't save. Check your connection and try again.");
      setSaving(null);
      return;
    }
    setSavedId(id);
    setSaving(null);
    router.push(status === "published" ? `/testimony/${id}` : `/me?saved=${id}`);
    router.refresh();
  };

  // ---------- render ----------
  if (user === undefined) return null;

  if (!user) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-2xl text-parchment-50">Sign in to write</p>
        <p className="mt-2 text-parchment-500">Your testimony is saved to your account so you can come back to it.</p>
        <Link href={`/auth?next=${encodeURIComponent(existing ? `/testimony/${existing.id}/edit` : "/submit")}`} className="btn btn-primary mt-6">
          Sign in or create an account
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ---- Details ---- */}
      <section className="card space-y-6 p-6 sm:p-8">
        <p className="eyebrow">Details</p>

        <Field label="Title" htmlFor="title">
          <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="A short, plain title" />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Kind of encounter" htmlFor="category">
            <select id="category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="When did it happen?" htmlFor="experienced" hint="Optional. Approximate is fine.">
            <input id="experienced" type="date" className="input" value={experiencedOn} onChange={(e) => setExperiencedOn(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
          </Field>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Your name as it should appear" htmlFor="creator" hint={isAnonymous ? "Hidden — this will be published as Anonymous." : "First name, full name, or a pen name."}>
            <input id="creator" className="input" value={creator} onChange={(e) => setCreator(e.target.value)} maxLength={80} disabled={isAnonymous} />
          </Field>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-ink-600 px-4 py-3 text-sm text-parchment-300">
              <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="h-4 w-4 accent-gold-500" />
              Publish anonymously
            </label>
          </div>
        </div>

        {!isAnonymous && (
          <Field label="About you" htmlFor="bio" hint="Optional. A sentence or a link — where people can learn more.">
            <input id="bio" className="input" value={authorBio} onChange={(e) => setAuthorBio(e.target.value)} maxLength={200} placeholder="e.g. Nurse in Ohio. More at example.com" />
          </Field>
        )}

        <Field label="YouTube link" htmlFor="video" hint="Optional. If you told this story on video, we'll embed it above the text." error={!videoOk ? "That doesn't look like a YouTube link." : undefined}>
          <input id="video" className="input" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" inputMode="url" />
        </Field>
      </section>

      {/* ---- Series ---- */}
      <section className="card space-y-4 p-6 sm:p-8">
        <div>
          <p className="eyebrow">Series</p>
          <p className="mt-2 text-sm text-parchment-500">Long testimony? Publish it in parts. Readers see them as one series: Part 1 → Part 2 → …</p>
        </div>
        {continueSeries ? (
          <p className="text-parchment-300">
            This will be <span className="text-gold-300">Part {partNumber}</span> of <span className="text-parchment-50">{continueSeries.title}</span>.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
            <Field label="Belongs to" htmlFor="series">
              <select
                id="series"
                className="input"
                value={seriesId && seriesId !== existing?.series_id ? seriesId : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) {
                    setSeriesId(existing?.series_id ?? "");
                    setPartNumber(existing?.part_number ?? 1);
                  } else {
                    const opt = seriesOptions.find((o) => o.series_id === v);
                    setSeriesId(v);
                    setPartNumber(opt?.nextPart ?? 2);
                  }
                }}
              >
                <option value="">{existing && existing.part_number > 1 ? "Its current series" : "A new, standalone testimony"}</option>
                {seriesOptions.map((o) => (
                  <option key={o.series_id} value={o.series_id}>
                    {o.title} (next: Part {o.nextPart})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Part" htmlFor="part">
              <input id="part" type="number" min={1} className="input w-24" value={partNumber} onChange={(e) => setPartNumber(Math.max(1, Number(e.target.value) || 1))} />
            </Field>
          </div>
        )}
      </section>

      {/* ---- Content ---- */}
      <section className="card space-y-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Your testimony</p>
            <p className="mt-2 text-sm text-parchment-500">Write it the way you&apos;d tell it. Don&apos;t worry about polish — that&apos;s what the next step is for.</p>
          </div>
          <span className="text-xs text-parchment-700">{wordCount} words</span>
        </div>

        {suggestion ? (
          <AssistantReview
            suggestion={suggestion}
            diff={diff!}
            stats={stats!}
            view={view}
            setView={setView}
            onAccept={acceptSuggestion}
            onReject={rejectSuggestion}
          />
        ) : (
          <textarea
            className="input resize-y font-body leading-relaxed"
            rows={18}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start wherever feels right…"
            maxLength={60000}
          />
        )}

        {!suggestion && (
          <div className="flex flex-wrap items-center gap-3 border-t border-ink-700 pt-4">
            <button type="button" onClick={polish} disabled={polishing || content.trim().length < 40} className="btn btn-ghost">
              <Sparkle />
              {polishing ? "Reading your testimony…" : "Polish with the assistant"}
            </button>
            <p className="text-xs text-parchment-700">
              Fixes grammar, punctuation, and paragraph breaks. Never changes what you said. You approve every change.
            </p>
          </div>
        )}
        {polishError && <p className="text-sm text-ember-500">{polishError}</p>}
      </section>

      {/* ---- Actions ---- */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-parchment-700">
          {existing?.status === "published" ? "This testimony is live. Saving as draft will hide it." : "Drafts are private until you publish."}
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => save("draft")} disabled={!canSave || saving !== null || !!suggestion} className="btn btn-ghost">
            {saving === "draft" ? "Saving…" : "Save draft"}
          </button>
          <button type="button" onClick={() => save("published")} disabled={!canSave || saving !== null || !!suggestion} className="btn btn-primary">
            {saving === "publish" ? "Publishing…" : existing?.status === "published" ? "Update" : "Publish"}
          </button>
        </div>
      </section>
      {suggestion && <p className="text-right text-xs text-gold-400">Accept or keep your original above before saving.</p>}
      {saveError && <p className="text-right text-sm text-ember-500">{saveError}</p>}
    </div>
  );
}

/* ---------- Assistant review panel ---------- */

function AssistantReview({
  suggestion,
  diff,
  stats,
  view,
  setView,
  onAccept,
  onReject,
}: {
  suggestion: FormatSuggestion;
  diff: ReturnType<typeof diffWords>;
  stats: { inserted: number; deleted: number };
  view: "diff" | "preview";
  setView: (v: "diff" | "preview") => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="space-y-5 rounded-xl border border-gold-500/40 bg-gold-500/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-gold-300">
          <Sparkle />
          <span className="font-medium">{suggestion.changed ? "Suggested edits" : "Nothing to change"}</span>
          {suggestion.changed && (
            <span className="text-xs text-parchment-500">
              · <span className="text-emerald-300">+{stats.inserted}</span> / <span className="text-ember-500">−{stats.deleted}</span> words
            </span>
          )}
        </div>
        {suggestion.changed && (
          <div className="flex gap-1 rounded-full border border-ink-600 p-0.5 text-xs">
            <button type="button" onClick={() => setView("diff")} className={`rounded-full px-3 py-1 ${view === "diff" ? "bg-ink-600 text-parchment-50" : "text-parchment-500"}`}>
              What changed
            </button>
            <button type="button" onClick={() => setView("preview")} className={`rounded-full px-3 py-1 ${view === "preview" ? "bg-ink-600 text-parchment-50" : "text-parchment-500"}`}>
              Clean preview
            </button>
          </div>
        )}
      </div>

      {suggestion.changed ? (
        <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-ink-600 bg-ink-900 p-4 leading-relaxed whitespace-pre-wrap text-parchment-100">
          {view === "diff"
            ? diff.map((op, i) =>
                op.type === "equal" ? (
                  <span key={i}>{op.text}</span>
                ) : op.type === "insert" ? (
                  <ins key={i} className="rounded bg-emerald-500/20 px-0.5 text-emerald-200 no-underline">
                    {op.text}
                  </ins>
                ) : (
                  <del key={i} className="rounded bg-ember-500/20 px-0.5 text-ember-500/90">
                    {op.text}
                  </del>
                )
              )
            : suggestion.formatted}
        </div>
      ) : (
        <p className="text-sm text-parchment-300">Your testimony reads cleanly as written. No edits suggested.</p>
      )}

      {suggestion.notes.length > 0 && (
        <div className="rounded-lg border border-ink-600 bg-ink-900/60 p-4">
          <p className="eyebrow mb-2">Notes for you</p>
          <ul className="space-y-2 text-sm text-parchment-300">
            {suggestion.notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-gold-500" aria-hidden>
                  ◆
                </span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-parchment-700">These are observations only — nothing in your text was changed because of them.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {suggestion.changed && (
          <button type="button" onClick={onAccept} className="btn btn-primary !py-2">
            Use the polished version
          </button>
        )}
        <button type="button" onClick={onReject} className="btn btn-ghost !py-2">
          {suggestion.changed ? "Keep my original" : "Back to editing"}
        </button>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function makeDescription(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= 180) return flat;
  const cut = flat.slice(0, 180);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 100 ? lastSpace : 180)}…`;
}

function Sparkle() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M12 2l1.8 5.6L19.5 9l-5.7 1.4L12 16l-1.8-5.6L4.5 9l5.7-1.4L12 2zm7 11l.9 2.6 2.6.9-2.6.9L19 20l-.9-2.6-2.6-.9 2.6-.9L19 13zM5 14l.7 2 2 .7-2 .7L5 19.5l-.7-2-2-.7 2-.7L5 14z" />
    </svg>
  );
}

function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-parchment-100">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-ember-500">{error}</p> : hint ? <p className="mt-1.5 text-xs text-parchment-700">{hint}</p> : null}
    </div>
  );
}
