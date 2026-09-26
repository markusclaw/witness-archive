import { createServerSupabase } from "@/lib/supabase-server";
import type { Testimony } from "@/lib/types";

const TESTIMONY_COLUMNS = "id, title, description, video_url, creator, category, content, created_at";

export async function getAllTestimonies(): Promise<Testimony[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("testimonies")
    .select(TESTIMONY_COLUMNS)
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
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getRecentTestimonies:", error.message);
    return [];
  }
  return (data ?? []) as Testimony[];
}

export async function getTestimonyById(id: string): Promise<Testimony | null> {
  // Guard against garbage ids before hitting Postgres (avoids uuid cast errors in logs).
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("testimonies")
    .select(TESTIMONY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getTestimonyById:", error.message);
    return null;
  }
  return (data as Testimony) ?? null;
}

export async function getRelatedTestimonies(
  category: string,
  excludeId: string,
  limit = 3
): Promise<Testimony[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("testimonies")
    .select(TESTIMONY_COLUMNS)
    .eq("category", category)
    .neq("id", excludeId)
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
  const { data, error } = await supabase.from("testimonies").select("category");
  if (error) {
    console.error("getCategoryCounts:", error.message);
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.category] = (counts[row.category] ?? 0) + 1;
  }
  return counts;
}
