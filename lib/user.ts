import type { User } from "@supabase/supabase-js";

/**
 * Public-facing name for a user. Never falls back to the full email address,
 * which would leak it on every comment.
 */
export function displayNameFor(user: User | null | undefined): string {
  if (!user) return "Anonymous";
  const meta = (user.user_metadata ?? {}) as { display_name?: string; full_name?: string; name?: string };
  const fromMeta = meta.display_name || meta.full_name || meta.name;
  if (fromMeta && fromMeta.trim()) return fromMeta.trim();
  const local = user.email?.split("@")[0] ?? "member";
  return local.length > 2 ? local : "member";
}
