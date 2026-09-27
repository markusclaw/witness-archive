import { NextResponse } from "next/server";
import { createServerSupabase, createUserSupabase } from "@/lib/supabase-server";
import { testimonyPath } from "@/lib/seo";

export const dynamic = "force-dynamic";

export type DuplicateReason = "same_video" | "same_text" | "same_witness" | "same_witness_other_category";

export interface DuplicateMatch {
  id: string;
  title: string;
  path: string;
  witness_name: string | null;
  creator: string;
  is_anonymous: boolean;
  category: string;
  created_at: string;
  reasons: DuplicateReason[];
  score: number;
}

/** POST { videoUrl, content, witnessName, category, excludeId } -> { matches } */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

  let body: { videoUrl?: unknown; content?: unknown; witnessName?: unknown; category?: unknown; excludeId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const videoUrl = s(body.videoUrl, 300);
  const content = s(body.content, 4000);
  const witnessName = s(body.witnessName, 80);
  const category = s(body.category, 60);
  const excludeId = typeof body.excludeId === "string" && /^[0-9a-f-]{36}$/i.test(body.excludeId) ? body.excludeId : null;
  if (!videoUrl && content.trim().length < 200 && !witnessName.trim()) return NextResponse.json({ matches: [] });

  // Run as the caller so RLS applies exactly as it would in the browser.
  const asUser = createUserSupabase(token);
  const { data, error } = await asUser.rpc("find_possible_duplicates", {
    p_video_url: videoUrl || null,
    p_content: content || null,
    p_witness: witnessName || null,
    p_category: category || null,
    p_exclude: excludeId,
    lim: 5,
  });
  if (error) {
    console.warn("find_possible_duplicates:", error.message);
    return NextResponse.json({ matches: [] });
  }
  const matches: DuplicateMatch[] = (data ?? []).map((r: Omit<DuplicateMatch, "path">) => ({ ...r, path: testimonyPath({ id: r.id, title: r.title }) }));
  return NextResponse.json({ matches });
}
