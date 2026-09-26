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

/** "Greg Anthony" -> "GA", "greganthony" -> "G". */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic hue from a string so initials avatars are stable per person. */
export function hueFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}
