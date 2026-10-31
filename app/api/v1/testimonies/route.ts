import { authenticate, apiError, apiJson } from "@/lib/import/auth";
import { absoluteUrl, testimonyPath } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/testimonies — paginated list.
 *   ?page=1&limit=50 (max 100)  ?category=Healing  ?youtube_id=…  ?since=<ISO date>  ?mine=true (your own, drafts included)
 * Newest first. Each item has the published URL and YouTube id.
 */
export async function GET(req: Request) {
  const caller = await authenticate(req);
  if (caller instanceof Response) return caller;
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 50));
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const mine = sp.get("mine") === "true";

  let q = caller.admin
    .from("testimonies")
    .select("id, title, category, status, language, witness_name, video_url, video_id, created_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  q = mine ? q.eq("author_id", caller.userId) : q.eq("status", "published");
  if (sp.get("category")) q = q.eq("category", sp.get("category"));
  if (sp.get("youtube_id")) q = q.eq("video_id", sp.get("youtube_id"));
  if (sp.get("since")) q = q.gte("created_at", sp.get("since"));
  const { data, error, count } = await q;
  if (error) return apiError(500, "db_error", error.message);

  const total = count ?? 0;
  return apiJson({
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    next_page: page * limit < total ? page + 1 : null,
    items: (data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      status: t.status,
      language: t.language,
      witness_name: t.witness_name,
      url: absoluteUrl(testimonyPath(t)),
      youtube_id: t.video_id,
      video_url: t.video_url,
      created_at: t.created_at,
      updated_at: t.updated_at,
    })),
  });
}
