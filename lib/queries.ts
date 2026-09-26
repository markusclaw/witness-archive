import { createServerSupabase } from "@/lib/supabase-server";
import type { Testimony } from "@/lib/types";

export const TESTIMONY_COLUMNS =
  "id, title, description, video_url, creator, category, content, created_at, updated_at, author_id, is_anonymous, author_bio, experienced_on, series_id, part_number, status, language, experienced_precision, location_text, location_city, location_region, location_country, location_country_code, view_count";

// RLS already hides drafts from the anon server client; the explicit filter
// keeps intent obvious and protects against a policy change.
export async function getAllTestimonies(): Promise<Testimony[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("testimonies")
    .select(TESTIMONY_COLUMNS)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getAllTestimonies:", error.message);
    return [];
  }
  return (data ?? []) as Testimony[];
}

export async function getRecentTestimonies(limit = 3): Promise<Testimony[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("testimonies")
    .select(TESTIMONY_COLUMNS)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getRecentTestimonies:", error.message);
    return [];
  }
  return (data ?? []) as Testimony[];
}

export async function getTestimonyById(id: string): Promise<Testimony | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from("testimonies").select(TESTIMONY_COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    console.error("getTestimonyById:", error.message);
    return null;
  }
  return (data as Testimony) ?? null;
}

/** Every published part of a series, in order. */
export async function getSeriesParts(seriesId: string): Promise<Testimony[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("testimonies")
    .select(TESTIMONY_COLUMNS)
    .eq("series_id", seriesId)
    .eq("status", "published")
    .order("part_number", { ascending: true });
  if (error) {
    console.error("getSeriesParts:", error.message);
    return [];
  }
  return (data ?? []) as Testimony[];
}

export async function getRelatedTestimonies(category: string, excludeSeriesId: string, limit = 3): Promise<Testimony[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("testimonies")
    .select(TESTIMONY_COLUMNS)
    .eq("category", category)
    .eq("status", "published")
    .eq("part_number", 1)
    .neq("series_id", excludeSeriesId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getRelatedTestimonies:", error.message);
    return [];
  }
  return (data ?? []) as Testimony[];
}

export async function getCategoryCounts(): Promise<Record<string, number>> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from("testimonies").select("category").eq("status", "published");
  if (error) {
    console.error("getCategoryCounts:", error.message);
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.category] = (counts[row.category] ?? 0) + 1;
  return counts;
}

/** Server-side: public profile for an author (null if anonymous / missing). */
export async function getProfile(userId: string | null): Promise<import("@/lib/types").Profile | null> {
  if (!userId) return null;
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) {
    console.error("getProfile:", error.message);
    return null;
  }
  return (data as import("@/lib/types").Profile | null) ?? null;
}

/** Published testimonies by one author, newest first. */
export async function getTestimoniesByAuthor(authorId: string): Promise<Testimony[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("testimonies")
    .select(TESTIMONY_COLUMNS)
    .eq("author_id", authorId)
    .eq("status", "published")
    .eq("is_anonymous", false)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getTestimoniesByAuthor:", error.message);
    return [];
  }
  return (data ?? []) as Testimony[];
}

export async function getFollowerCount(userId: string): Promise<number> {
  const supabase = createServerSupabase();
  const { count } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("followee_id", userId);
  return count ?? 0;
}

/** Most-viewed testimonies over the last N days (from the daily table), with a fallback to all-time. */
export async function getTrending(days = 7, limit = 3): Promise<Testimony[]> {
  const supabase = createServerSupabase();
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data: rows } = await supabase.from("testimony_views_daily").select("testimony_id, views").gte("day", since);
  const totals = new Map<string, number>();
  for (const r of rows ?? []) totals.set(r.testimony_id, (totals.get(r.testimony_id) ?? 0) + (r.views as number));
  const ids = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  if (ids.length === 0) return [];
  const { data } = await supabase.from("testimonies").select(TESTIMONY_COLUMNS).in("id", ids).eq("status", "published");
  const byId = new Map((data ?? []).map((t) => [t.id, t as Testimony]));
  return ids.map((id) => byId.get(id)).filter((t): t is Testimony => !!t);
}
