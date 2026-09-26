import { createServerSupabase } from "@/lib/supabase-server";
import { TESTIMONY_COLUMNS } from "@/lib/queries";
import type { Testimony } from "@/lib/types";

export interface SearchHit {
  testimony: Testimony;
  rank: number;
  headline: string;
}

/**
 * Ranked full-text search (migration 009). Falls back to a simple ILIKE scan
 * if the function isn't installed yet, so search never hard-fails.
 */
export async function searchTestimonies(q: string, limit = 8): Promise<SearchHit[]> {
  const supabase = createServerSupabase();
  const query = q.trim().slice(0, 200);
  if (!query) return [];

  const { data: ranked, error } = await supabase.rpc("search_testimonies", { q: query, lim: limit });
  if (!error && Array.isArray(ranked) && ranked.length > 0) {
    const ids = ranked.map((r: { id: string }) => r.id);
    const { data: rows } = await supabase.from("testimonies").select(TESTIMONY_COLUMNS).in("id", ids).eq("status", "published");
    const byId = new Map((rows ?? []).map((t) => [t.id, t as Testimony]));
    return ranked
      .map((r: { id: string; rank: number; headline: string }) => {
        const t = byId.get(r.id);
        return t ? { testimony: t, rank: r.rank, headline: r.headline ?? "" } : null;
      })
      .filter((h: SearchHit | null): h is SearchHit => !!h);
  }
  if (error) console.warn("search_testimonies unavailable, falling back:", error.message);

  // Fallback: keyword scan over title/description/content.
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 5);
  const { data } = await supabase.from("testimonies").select(TESTIMONY_COLUMNS).eq("status", "published").limit(200);
  const scored = ((data ?? []) as Testimony[])
    .map((t) => {
      const hay = `${t.title} ${t.description} ${t.creator} ${t.category} ${t.content ?? ""}`.toLowerCase();
      const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0) + (hay.includes(query.toLowerCase()) ? 3 : 0);
      return { t, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map(({ t, score }) => ({ testimony: t, rank: score, headline: excerptAround(t.content ?? t.description, words[0] ?? "") }));
}

function excerptAround(text: string, word: string, span = 220): string {
  const i = word ? text.toLowerCase().indexOf(word) : -1;
  if (i < 0) return text.slice(0, span);
  const start = Math.max(0, i - span / 2);
  return `${start > 0 ? "…" : ""}${text.slice(start, start + span)}…`;
}
