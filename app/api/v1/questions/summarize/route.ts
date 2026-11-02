import { authenticate, apiError, apiJson } from "@/lib/import/auth";
import { summarizeQuestion } from "@/lib/ai/questions";
import { QUESTIONS, questionBySlug } from "@/lib/questions";

export const dynamic = "force-dynamic";

const MAX_SOURCES = 30;

/**
 * POST /api/v1/questions/summarize { "slug"?: "is-hell-real", "force"?: false }
 * Writes "What witnesses report" for one question (or the next one whose
 * testimonies changed, when no slug is given). Sensitive questions are never
 * summarized. Returns the slug handled and which questions are still stale.
 */
export async function POST(req: Request) {
  const caller = await authenticate(req);
  if (caller instanceof Response) return caller;
  if (!process.env.ANTHROPIC_API_KEY) return apiError(503, "not_configured", "ANTHROPIC_API_KEY is not set on the server.");
  const body = (await req.json().catch(() => ({}))) as { slug?: unknown; force?: unknown };

  const candidates = QUESTIONS.filter((q) => !q.sensitive && (typeof body.slug !== "string" || q.slug === body.slug));
  if (typeof body.slug === "string" && !questionBySlug(body.slug)) return apiError(404, "not_found", "No such question.");

  const { data: existing } = await caller.admin.from("question_summaries").select("slug, source_ids");
  const have = new Map<string, string[]>((existing ?? []).map((r) => [r.slug as string, (r.source_ids as string[]) ?? []]));

  const stale: string[] = [];
  const sources = new Map<string, { id: string; title: string; description: string | null; content: string | null }[]>();
  for (const q of candidates) {
    const { data, error } = await caller.admin
      .from("testimonies")
      .select("id, title, description, content")
      .eq("status", "published")
      .contains("questions", [q.slug])
      .order("view_count", { ascending: false })
      .limit(MAX_SOURCES);
    if (error) return apiError(500, "db_error", error.message.includes("questions") ? "Run migration 031 first." : error.message);
    const items = data ?? [];
    if (items.length < 2) continue; // not enough to describe patterns yet
    sources.set(q.slug, items);
    const ids = items.map((t) => t.id).sort();
    const prev = [...(have.get(q.slug) ?? [])].sort();
    if (body.force === true || ids.join() !== prev.join()) stale.push(q.slug);
  }

  const slug = stale[0];
  if (!slug) return apiJson({ summarized: null, stale: [] });
  const q = questionBySlug(slug)!;
  const items = sources.get(slug)!;
  const patterns = await summarizeQuestion(q, items);
  const { error } = await caller.admin.from("question_summaries").upsert({
    slug,
    patterns,
    testimony_count: items.length,
    source_ids: items.map((t) => t.id),
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
    generated_at: new Date().toISOString(),
  });
  if (error) return apiError(500, "db_error", error.message);
  return apiJson({ summarized: slug, patterns: patterns.length, stale: stale.slice(1) });
}
