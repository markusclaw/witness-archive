/**
 * YouTube import queue: enqueue videos (dedup by video id), then process them
 * one at a time — transcript → format → extract details → publish under the
 * token owner's account, flagging anything uncertain for review.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractYouTubeId } from "@/lib/youtube";
import { fetchVideoMeta, type VideoMeta } from "@/lib/video-meta";
import { formatLongText, importFormatModel } from "@/lib/ai/format";
import { extractDetails } from "@/lib/ai/extract";
import { categoryByName } from "@/lib/categories";
import { isSupportedLanguage } from "@/lib/languages";
import { absoluteUrl, testimonyPath } from "@/lib/seo";
import { resolveTranscript } from "@/lib/import/transcript";
import { tagQuestions } from "@/lib/ai/questions";
import type { ExtractedDetails } from "@/lib/types";

export type JobStatus = "queued" | "processing" | "published" | "duplicate" | "skipped" | "failed" | "blocked";

export interface ImportJobRow {
  id: string;
  youtube_id: string;
  url: string;
  status: JobStatus;
  reason: string | null;
  reason_code: string | null;
  testimony_id: string | null;
  supplied_transcript: string | null;
  transcript_source: "supplied" | "youtube" | "paid" | null;
  language: string | null;
  flags: string[];
  flag_notes: Record<string, unknown>;
  reviewed_at: string | null;
  attempts: number;
  next_attempt_at: string;
  batch_id: string | null;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export const JOB_COLUMNS =
  "id, youtube_id, url, status, reason, reason_code, testimony_id, transcript_source, language, flags, flag_notes, reviewed_at, attempts, next_attempt_at, batch_id, created_at, updated_at, started_at, finished_at";

export interface TestimonyRef {
  id: string;
  title: string;
  category: string;
  status: string;
  url: string;
  created_at: string;
}

export function testimonyRef(t: { id: string; title: string; category: string; status: string; created_at: string }): TestimonyRef {
  return { id: t.id, title: t.title, category: t.category, status: t.status, url: absoluteUrl(testimonyPath(t)), created_at: t.created_at };
}

export const FLAG_LABELS: Record<string, string> = {
  date_uncertain: "Date unclear — left blank",
  place_uncertain: "Place unclear — left blank",
  category_uncertain: "Category unclear — set to Other",
  witness_unknown: "Witness not named",
  possible_duplicate: "May repeat an existing testimony",
  language_unsupported: "Language not yet supported on the site",
  short_transcript: "Very short transcript",
};

/* ---------------- enqueue ---------------- */

export interface ImportItemInput {
  url?: unknown;
  transcript?: unknown;
  language?: unknown;
}

export interface EnqueueResult {
  input: string;
  youtube_id: string | null;
  result: "queued" | "requeued" | "in_queue" | "exists" | "invalid";
  message?: string;
  job: Omit<ImportJobRow, "supplied_transcript" | "requested_by"> | null;
  testimony: TestimonyRef | null;
}

const REQUEUEABLE: JobStatus[] = ["failed", "blocked"];

