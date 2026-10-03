import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for server-only work that RLS blocks for the anon key
 * (writing translation and audio caches). Never import this from a client
 * component; the key must stay on the server.
 */
export function createAdminSupabase(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
