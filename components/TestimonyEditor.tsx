"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/categories";
import { diffStats, diffWords } from "@/lib/diff";
import { extractYouTubeId } from "@/lib/youtube";
import { displayNameFor } from "@/lib/user";
import { TESTIMONY_COLUMNS } from "@/lib/queries";
import { cleanTranscript, looksLikeTranscript } from "@/lib/transcript";
import { testimonyPath } from "@/lib/seo";
import { fetchMyProfile } from "@/lib/profiles";
import type { FormatSuggestion, Testimony } from "@/lib/types";

type SeriesOption = { series_id: string; title: string; nextPart: number };

interface Props {
  existing?: Testimony;
  continueSeries?: { series_id: string; title: string; nextPart: number; category: string; creator: string; is_anonymous: boolean; author_bio: string | null };
}

const PROMPTS = [
  "Start with the moment everything changed.",
  "Where were you? What did the room feel like?",
  "You don't have to explain it. Just describe it.",
  "What did you know afterwards that you didn't know before?",
  "Begin anywhere. You can always move it later.",
];

interface LocalDraft {
  title: string;
  content: string;
  category: string;
  creator: string;
  isAnonymous: boolean;
  authorBio: string;
  experiencedOn: string;
  videoUrl: string;
  savedAt: number;
}

