import { createServerSupabase } from "@/lib/supabase-server";
import type { Testimony } from "@/lib/types";

export const TESTIMONY_COLUMNS =
  "id, title, description, video_url, creator, category, content, created_at, updated_at, author_id, is_anonymous, author_bio, experienced_on, series_id, part_number, status";

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
