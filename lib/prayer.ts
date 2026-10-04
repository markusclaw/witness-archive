import { createServerSupabase } from "@/lib/supabase-server";
import type { PrayerCategory, PrayerReply, PrayerRequest } from "@/lib/types";

export const PRAYER_CATEGORIES: { slug: PrayerCategory; name: string; blurb: string }[] = [
  { slug: "healing", name: "Healing", blurb: "Illness, injury, recovery." },
  { slug: "family", name: "Family", blurb: "Marriage, children, parents, reconciliation." },
  { slug: "provision", name: "Provision", blurb: "Work, housing, finances, daily needs." },
  { slug: "deliverance", name: "Deliverance", blurb: "Freedom from addiction, fear, oppression." },
  { slug: "grief", name: "Grief", blurb: "Loss, mourning, comfort." },
  { slug: "guidance", name: "Guidance", blurb: "Decisions, direction, open doors." },
  { slug: "salvation", name: "Salvation", blurb: "For someone to come to faith." },
  { slug: "thanksgiving", name: "Thanksgiving", blurb: "Gratitude, praise, answered prayers." },
  { slug: "other", name: "Other", blurb: "Anything else on your heart." },
];

export function prayerCategory(slug: string | null | undefined) {
  return PRAYER_CATEGORIES.find((c) => c.slug === slug) ?? PRAYER_CATEGORIES[PRAYER_CATEGORIES.length - 1];
}

/** How a request's author is shown. */
export function requesterName(r: Pick<PrayerRequest, "anonymous" | "display_name">): string {
  return r.anonymous || !r.display_name ? "Anonymous" : r.display_name;
}

export type WallSort = "newest" | "most-prayed" | "least-prayed";

export async function listPrayerRequests(opts: { category?: string; status?: "open" | "answered"; sort?: WallSort; limit?: number } = {}): Promise<PrayerRequest[]> {
  const supabase = createServerSupabase();
  let q = supabase.from("prayer_requests").select("*").eq("review", "clear");
  if (opts.category) q = q.eq("category", opts.category);
  if (opts.status) q = q.eq("status", opts.status);
  else q = q.neq("status", "closed");
  if (opts.sort === "most-prayed") q = q.order("prayed_count", { ascending: false }).order("created_at", { ascending: false });
  else if (opts.sort === "least-prayed") q = q.order("prayed_count", { ascending: true }).order("created_at", { ascending: false });
  else q = q.order("created_at", { ascending: false });
  const { data, error } = await q.limit(opts.limit ?? 60);
  if (error) {
    console.error("listPrayerRequests:", error.message);
    return [];
  }
  return (data ?? []) as PrayerRequest[];
}

export async function getPrayerRequest(id: string): Promise<PrayerRequest | null> {
  const { data, error } = await createServerSupabase().from("prayer_requests").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("getPrayerRequest:", error.message);
    return null;
  }
  return (data as PrayerRequest | null) ?? null;
}

export async function getPrayerReplies(requestId: string): Promise<PrayerReply[]> {
  const { data } = await createServerSupabase().from("prayer_replies").select("*").eq("request_id", requestId).eq("review", "clear").order("created_at", { ascending: true });
  return (data ?? []) as PrayerReply[];
}

export async function getPrayerCounts(): Promise<{ open: number; answered: number; prayed: number }> {
  const supabase = createServerSupabase();
  const [open, answered, prayed] = await Promise.all([
    supabase.from("prayer_requests").select("id", { count: "exact", head: true }).eq("review", "clear").eq("status", "open"),
    supabase.from("prayer_requests").select("id", { count: "exact", head: true }).eq("review", "clear").eq("status", "answered"),
    supabase.from("prayers").select("request_id", { count: "exact", head: true }),
  ]);
  return { open: open.count ?? 0, answered: answered.count ?? 0, prayed: prayed.count ?? 0 };
}
