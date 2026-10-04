import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { TESTIMONY_COLUMNS } from "@/lib/queries";
import { syncScriptureIndex } from "@/lib/scripture-index";
import type { Testimony } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/scripture/reindex[?after=<created_at>]
 * Rebuilds the scripture index for up to 20 published testimonies per call,
 * oldest first; follow `next` until it is null. Idempotent and read-mostly,
 * so it needs no key. Normal operation doesn't need this at all — a
 * testimony is indexed the first time it is viewed — it's for the one-time
 * backfill right after migration 023.
 */
export async function GET(request: Request) {
  const after = new URL(request.url).searchParams.get("after");
  let q = createServerSupabase().from("testimonies").select(TESTIMONY_COLUMNS).eq("status", "published").order("created_at", { ascending: true }).limit(20);
  if (after) q = q.gt("created_at", after);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const batch = (data ?? []) as Testimony[];
  for (const t of batch) await syncScriptureIndex(t);
  const next = batch.length === 20 ? batch[batch.length - 1].created_at : null;
  return NextResponse.json({ indexed: batch.length, next, next_url: next ? `/api/scripture/reindex?after=${encodeURIComponent(next)}` : null }, { headers: { "cache-control": "no-store" } });
}
