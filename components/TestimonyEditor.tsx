"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/categories";
import { LANGUAGES } from "@/lib/languages";
import { diffStats, diffWords } from "@/lib/diff";
import { extractYouTubeId } from "@/lib/youtube";
import { displayNameFor } from "@/lib/user";
import { TESTIMONY_COLUMNS } from "@/lib/queries";
import { cleanTranscript, looksLikeTranscript } from "@/lib/transcript";
import { testimonyPath } from "@/lib/seo";
import { fetchMyProfile } from "@/lib/profiles";
import type { DatePrecision, ExtractedDetails, FormatSuggestion, Testimony } from "@/lib/types";
import { formatExperienced, isTruncatedExcerpt } from "@/lib/format";

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
  description?: string;
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
  const [description, setDescription] = useState(existing && !isTruncatedExcerpt(existing.description, existing.content) ? existing.description : "");
  const [prompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);

  // ---- details ----
  const [experiencedOn, setExperiencedOn] = useState(existing?.experienced_on ?? "");
  const [creator, setCreator] = useState(existing?.creator ?? continueSeries?.creator ?? "");
  const [isAnonymous, setIsAnonymous] = useState(existing?.is_anonymous ?? continueSeries?.is_anonymous ?? false);
  const [authorBio, setAuthorBio] = useState(existing?.author_bio ?? continueSeries?.author_bio ?? "");
  const [category, setCategory] = useState(existing?.category ?? continueSeries?.category ?? CATEGORIES[0].name);
  const [videoUrl, setVideoUrl] = useState(existing?.video_url ?? "");
  const [lang, setLang] = useState(existing?.language ?? "en");
  const [precision, setPrecision] = useState<DatePrecision>(existing?.experienced_precision ?? "day");
  const [locationText, setLocationText] = useState(existing?.location_text ?? "");
  const [locationCity, setLocationCity] = useState(existing?.location_city ?? "");
  const [locationRegion, setLocationRegion] = useState(existing?.location_region ?? "");
  const [locationCountry, setLocationCountry] = useState(existing?.location_country ?? "");
  const [locationCode, setLocationCode] = useState(existing?.location_country_code ?? "");

  // ---- details assistant ----
  const [extracted, setExtracted] = useState<ExtractedDetails | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedFor, setExtractedFor] = useState<string>("");
  type SuggestedField = "title" | "description" | "category" | "experienced" | "location";
  const [suggested, setSuggested] = useState<Set<SuggestedField>>(new Set());
  const [ghostTitle, setGhostTitle] = useState<string>("");
  const lastAutoWordsRef = useRef<number>(0);
  const autoTimerRef = useRef<number | null>(null);
  const suggestDetailsRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const markSuggested = (f: SuggestedField) => setSuggested((prev) => new Set(prev).add(f));
  const unmark = (f: SuggestedField) =>
    setSuggested((prev) => {
      if (!prev.has(f)) return prev;
      const next = new Set(prev);
      next.delete(f);
      return next;
    });
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

  // ---- transcript import ----
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<{ message: string; fallback: boolean } | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

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
        const d: LocalDraft = { title, content, description, category, creator, isAnonymous, authorBio, experiencedOn, videoUrl, savedAt: Date.now() };
        window.localStorage.setItem(localKey, JSON.stringify(d));
        setLocalSavedAt(d.savedAt);
      } catch {
        /* storage unavailable */
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [title, content, description, category, creator, isAnonymous, authorBio, experiencedOn, videoUrl, localKey]);

  const restoreLocal = () => {
    if (!restored) return;
    setTitle(restored.title);
    setContent(restored.content);
    setDescription(restored.description ?? "");
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

  /* ---------------- details assistant: run on pause ---------------- */
  useEffect(() => {
    if (suggestion || extracting) return;
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    if (words < 80) return;
    const changed = Math.abs(words - lastAutoWordsRef.current);
    const firstRun = lastAutoWordsRef.current === 0;
    if (!firstRun && changed < 40) return;
    if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current);
    autoTimerRef.current = window.setTimeout(() => {
      void suggestDetailsRef.current();
    }, 2500);
    return () => {
      if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current);
    };
  }, [content, suggestion, extracting]);

  /* ---------------- derived ---------------- */
  const videoOk = !videoUrl.trim() || !!extractYouTubeId(videoUrl);
  const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);
  const minutes = Math.max(1, Math.round(wordCount / 220));
  const transcripty = useMemo(() => looksLikeTranscript(content), [content]);
  const missing: string[] = [];
  const effectiveTitle = title.trim() || ghostTitle.trim();
  if (effectiveTitle.length < 3) missing.push("a title");
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

  const importTranscript = async (url: string) => {
    const id = extractYouTubeId(url);
    if (!id) {
      setImportError({ message: "That doesn't look like a YouTube link.", fallback: false });
      return;
    }
    setImporting(true);
    setImportError(null);
    setImportNotice(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/transcript", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ url, lang }),
      });
      const json = (await res.json()) as { text?: string; language?: string; kind?: "manual" | "auto"; videoTitle?: string | null; error?: string; fallback?: boolean };
      if (!res.ok || !json.text) {
        setImportError({ message: json.error || "Couldn't fetch the transcript.", fallback: json.fallback !== false });
        return;
      }
      if (!videoUrl.trim()) setVideoUrl(url.trim());
      if (content.trim() && !window.confirm("Replace what you've written with the video transcript?")) return;
      setContent(json.text);
      if (json.language && LANGUAGES.some((l) => l.code === json.language)) setLang(json.language);
      if (!title.trim() && json.videoTitle) setGhostTitle(json.videoTitle.replace(/\s*[|\-–—]\s*[^|\-–—]{0,40}$/, "").trim() || json.videoTitle);
      lastAutoWordsRef.current = 0; // let the details pass run on the imported text
      setImportNotice(`Transcript imported${json.kind === "auto" ? " (YouTube's auto-captions — worth a read-through)" : ""}. Timestamps removed; your words untouched.`);
      window.setTimeout(() => setImportNotice(null), 8000);
      window.setTimeout(autosize, 50);
    } catch {
      setImportError({ message: "Couldn't reach the importer.", fallback: true });
    } finally {
      setImporting(false);
    }
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

  const applyLocation = (l: NonNullable<ExtractedDetails["location"]>) => {
    setLocationText(l.text);
    setLocationCity(l.city ?? "");
    setLocationRegion(l.region ?? "");
    setLocationCountry(l.country ?? "");
    setLocationCode(l.country_code ?? "");
  };

  const suggestDetails = async (force = false) => {
    const key = `${content.trim().slice(0, 4000)}|${content.trim().length}`;
    if (!force && (extracting || extractedFor === key || content.trim().length < 200)) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ content, title }),
      });
      const json = (await res.json()) as ExtractedDetails & { error?: string };
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setExtracted(json);
      setExtractedFor(key);
      // Fill only what's empty; the author's own entries always win.
      if (!title.trim() && json.titles[0]) setGhostTitle(json.titles[0]);
      if (!description.trim() && json.description) {
        setDescription(json.description);
        markSuggested("description");
      }
      if (json.category && category === CATEGORIES[0].name && !existing && !suggested.has("category")) {
        setCategory(json.category);
        markSuggested("category");
      }
      if (!experiencedOn && json.experienced) {
        setExperiencedOn(json.experienced.date);
        setPrecision(json.experienced.precision);
        markSuggested("experienced");
      }
      if (!locationText.trim() && !locationCity.trim() && !locationCountry.trim() && json.location) {
        applyLocation(json.location);
        markSuggested("location");
      }
      lastAutoWordsRef.current = content.trim().split(/\s+/).filter(Boolean).length;
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setExtracting(false);
    }
  };

  useEffect(() => {
    suggestDetailsRef.current = suggestDetails;
  });

  const acceptSuggestion = () => {
    if (suggestion) setContent(suggestion.formatted);
    setSuggestion(null);
  };

  const save = async (status: "draft" | "published") => {
    if (!user) return;
    if (!canSave) {
      setDetailsOpen(true);
      void suggestDetails();
      window.setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return;
    }
    setSaving(status === "draft" ? "draft" : "publish");
    setSaveError(null);

    const row = {
      title: effectiveTitle,
      description: description.trim() || makeDescription(content),
      video_url: videoUrl.trim() || null,
      creator: isAnonymous ? "Anonymous" : creator.trim(),
      category,
      content: content.trim(),
      author_id: user.id,
      is_anonymous: isAnonymous,
      author_bio: isAnonymous ? null : authorBio.trim() || null,
      experienced_on: experiencedOn || null,
      language: lang,
      experienced_precision: experiencedOn ? precision : "day",
      location_text: locationText.trim() || null,
      location_city: locationCity.trim() || null,
      location_region: locationRegion.trim() || null,
      location_country: locationCountry.trim() || null,
      location_country_code: locationCode.trim().toUpperCase() || null,
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
    router.push(status === "published" ? testimonyPath({ id, title: effectiveTitle }) : `/me?saved=${id}`);
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

  const detailsSummary = [category, isAnonymous ? "Anonymous" : creator.trim() || "no name yet", experiencedOn ? formatExperienced(experiencedOn, precision) : null, locationCity || locationCountry || locationText || null, videoUrl.trim() ? "video attached" : null, partNumber > 1 ? `Part ${partNumber}` : null]
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
          <div className="relative">
            <textarea
              value={title}
              onChange={(e) => {
                setTitle(e.target.value.replace(/\n/g, ""));
                unmark("title");
              }}
              onKeyDown={(e) => {
                if (e.key === "Tab" && !title.trim() && ghostTitle) {
                  e.preventDefault();
                  setTitle(ghostTitle);
                  markSuggested("title");
                }
              }}
              placeholder={ghostTitle && !title.trim() ? "" : "Untitled testimony"}
              rows={1}
              maxLength={120}
              aria-label="Title"
              className="paper-title"
            />
            {ghostTitle && !title.trim() && (
              <button
                type="button"
                onClick={() => {
                  setTitle(ghostTitle);
                  markSuggested("title");
                }}
                className="paper-title paper-title-ghost absolute inset-x-0 top-0 flex items-baseline gap-3 text-left"
                title="Use this title (or press Tab)"
              >
                <span className="min-w-0 truncate">{ghostTitle}</span>
                <span className="shrink-0 font-body text-xs not-italic tracking-wide text-gold-500/80">suggested · Tab to keep</span>
              </button>
            )}
          </div>

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
            {extracting && (
              <span className="flex items-center gap-1.5 text-gold-500/80">
                <Sparkle /> Reading for details…
              </span>
            )}
            {!extracting && suggested.size > 0 && (
              <span className="text-parchment-700">
                {suggested.size} {suggested.size === 1 ? "detail" : "details"} suggested from your text
              </span>
            )}
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
      {importNotice && <p className="mt-3 text-xs text-gold-300">{importNotice}</p>}
      {wordCount === 0 && !suggestion && (
        <div className="mt-4 rounded-xl border border-ink-600 bg-ink-900/60 p-4">
          <p className="text-sm text-parchment-300">Told this story on video? Paste the YouTube link and we&apos;ll bring the transcript in for you.</p>
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void importTranscript(importUrl);
            }}
          >
            <input className="input" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" inputMode="url" aria-label="YouTube link to import" />
            <button type="submit" disabled={importing || !extractYouTubeId(importUrl)} className="btn btn-primary whitespace-nowrap !py-2">
              {importing ? "Fetching…" : "Import transcript"}
            </button>
          </form>
          <p className="mt-2 text-xs text-parchment-700">For your own video, or one you have permission to share. You can edit everything before publishing.</p>
          {importError && <ImportFallback error={importError} />}
        </div>
      )}
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
        <button
          type="button"
          onClick={() => {
            setDetailsOpen((o) => !o);
            if (!detailsOpen) void suggestDetails();
          }}
          className="flex w-full items-center justify-between gap-4 p-5 text-left"
          aria-expanded={detailsOpen}
        >
          <div>
            <p className="eyebrow">Before you publish</p>
            <p className="mt-1 text-sm text-parchment-300">{detailsSummary}</p>
          </div>
          <span className={`text-parchment-500 transition ${detailsOpen ? "rotate-180" : ""}`} aria-hidden>▾</span>
        </button>

        {detailsOpen && (
          <div className="space-y-6 border-t border-ink-700 p-5 sm:p-6">
            {/* Details assistant */}
            <div className="rounded-lg border border-gold-500/30 bg-gold-500/5 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-gold-300">
                  <Sparkle />
                  {extracting ? "Reading your testimony for details…" : extracted ? "Filled in from your testimony — edit anything that's off" : "Details fill in on their own as you write"}
                </span>
                <button type="button" onClick={() => void suggestDetails(true)} disabled={extracting || content.trim().length < 200} className="btn btn-ghost !px-3 !py-1 text-xs">
                  {extracted ? "Look again" : "Read now"}
                </button>
              </div>
              {extractError && <p className="mt-2 text-xs text-ember-500">{extractError}</p>}
              {extracted && (
                <div className="mt-3 space-y-2 text-xs text-parchment-300">
                  {extracted.titles.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-parchment-500">Title ideas:</span>
                      {extracted.titles.map((t) => (
                        <button key={t} type="button" onClick={() => setTitle(t)} className={`rounded-full border px-3 py-1 text-xs transition ${title === t ? "border-gold-500 bg-gold-500 text-ink-950" : "border-gold-500/40 text-gold-300 hover:bg-gold-500/10"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                  {extracted.description && (
                    <Suggestion label="Summary" value={extracted.description} applied={description === extracted.description} onUse={() => setDescription(extracted.description!)} />
                  )}
                  {extracted.experienced && (
                    <Suggestion label="When" value={formatExperienced(extracted.experienced.date, extracted.experienced.precision)} evidence={extracted.experienced.evidence} applied={experiencedOn === extracted.experienced.date} onUse={() => { setExperiencedOn(extracted.experienced!.date); setPrecision(extracted.experienced!.precision); }} />
                  )}
                  {extracted.location && (
                    <Suggestion label="Where" value={[extracted.location.city, extracted.location.region, extracted.location.country].filter(Boolean).join(", ") || extracted.location.text} evidence={extracted.location.evidence} applied={locationText === extracted.location.text} onUse={() => applyLocation(extracted.location!)} />
                  )}
                  {extracted.category && (
                    <Suggestion label="Kind" value={extracted.category} applied={category === extracted.category} onUse={() => setCategory(extracted.category!)} />
                  )}
                  {!extracted.experienced && !extracted.location && <p className="text-parchment-700">No date or place is mentioned in the text — add them below if you&apos;d like.</p>}
                </div>
              )}
            </div>

            <Field label="One-line summary" htmlFor="description" hint="Shown under the title, on cards, and in search results. The assistant can write it from your text.">
              <textarea id="description" className={`input resize-y ${suggested.has("description") ? "input-suggested" : ""}`} rows={2} value={description} onChange={(e) => { setDescription(e.target.value.slice(0, 200)); unmark("description"); }} placeholder="What happened, in a sentence." />
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Kind of encounter" htmlFor="category">
                <select id="category" className={`input ${suggested.has("category") ? "input-suggested" : ""}`} value={category} onChange={(e) => { setCategory(e.target.value); unmark("category"); }}>
                  {CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="When did it happen?" htmlFor="experienced" hint="Optional. Approximate is fine — choose how exact it is.">
                <div className="flex gap-2">
                  <input id="experienced" type="date" className={`input ${suggested.has("experienced") ? "input-suggested" : ""}`} value={experiencedOn} onChange={(e) => { setExperiencedOn(e.target.value); unmark("experienced"); }} max={new Date().toISOString().slice(0, 10)} />
                  <select aria-label="How exact is the date" className="input !w-auto" value={precision} onChange={(e) => setPrecision(e.target.value as DatePrecision)} disabled={!experiencedOn}>
                    <option value="day">Exact day</option>
                    <option value="month">That month</option>
                    <option value="year">That year</option>
                    <option value="approx">Around then</option>
                  </select>
                </div>
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

            <div>
              <p className="mb-1.5 block text-sm font-medium text-parchment-100">Where did it happen?</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <input aria-label="City" className="input" placeholder="City" value={locationCity} onChange={(e) => { setLocationCity(e.target.value); unmark("location"); }} maxLength={80} />
                <input aria-label="State or region" className="input" placeholder="State / region" value={locationRegion} onChange={(e) => { setLocationRegion(e.target.value); unmark("location"); }} maxLength={80} />
                <input aria-label="Country" className="input" placeholder="Country" value={locationCountry} onChange={(e) => { setLocationCountry(e.target.value); setLocationCode(""); unmark("location"); }} maxLength={80} />
              </div>
              <input aria-label="Place in your own words" className="input mt-3" placeholder="Or in your own words — e.g. a hospital outside Lagos" value={locationText} onChange={(e) => { setLocationText(e.target.value); unmark("location"); }} maxLength={160} />
              <p className="mt-1.5 text-xs text-parchment-700">Optional. Lets readers find testimonies from their part of the world.</p>
            </div>

            <Field label="Written in" htmlFor="lang" hint="The language of your text. Readers can view it in other languages; the original is always kept.">
              <select id="lang" className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.nativeName}</option>
                ))}
              </select>
            </Field>

            <Field label="YouTube link" htmlFor="video" hint="Optional. If you told this story on video, it's embedded above the text." error={!videoOk ? "That doesn't look like a YouTube link." : undefined}>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input id="video" className="input" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" inputMode="url" />
                {extractYouTubeId(videoUrl) && (
                  <button type="button" onClick={() => void importTranscript(videoUrl)} disabled={importing} className="btn btn-ghost whitespace-nowrap !py-2 text-sm">
                    {importing ? "Fetching…" : content.trim() ? "Replace with transcript" : "Import transcript"}
                  </button>
                )}
              </div>
              {importError && wordCount > 0 && <ImportFallback error={importError} />}
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

function ImportFallback({ error }: { error: { message: string; fallback: boolean } }) {
  return (
    <div className="mt-3 rounded-lg border border-ink-600 bg-ink-900 p-3 text-xs text-parchment-300">
      <p className="text-ember-500">{error.message}</p>
      {error.fallback && (
        <p className="mt-2 text-parchment-500">
          YouTube sometimes refuses automated requests. The manual way takes thirty seconds: open the video, click <span className="text-parchment-300">…more</span> under the title, then <span className="text-parchment-300">Show transcript</span>, select all of it, and paste it here — the timestamps are cleaned up automatically.
        </p>
      )}
    </div>
  );
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

function Suggestion({ label, value, evidence, applied, onUse }: { label: string; value: string; evidence?: string; applied: boolean; onUse: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-parchment-500">{label}:</span>
      <span className="text-parchment-100">{value}</span>
      {evidence && <span className="text-parchment-700">— from “{evidence.length > 90 ? `${evidence.slice(0, 90)}…` : evidence}”</span>}
      {applied ? <span className="text-gold-400">✓ used</span> : (
        <button type="button" onClick={onUse} className="rounded-full border border-gold-500/40 px-2 py-0.5 text-gold-300 hover:bg-gold-500/10">Use</button>
      )}
    </div>
  );
}
