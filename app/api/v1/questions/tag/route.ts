import { authenticate, apiError, apiJson } from "@/lib/import/auth";
import { tagQuestions } from "@/lib/ai/questions";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/questions/tag { "limit"?: 1–25 (default 10) }
 * Tags published testimonies that haven't been tagged yet with the questions
 * they speak to. Call repeatedly until "remaining" is 0.
 */
export async function POST(req: Request) {
  const caller = await authenticate(req);
  if (caller instanceof Response) return caller;
  if (!process.env.ANTHROPIC_API_KEY) return apiError(503, "not_configured", "ANTHROPIC_API_KEY is not set on the server.");
  const body = (await req.json().catch(() => ({}))) as { limit?: unknown };
  const limit = Math.min(25, Math.max(1, Number(body.limit) || 10));

  const { data, error } = await caller.admin
    .from("testimonies")
    .select("id, title, description, category, content")
    .eq("status", "published")
    .is("questions", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return apiError(500, "db_error", error.message.includes("questions") ? "Run migration 031 first." : error.message);

  const tagged: { id: string; title: string; questions: string[] | null; error?: string }[] = [];
  const rows = data ?? [];
  for (let i = 0; i < rows.length; i += 5) {
    await Promise.all(
      rows.slice(i, i + 5).map(async (t) => {
        try {
          const questions = await tagQuestions(t);
          await caller.admin.from("testimonies").update({ questions }).eq("id", t.id);
          tagged.push({ id: t.id, title: t.title, questions });
        } catch (err) {
          tagged.push({ id: t.id, title: t.title, questions: null, error: err instanceof Error ? err.message : "failed" });
        }
      }),
    );
  }
  const { count } = await caller.admin.from("testimonies").select("id", { count: "exact", head: true }).eq("status", "published").is("questions", null);
  return apiJson({ tagged, remaining: count ?? 0 });
}