export default function TestimonyEditor({ existing, continueSeries }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const localKey = `wa:draft:${existing?.id ?? (continueSeries ? `series:${continueSeries.series_id}` : "new")}`;

  // ---- content ----
  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [prompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);

  // ---- details ----
  const [experiencedOn, setExperiencedOn] = useState(existing?.experienced_on ?? "");
  const [creator, setCreator] = useState(existing?.creator ?? continueSeries?.creator ?? "");
  const [isAnonymous, setIsAnonymous] = useState(existing?.is_anonymous ?? continueSeries?.is_anonymous ?? false);
  const [authorBio, setAuthorBio] = useState(existing?.author_bio ?? continueSeries?.author_bio ?? "");
  const [category, setCategory] = useState(existing?.category ?? continueSeries?.category ?? CATEGORIES[0].name);
  const [videoUrl, setVideoUrl] = useState(existing?.video_url ?? "");
  const [seriesId, setSeriesId] = useState<string>(existing?.series_id ?? continueSeries?.series_id ?? "");
  const [partNumber, setPartNumber] = useState<number>(existing?.part_number ?? continueSeries?.nextPart ?? 1);
  const [seriesOptions, setSeriesOptions] = useState<SeriesOption[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsRef = useRef<HTMLElement | null>(null);

  // ---- writing surface ----
  const [focus, setFocus] = useState(false);
  const [restored, setRestored] = useState<LocalDraft | null>(null);
  const [localSavedAt, setLocalSavedAt] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ---- assistant ----
  const [suggestion, setSuggestion] = useState<FormatSuggestion | null>(null);
  const [originalBeforePolish, setOriginalBeforePolish] = useState<string | null>(null);
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [view, setView] = useState<"diff" | "preview">("diff");
  const [cleanedNotice, setCleanedNotice] = useState<string | null>(null);

  // ---- save ----
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(existing?.id ?? null);

  /* ---------------- auth + series ---------------- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user && !existing && !continueSeries) {
        fetchMyProfile(data.user.id).then((p) => {
          setCreator((c) => c || p?.display_name || displayNameFor(data.user));
          if (p?.bio) setAuthorBio((b) => b || p.bio || "");
        });
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /* ---------------- local autosave ---------------- */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(localKey);
      if (!raw) return;
      const d = JSON.parse(raw) as LocalDraft;
      const differs = d.content.trim() !== (existing?.content ?? "").trim() || d.title.trim() !== (existing?.title ?? "").trim();
      if (d.content.trim() && differs) queueMicrotask(() => setRestored(d));
    } catch {
      /* ignore */
    }
  }, [localKey, existing]);

  useEffect(() => {
    if (!content.trim() && !title.trim()) return;
    const t = window.setTimeout(() => {
      try {
        const d: LocalDraft = { title, content, category, creator, isAnonymous, authorBio, experiencedOn, videoUrl, savedAt: Date.now() };
        window.localStorage.setItem(localKey, JSON.stringify(d));
        setLocalSavedAt(d.savedAt);
      } catch {
        /* storage unavailable */
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [title, content, category, creator, isAnonymous, authorBio, experiencedOn, videoUrl, localKey]);

  const restoreLocal = () => {
    if (!restored) return;
    setTitle(restored.title);
    setContent(restored.content);
    setCategory(restored.category);
    setCreator(restored.creator);
    setIsAnonymous(restored.isAnonymous);
    setAuthorBio(restored.authorBio);
    setExperiencedOn(restored.experiencedOn);
    setVideoUrl(restored.videoUrl);
    setRestored(null);
  };
  const discardLocal = () => {
    try {
      window.localStorage.removeItem(localKey);
    } catch {
      /* ignore */
    }
    setRestored(null);
  };

  /* ---------------- textarea auto-grow ---------------- */
  const autosize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, 480)}px`;
  }, []);
  useEffect(() => {
    autosize();
  }, [content, suggestion, autosize]);

  /* ---------------- derived ---------------- */
  const videoOk = !videoUrl.trim() || !!extractYouTubeId(videoUrl);
  const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);
  const minutes = Math.max(1, Math.round(wordCount / 220));
  const transcripty = useMemo(() => looksLikeTranscript(content), [content]);
  const missing: string[] = [];
  if (title.trim().length < 3) missing.push("a title");
  if (content.trim().length < 40) missing.push("your testimony");
  if (!isAnonymous && creator.trim().length < 2) missing.push("your name (or choose anonymous)");
  if (!videoOk) missing.push("a valid YouTube link");
  const canSave = missing.length === 0;

  const diff = useMemo(() => (suggestion && originalBeforePolish !== null ? diffWords(originalBeforePolish, suggestion.formatted) : null), [suggestion, originalBeforePolish]);
  const stats = useMemo(() => (diff ? diffStats(diff) : null), [diff]);

  /* ---------------- actions ---------------- */
  const cleanUp = () => {
    const before = content;
    const after = cleanTranscript(content);
    if (after === before.trim()) {
      setCleanedNotice("Nothing to clean — no timestamps or caption artifacts found.");
    } else {
      setContent(after);
      setCleanedNotice("Timestamps and caption breaks removed. Your words are untouched.");
    }
    window.setTimeout(() => setCleanedNotice(null), 4000);
  };

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
    if (suggestion) setContent(suggestion.formatted);
    setSuggestion(null);
  };

  const save = async (status: "draft" | "published") => {
    if (!user) return;
    if (!canSave) {
      setDetailsOpen(true);
      window.setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return;
    }
    setSaving(status === "draft" ? "draft" : "publish");
    setSaveError(null);

    const row = {
      title: title.trim(),
      description: makeDescription(content),
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
      const res = await supabase.from("testimonies").insert(row).select(TESTIMONY_COLUMNS).single();
      error = res.error;
      id = (res.data as Testimony | null)?.id ?? null;
    }
    if (error || !id) {
      console.error("save testimony:", error?.message);
      setSaveError("Couldn't save. Check your connection and try again — your text is kept in this browser.");
      setSaving(null);
      return;
    }
    try {
      window.localStorage.removeItem(localKey);
    } catch {
      /* ignore */
    }
    setSavedId(id);
    setSaving(null);
    router.push(status === "published" ? testimonyPath({ id, title: title.trim() }) : `/me?saved=${id}`);
    router.refresh();
  };

  /* ---------------- render ---------------- */
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

  const detailsSummary = [category, isAnonymous ? "Anonymous" : creator.trim() || "no name yet", videoUrl.trim() ? "video attached" : null, partNumber > 1 ? `Part ${partNumber}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={focus ? "writing-focus" : undefined}>
      {restored && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-gold-500/40 bg-gold-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-parchment-100">
            We kept an unsaved draft from {new Date(restored.savedAt).toLocaleString()} ({restored.content.trim().split(/\s+/).length} words).
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={restoreLocal} className="btn btn-primary !px-4 !py-1.5 text-xs">Restore it</button>
            <button type="button" onClick={discardLocal} className="btn btn-ghost !px-4 !py-1.5 text-xs">Discard</button>
          </div>
        </div>
      )}

      {/* ================= Writing canvas ================= */}
      <section className="paper">
        <div className="paper-inner">
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
            placeholder="Untitled testimony"
            rows={1}
            maxLength={120}
            aria-label="Title"
            className="paper-title"
          />

          {suggestion ? (
            <AssistantReview suggestion={suggestion} diff={diff!} stats={stats!} view={view} setView={setView} onAccept={acceptSuggestion} onReject={() => setSuggestion(null)} />
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onInput={autosize}
              placeholder={prompt}
              aria-label="Your testimony"
              className="paper-body"
              maxLength={60000}
              spellCheck
            />
          )}
        </div>

        {/* Toolbar */}
        <div className="paper-toolbar">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-parchment-500">
            <span>
              {wordCount.toLocaleString()} {wordCount === 1 ? "word" : "words"}
              {wordCount > 0 && <span className="text-parchment-700"> · about {minutes} min read</span>}
            </span>
            {localSavedAt && <span className="text-parchment-700">Saved in this browser {new Date(localSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
            {cleanedNotice && <span className="text-gold-300">{cleanedNotice}</span>}
          </div>
          {!suggestion && (
            <div className="flex flex-wrap items-center gap-2">
              {transcripty && (
                <button type="button" onClick={cleanUp} className="btn btn-ghost !px-3 !py-1.5 text-xs">
                  <Broom /> Clean up transcript
                </button>
              )}
              <button type="button" onClick={polish} disabled={polishing || content.trim().length < 40} className="btn btn-ghost !px-3 !py-1.5 text-xs">
                <Sparkle /> {polishing ? "Reading…" : "Polish"}
              </button>
              <button type="button" onClick={() => setFocus((f) => !f)} className="btn btn-ghost !px-3 !py-1.5 text-xs" aria-pressed={focus}>
                {focus ? "Exit focus" : "Focus"}
              </button>
            </div>
          )}
        </div>
      </section>
      {polishError && <p className="mt-3 text-sm text-ember-500">{polishError}</p>}
      {transcripty && !suggestion && (
        <p className="mt-3 text-xs text-parchment-700">
          This looks like a pasted video transcript. <button type="button" onClick={cleanUp} className="underline hover:text-gold-300">Clean up transcript</button> strips the timestamps and rejoins the lines without touching a word — then Polish can handle the rest.
        </p>
      )}
      {!transcripty && !suggestion && wordCount > 0 && (
        <p className="mt-3 text-xs text-parchment-700">
          <span className="text-parchment-500">Polish</span> fixes grammar, punctuation, and paragraph breaks. It never changes what you said, and you approve every edit.
        </p>
      )}

      {/* ================= Details (collapsed) ================= */}
      <section ref={detailsRef} className="card mt-10 overflow-hidden">
        <button type="button" onClick={() => setDetailsOpen((o) => !o)} className="flex w-full items-center justify-between gap-4 p-5 text-left" aria-expanded={detailsOpen}>
          <div>
            <p className="eyebrow">Before you publish</p>
            <p className="mt-1 text-sm text-parchment-300">{detailsSummary}</p>
          </div>
          <span className={`text-parchment-500 transition ${detailsOpen ? "rotate-180" : ""}`} aria-hidden>▾</span>
        </button>

        {detailsOpen && (
          <div className="space-y-6 border-t border-ink-700 p-5 sm:p-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Kind of encounter" htmlFor="category">
                <select id="category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.name}>{c.name}</option>
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
              <Field label="About you" htmlFor="bio" hint="Optional. A sentence or a link.">
                <input id="bio" className="input" value={authorBio} onChange={(e) => setAuthorBio(e.target.value)} maxLength={200} placeholder="e.g. Nurse in Ohio. More at example.com" />
              </Field>
            )}

            <Field label="YouTube link" htmlFor="video" hint="Optional. If you told this story on video, it's embedded above the text." error={!videoOk ? "That doesn't look like a YouTube link." : undefined}>
              <input id="video" className="input" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" inputMode="url" />
            </Field>

            <div className="border-t border-ink-700 pt-6">
              <p className="mb-1 text-sm font-medium text-parchment-100">Series</p>
              <p className="mb-4 text-xs text-parchment-700">Long testimony? Publish it in parts. Readers see them as one series: Part 1 → Part 2 → …</p>
              {continueSeries ? (
                <p className="text-sm text-parchment-300">
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
                        <option key={o.series_id} value={o.series_id}>{o.title} (next: Part {o.nextPart})</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Part" htmlFor="part">
                    <input id="part" type="number" min={1} className="input w-24" value={partNumber} onChange={(e) => setPartNumber(Math.max(1, Number(e.target.value) || 1))} />
                  </Field>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ================= Actions ================= */}
      <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-parchment-700">
          {suggestion
            ? "Accept or keep your original above before saving."
            : !canSave && wordCount > 0
              ? `Still needed: ${missing.join(", ")}.`
              : existing?.status === "published"
                ? "This testimony is live. Saving as draft will hide it."
                : "Drafts are private until you publish."}
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => save("draft")} disabled={saving !== null || !!suggestion || wordCount === 0} className="btn btn-ghost">
            {saving === "draft" ? "Saving…" : "Save draft"}
          </button>
          <button type="button" onClick={() => save("published")} disabled={saving !== null || !!suggestion || wordCount === 0} className="btn btn-primary">
            {saving === "publish" ? "Publishing…" : existing?.status === "published" ? "Update" : "Publish"}
          </button>
        </div>
      </section>
      {saveError && <p className="mt-3 text-right text-sm text-ember-500">{saveError}</p>}
    </div>
  );
}

/* ---------- Assistant review ---------- */

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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold-500/30 bg-gold-500/5 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gold-300">
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
            <button type="button" onClick={() => setView("diff")} className={`rounded-full px-3 py-1 ${view === "diff" ? "bg-ink-600 text-parchment-50" : "text-parchment-500"}`}>What changed</button>
            <button type="button" onClick={() => setView("preview")} className={`rounded-full px-3 py-1 ${view === "preview" ? "bg-ink-600 text-parchment-50" : "text-parchment-500"}`}>Clean preview</button>
          </div>
        )}
      </div>

      {suggestion.changed ? (
        <div className="paper-review whitespace-pre-wrap">
          {view === "diff"
            ? diff.map((op, i) =>
                op.type === "equal" ? (
                  <span key={i}>{op.text}</span>
                ) : op.type === "insert" ? (
                  <ins key={i} className="rounded bg-emerald-500/20 px-0.5 text-emerald-200 no-underline">{op.text}</ins>
                ) : (
                  <del key={i} className="rounded bg-ember-500/20 px-0.5 text-ember-500/90">{op.text}</del>
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
                <span className="text-gold-500" aria-hidden>◆</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-parchment-700">Observations only — nothing in your text was changed because of them.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {suggestion.changed && (
          <button type="button" onClick={onAccept} className="btn btn-primary !py-2">Use the polished version</button>
        )}
        <button type="button" onClick={onReject} className="btn btn-ghost !py-2">{suggestion.changed ? "Keep my original" : "Back to writing"}</button>
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
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M12 2l1.8 5.6L19.5 9l-5.7 1.4L12 16l-1.8-5.6L4.5 9l5.7-1.4L12 2zm7 11l.9 2.6 2.6.9-2.6.9L19 20l-.9-2.6-2.6-.9 2.6-.9L19 13zM5 14l.7 2 2 .7-2 .7L5 19.5l-.7-2-2-.7 2-.7L5 14z" />
    </svg>
  );
}

function Broom() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M19 5 9 15M9 15l-4 4M9 15l3 3M6 18l-2 2" />
    </svg>
  );
}

function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-parchment-100">{label}</label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-ember-500">{error}</p> : hint ? <p className="mt-1.5 text-xs text-parchment-700">{hint}</p> : null}
    </div>
  );
}
