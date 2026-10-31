import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticate, apiError, apiJson } from "@/lib/import/auth";
import { jobView, JOB_COLUMNS, testimonyRef, type ImportJobRow } from "@/lib/import/jobs";

export const dynamic = "force-dynamic";

async function load(admin: SupabaseClient, id: string) {
  const col = /^[0-9a-f-]{36}$/i.test(id) ? "id" : "youtube_id";
  const { data } = await admin.from("import_jobs").select(JOB_COLUMNS).eq(col, id).maybeSingle();
  if (!data) return null;
  const job = data as ImportJobRow;
  let t = null;
  if (job.testimony_id) {
    const { data: row } = await admin.from("testimonies").select("id, title, category, status, created_at").eq("id", job.testimony_id).maybeSingle();
    if (row) t = testimonyRef(row);
  }
  return jobView(job, t);
}

/** GET /api/v1/imports/<job id or YouTube id> */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const caller = await authenticate(req);
  if (caller instanceof Response) return caller;
  const { id } = await ctx.params;
  const job = await load(caller.admin, id);
  return job ? apiJson({ job }) : apiError(404, "not_found", "No import for that id.");
}

/** PATCH /api/v1/imports/<id> { "reviewed": true|false } — mark the review flags as handled. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const caller = await authenticate(req);
  if (caller instanceof Response) return caller;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { reviewed?: unknown };
  if (typeof body.reviewed !== "boolean") return apiError(400, "invalid", 'Send { "reviewed": true } or false.');
  const col = /^[0-9a-f-]{36}$/i.test(id) ? "id" : "youtube_id";
  const { error } = await caller.admin.from("import_jobs").update({ reviewed_at: body.reviewed ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq(col, id);
  if (error) return apiError(500, "db_error", error.message);
  const job = await load(caller.admin, id);
  return job ? apiJson({ job }) : apiError(404, "not_found", "No import for that id.");
}