export async function enqueue(admin: SupabaseClient, items: ImportItemInput[], userId: string, batchId: string): Promise<EnqueueResult[]> {
  const parsed = items.map((it) => {
    const input = typeof it.url === "string" ? it.url.trim() : "";
    const transcript = typeof it.transcript === "string" && it.transcript.trim() ? it.transcript.slice(0, 400_000) : null;
    const language = typeof it.language === "string" && /^[a-z]{2}$/i.test(it.language) ? it.language.toLowerCase() : null;
    return { input, id: extractYouTubeId(input), transcript, language };
  });
  const ids = [...new Set(parsed.map((p) => p.id).filter((x): x is string => !!x))];

  const [{ data: existingT }, { data: existingJ }] = await Promise.all([
    ids.length ? admin.from("testimonies").select("id, title, category, status, created_at, video_id").in("video_id", ids).order("created_at") : Promise.resolve({ data: [] }),
    ids.length ? admin.from("import_jobs").select(JOB_COLUMNS).in("youtube_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const tByVid = new Map<string, TestimonyRef>();
  for (const t of (existingT ?? []) as { id: string; title: string; category: string; status: string; created_at: string; video_id: string }[]) {
    const prev = tByVid.get(t.video_id);
    // Prefer a published testimony over a draft.
    if (!prev || (prev.status !== "published" && t.status === "published")) tByVid.set(t.video_id, testimonyRef(t));
  }
  const jByVid = new Map<string, ImportJobRow>(((existingJ ?? []) as ImportJobRow[]).map((j) => [j.youtube_id, j]));

  const out: EnqueueResult[] = [];
  const seen = new Set<string>();
  for (const p of parsed) {
    if (!p.id) {
      out.push({ input: p.input, youtube_id: null, result: "invalid", message: "Not a YouTube video link.", job: null, testimony: null });
      continue;
    }
    if (seen.has(p.id)) {
      out.push({ input: p.input, youtube_id: p.id, result: "in_queue", message: "Listed twice in this request.", job: jByVid.get(p.id) ?? null, testimony: tByVid.get(p.id) ?? null });
      continue;
    }
    seen.add(p.id);
    const testimony = tByVid.get(p.id) ?? null;
    const job = jByVid.get(p.id) ?? null;
    if (testimony) {
      out.push({ input: p.input, youtube_id: p.id, result: "exists", message: "Already in the archive.", job, testimony });
      continue;
    }
    if (job) {
      const canRequeue = REQUEUEABLE.includes(job.status) || (job.status === "skipped" && !!p.transcript) || (job.status === "duplicate" && !job.testimony_id);
      if (!canRequeue) {
        out.push({ input: p.input, youtube_id: p.id, result: "in_queue", message: `Already imported or in the queue (status: ${job.status}).`, job, testimony: null });
        continue;
      }
      const patch: Record<string, unknown> = { status: "queued", attempts: 0, next_attempt_at: new Date().toISOString(), reason: null, reason_code: null, batch_id: batchId, updated_at: new Date().toISOString() };
      if (p.transcript) patch.supplied_transcript = p.transcript;
      if (p.language) patch.language = p.language;
      const { data } = await admin.from("import_jobs").update(patch).eq("id", job.id).select(JOB_COLUMNS).single();
      out.push({ input: p.input, youtube_id: p.id, result: "requeued", job: (data as ImportJobRow) ?? job, testimony: null });
      continue;
    }
    const { data, error } = await admin
      .from("import_jobs")
      .upsert(
        { youtube_id: p.id, url: `https://www.youtube.com/watch?v=${p.id}`, supplied_transcript: p.transcript, language: p.language, batch_id: batchId, requested_by: userId },
        { onConflict: "youtube_id", ignoreDuplicates: true },
      )
      .select(JOB_COLUMNS)
      .maybeSingle();
    if (error) {
      out.push({ input: p.input, youtube_id: p.id, result: "invalid", message: `Couldn't queue: ${error.message}`, job: null, testimony: null });
    } else if (!data) {
      // Lost a race with another request for the same video.
      const { data: again } = await admin.from("import_jobs").select(JOB_COLUMNS).eq("youtube_id", p.id).maybeSingle();
      out.push({ input: p.input, youtube_id: p.id, result: "in_queue", job: (again as ImportJobRow) ?? null, testimony: null });
    } else {
      out.push({ input: p.input, youtube_id: p.id, result: "queued", job: data as ImportJobRow, testimony: null });
    }
  }
  return out;
}

/* ---------------- process ---------------- */

export interface ProcessResult {
  job_id: string;
  youtube_id: string;
  status: JobStatus;
  reason: string | null;
  flags: string[];
  testimony: TestimonyRef | null;
}

/** Claim and process the next job. Returns null when nothing is waiting. */
export async function processNext(admin: SupabaseClient, ownerId: string): Promise<ProcessResult | null> {
  const { data, error } = await admin.rpc("claim_import_job");
  if (error) throw new Error(`claim_import_job: ${error.message}`);
  const job = (Array.isArray(data) ? data[0] : data) as ImportJobRow | undefined;
  if (!job) return null;
  return processJob(admin, job, ownerId);
}

async function finish(admin: SupabaseClient, job: ImportJobRow, patch: Partial<ImportJobRow>, testimony: TestimonyRef | null = null): Promise<ProcessResult> {
  const now = new Date().toISOString();
  const row = { ...patch, updated_at: now, finished_at: now };
  await admin.from("import_jobs").update(row).eq("id", job.id);
  return { job_id: job.id, youtube_id: job.youtube_id, status: patch.status ?? job.status, reason: patch.reason ?? null, flags: patch.flags ?? [], testimony };
}

export async function processJob(admin: SupabaseClient, job: ImportJobRow, ownerId: string): Promise<ProcessResult> {
  try {
    return await runJob(admin, job, ownerId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("import job failed:", job.youtube_id, message);
    return finish(admin, job, { status: "failed", reason_code: "error", reason: `Unexpected error: ${message.slice(0, 300)}. POST the video again to retry.` });
  }
}

async function runJob(admin: SupabaseClient, job: ImportJobRow, ownerId: string): Promise<ProcessResult> {
  // 1. Already in the archive? (Someone may have added it by hand since it was queued.)
  const { data: dup } = await admin.from("testimonies").select("id, title, category, status, created_at").eq("video_id", job.youtube_id).order("created_at").limit(1).maybeSingle();
  if (dup) {
    const ref = testimonyRef(dup);
    return finish(admin, job, { status: "duplicate", reason_code: "duplicate", reason: "This video is already in the archive.", testimony_id: dup.id }, ref);
  }

  // 2. Transcript (supplied → YouTube → paid service).
  const [meta, transcript] = await Promise.all([
    fetchVideoMeta(job.youtube_id).catch(() => null),
    (async () => {
      let supplied = job.supplied_transcript;
      if (supplied === undefined) {
        const { data } = await admin.from("import_jobs").select("supplied_transcript").eq("id", job.id).single();
        supplied = (data?.supplied_transcript as string | null) ?? null;
      }
      return resolveTranscript(job.youtube_id, { supplied, language: job.language });
    })(),
  ]);
  if (!transcript.ok) {
    if (transcript.code === "no_transcript") return finish(admin, job, { status: "skipped", reason_code: "no_transcript", reason: transcript.reason });
    if (transcript.code === "unavailable") return finish(admin, job, { status: "failed", reason_code: "unavailable", reason: transcript.reason });
    const retryMinutes = 30 * Math.max(1, job.attempts);
    const retryAt = new Date(Date.now() + retryMinutes * 60_000).toISOString();
    const final = job.attempts >= 6;
    return finish(admin, job, {
      status: "blocked",
      reason_code: "blocked",
      reason: final ? `${transcript.reason} Automatic retries are used up — send the transcript with the request.` : `${transcript.reason} Next automatic retry after ${retryAt.slice(0, 16).replace("T", " ")} UTC.`,
      next_attempt_at: retryAt,
    });
  }

  // 3. Readable text, then the catalog details.
  const { formatted, fallbacks } = await formatLongText(transcript.text, { model: importFormatModel() });
  if (fallbacks) console.warn("import: formatting fell back to the default model", job.youtube_id, fallbacks);
  const details = await extractDetails(formatted, { video: { title: meta?.title, channel: meta?.author, publishedAt: meta?.publishedAt, description: meta?.description } });

  // 4. Publish.
  const built = buildRow({ details, meta, formatted, youtubeId: job.youtube_id, language: transcript.language ?? job.language ?? meta?.language ?? null });
  const { data: profile } = await admin.from("profiles").select("display_name").eq("id", ownerId).maybeSingle();
  const creator = (profile?.display_name as string | undefined)?.trim() || "Witness Archive";

  // Near-duplicates by text or witness (same video was ruled out above).
  const { data: similar } = await admin.rpc("find_possible_duplicates", {
    p_video_url: null,
    p_content: formatted.slice(0, 4000),
    p_witness: built.row.witness_name,
    p_category: built.row.category,
    p_exclude: null,
    lim: 3,
  });
  const strong = ((similar ?? []) as { id: string; title: string; reasons: string[]; score: number }[]).filter((m) => m.reasons.includes("same_text") || m.reasons.includes("same_witness"));
  if (strong.length) {
    built.flags.push("possible_duplicate");
    built.notes.possible_duplicate = strong.map((m) => ({ id: m.id, title: m.title, reasons: m.reasons, url: absoluteUrl(testimonyPath(m)) }));
  }

  const { data: inserted, error } = await admin
    .from("testimonies")
    .insert({ ...built.row, creator, author_id: ownerId, is_anonymous: false, status: "published" })
    .select("id, title, category, status, created_at")
    .single();
  if (error || !inserted) throw new Error(`insert testimony: ${error?.message ?? "no row"}`);
  const ref = testimonyRef(inserted);

  // Which of the archive's questions it speaks to. Best effort: untagged rows are picked up by /questions/tag.
  try {
    const questions = await tagQuestions({ title: built.row.title, description: built.row.description, category: built.row.category, content: formatted });
    await admin.from("testimonies").update({ questions }).eq("id", inserted.id);
  } catch (err) {
    console.warn("import: question tagging failed", job.youtube_id, err instanceof Error ? err.message : err);
  }
  return finish(
    admin,
    job,
    {
      status: "published",
      reason_code: null,
      reason: null,
      testimony_id: inserted.id,
      transcript_source: transcript.source,
      flags: built.flags,
      flag_notes: built.notes,
      supplied_transcript: null, // no need to keep it once published
    },
    ref,
  );
}

/** Turn the assistant's findings into a testimony row, leaving uncertain fields blank and flagged. */
export function buildRow(input: { details: ExtractedDetails; meta: VideoMeta | null; formatted: string; youtubeId: string; language: string | null }) {
  const { details: d, meta, formatted } = input;
  const flags: string[] = [];
  const notes: Record<string, unknown> = {};

  const exp = d.experienced && d.experienced.confidence === "high" ? d.experienced : null;
  if (d.experienced && !exp) {
    flags.push("date_uncertain");
    notes.date_uncertain = { suggested: d.experienced.date, precision: d.experienced.precision, evidence: d.experienced.evidence };
  }
  const loc = d.location && d.location.confidence === "high" ? d.location : null;
  if (d.location && !loc) {
    flags.push("place_uncertain");
    notes.place_uncertain = { suggested: d.location.text, evidence: d.location.evidence };
  }
  const category = categoryByName(d.category)?.name ?? null;
  if (!category) flags.push("category_uncertain");
  if (!d.witness) flags.push("witness_unknown");
  if (formatted.length < 800) flags.push("short_transcript");

  let language = (input.language ?? "en").toLowerCase();
  if (!/^[a-z]{2}$/.test(language)) language = "en";
  if (!isSupportedLanguage(language)) {
    flags.push("language_unsupported");
    notes.language_unsupported = { language };
  }

  const title = d.titles[0] ?? meta?.title?.trim() ?? "Untitled testimony";
  const flat = formatted.replace(/\s+/g, " ").trim();
  const description = d.description ?? (flat.length > 180 ? `${flat.slice(0, 177).replace(/\s+\S*$/, "")}…` : flat);

  const row = {
    title: title.slice(0, 160),
    description,
    video_url: `https://www.youtube.com/watch?v=${input.youtubeId}`,
    category: category ?? "Other",
    content: formatted,
    author_bio: null,
    experienced_on: exp?.date ?? null,
    experienced_precision: exp?.precision ?? "day",
    language,
    witness_relationship: "shared" as const,
    witness_name: d.witness?.name ?? null,
    source_credit: d.source ?? meta?.author ?? null,
    source_url: meta?.authorUrl ?? null,
    video_title: meta?.title ?? null,
    video_published_at: meta?.publishedAt ?? null,
    video_duration_s: meta?.durationSeconds ?? null,
    video_description: meta?.description ?? null,
    location_text: loc?.text ?? null,
    location_city: loc?.city ?? null,
    location_region: loc?.region ?? null,
    location_country: loc?.country ?? null,
    location_country_code: loc?.country_code ?? null,
  };
  return { row, flags, notes };
}

/** Public shape of a job (never includes the supplied transcript). */
export function jobView(j: ImportJobRow, testimony: TestimonyRef | null = null) {
  return {
    id: j.id,
    youtube_id: j.youtube_id,
    url: j.url,
    status: j.status,
    reason: j.reason,
    reason_code: j.reason_code,
    transcript_source: j.transcript_source,
    flags: j.flags ?? [],
    flag_labels: (j.flags ?? []).map((f) => FLAG_LABELS[f] ?? f),
    flag_notes: j.flag_notes ?? {},
    needs_review: (j.flags ?? []).length > 0 && !j.reviewed_at,
    reviewed_at: j.reviewed_at,
    attempts: j.attempts,
    next_attempt_at: j.status === "blocked" || j.status === "queued" ? j.next_attempt_at : null,
    batch_id: j.batch_id,
    created_at: j.created_at,
    updated_at: j.updated_at,
    started_at: j.started_at,
    finished_at: j.finished_at,
    testimony,
  };
}
