/**
 * Auth for /api/v1/*: either a personal API token ("wa_…", minted with
 * scripts/api-token.mjs) or a signed-in member's Supabase session token.
 * A session only counts for site admins or a member who owns an active API
 * token — that keeps the import tools to the team.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase-server";

export interface ApiCaller {
  userId: string;
  via: "token" | "session";
  admin: SupabaseClient;
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function authenticate(req: Request): Promise<ApiCaller | NextResponse> {
  const admin = createAdminSupabase();
  if (!admin) return apiError(503, "not_configured", "The server is missing its Supabase service key.");
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : (req.headers.get("x-api-key") ?? "").trim();
  if (!token) return apiError(401, "unauthorized", "Send an API token: Authorization: Bearer wa_…");

  if (token.startsWith("wa_")) {
    const { data } = await admin.from("api_tokens").select("id, user_id, revoked_at, last_used_at").eq("token_hash", await sha256Hex(token)).maybeSingle();
    if (!data || data.revoked_at) return apiError(401, "unauthorized", "This API token is not valid.");
    // Touch last_used_at at most once a minute.
    if (!data.last_used_at || Date.now() - new Date(data.last_used_at).getTime() > 60_000) {
      await admin.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
    }
    return { userId: data.user_id as string, via: "token", admin };
  }

  const {
    data: { user },
  } = await createServerSupabase().auth.getUser(token);
  if (!user) return apiError(401, "unauthorized", "Your session has expired. Sign in again.");
  const [{ count }, { data: profile }] = await Promise.all([
    admin.from("api_tokens").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("revoked_at", null),
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  if (!count && profile?.role !== "admin") return apiError(403, "forbidden", "This account doesn't have import access.");
  return { userId: user.id, via: "session", admin };
}

export function apiError(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status, headers: { "cache-control": "no-store" } });
}

export function apiJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}
