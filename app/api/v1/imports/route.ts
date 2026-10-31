import { authenticate, apiError, apiJson } from "@/lib/import/auth";
import { enqueue, jobView, processJob, JOB_COLUMNS, testimonyRef, type ImportItemInput, type ImportJobRow, type JobStatus, type TestimonyRef } from "@/lib/import/jobs";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 500;
const STATUSES: JobStatus[] = ["queued", "processing", "published", "duplicate", "skipped", "failed", "blocked"];

/**
 * POST /api/v1/imports — queue YouTube videos for import.
 *   JSON: { "url": "…", "transcript"?: "…", "language"?: "en", "process"?: true }
 *         { "videos": [{ "url": "…", "transcript"?: "…", "language"?: "es" }, …] }
 *         { "urls": ["…", "…"] }
 *   CSV / plain text: one URL per line (optional header "url"; optional second column = language).
 * Videos already in the archive come back as result "exists" with the testimony.
 * With "process": true and a single video, it is imported before the response returns.
 */
export async function POST(req: Request) {
  const caller = await authenticate(req);
  if (caller instanceof Response) return caller;

  const type = req.headers.get("content-type") ?? "";
  let items: ImportItemInput[] = [];
  let processNow = false;
  if (type.includes("application/json")) {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return apiError(400, "invalid_json", "The request body isn't valid JSON.");
    }
    if (Array.isArray(body.videos)) items = body.videos.filter((v): v is ImportItemInput => !!v && typeof v === "object");
    else if (Array.isArray(body.urls)) items = body.urls.map((url) => ({ url }));
    else if (typeof body.url === "string") items = [{ url: body.url, transcript: body.transcript, language: body.language }];
    processNow = body.process === true;
  } else {
    const text = await req.text();
    items = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^"?url"?\s*(,|$)/i.test(l))
      .map((l) => {
        const [url, language] = l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        return { url, language };
      });
  }
  if (!items.length) return apiError(400, "no_videos", "Send at least one YouTube URL.");
  if (items.length > MAX_ITEMS) return apiError(413, "too_many", `Send at most ${MAX_ITEMS} videos per request.`);

  const batchId = crypto.randomUUID();
  const results = await enqueue(caller.admin, items, caller.userId, batchId);

  if (processNow && results.length === 1 && (results[0].result === "queued" || results[0].result === "requeued") && results[0].job) {
    const { data } = await caller.admin
      .from("import_jobs")
      .update({ status: "processing", attempts: results[0].job.attempts + 1, started_at: new Date().toISOString() })
      .eq("id", results[0].job.id)
      .in("status", ["queued"])
      .select("*")
      .maybeSingle();
    if (data) {
      const r = await processJob(caller.admin, data as ImportJobRow, caller.userId);
      const { data: fresh } = await caller.admin.from("import_jobs").select(JOB_COLUMNS).eq("id", r.job_id).single();
      results[0] = { ...results[0], job: fresh as ImportJobRow, testimony: r.testimony };
    }
  }

  const summary: Record<string, number> = {};
  for (const r of results) summary[r.result] = (summary[r.result] ?? 0) + 1;
  return apiJson(
    {
      batch_id: batchId,
      summary,
      results: results.map((r) => ({ input: r.input, youtube_id: r.youtube_id, result: r.result, message: r.message ?? null, job: r.job ? jobView(r.job as ImportJobRow, r.testimony) : null, testimony: r.testimony })),
      next: summary.queued || summary.requeued ? "POST /api/v1/imports/run to process the queue (repeat until remaining.queued is 0)." : null,
    },
    202,
  );
}

/**
 * GET /api/v1/imports — the queue and results.
 *   ?status=published,failed  ?batch=<id>  ?needs_review=true  ?youtube_id=…  ?limit=50  ?before=<created_at cursor>
 */
export async function GET(req: Request) {
  const caller = await authenticate(req);
  if (caller instanceof Response) return caller;
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 50));
  const statuses = (sp.get("status") ?? "").split(",").filter((s): s is JobStatus => STATUSES.includes(s as JobStatus));

  let q = caller.admin.from("import_jobs").select(JOB_COLUMNS).order("created_at", { ascending: false }).limit(limit + 1);
  if (statuses.length) q = q.in("status", statuses);
  if (sp.get("batch")) q = q.eq("batch_id", sp.get("batch"));
  if (sp.get("youtube_id")) q = q.eq("youtube_id", sp.get("youtube_id"));
  if (sp.get("needs_review") === "true") q = q.is("reviewed_at", null).neq("flags", "{}").eq("status", "published");
  if (sp.get("before")) q = q.lt("created_at", sp.get("before"));
  const { data, error } = await q;
  if (error) return apiError(500, "db_error", error.message);
  const rows = (data ?? []) as ImportJobRow[];
  const page = rows.slice(0, limit);

  const tIds = page.map((j) => j.testimony_id).filter((x): x is string => !!x);
  const tMap = new Map<string, TestimonyRef>();
  if (tIds.length) {
    const { data: ts } = await caller.admin.from("testimonies").select("id, title, category, status, created_at").in("id", tIds);
    for (const t of ts ?? []) tMap.set(t.id, testimonyRef(t));
  }

  const countOf = async (build: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => (await build(base())).count ?? 0;
  const base = () => {
    let b = caller.admin.from("import_jobs").select("id", { count: "exact", head: true });
    if (sp.get("batch")) b = b.eq("batch_id", sp.get("batch"));
    return b;
  };
  const counts = Object.fromEntries(await Promise.all(STATUSES.map(async (s) => [s, await countOf((b) => b.eq("status", s))] as const)));
  const needsReview = await countOf((b) => b.eq("status", "published").is("reviewed_at", null).neq("flags", "{}"));

  return apiJson({
    counts: { ...counts, needs_review: needsReview },
    jobs: page.map((j) => jobView(j, j.testimony_id ? tMap.get(j.testimony_id) ?? null : null)),
    next_cursor: rows.length > limit ? page[page.length - 1].created_at : null,
  });
}
