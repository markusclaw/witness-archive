import type { Testimony } from "@/lib/types";

export const SITE_NAME = "Witness Archive";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://witnessarchive.org").replace(/\/$/, "");
export const SITE_TAGLINE = "Testimonies of the Supernatural";
export const SITE_DESCRIPTION =
  "A curated archive of first-hand testimonies from people whose lives were changed by encounters with heaven, hell, healing, angels, and the divine — searchable, credited, and open to discussion.";
export const DEFAULT_OG_IMAGE = "/og-default.png";

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** URL-safe slug from a title: "Twenty Minutes in Heaven" -> "twenty-minutes-in-heaven". */
export function slugify(text: string, max = 70): string {
  const s = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, cut.lastIndexOf("-") > 20 ? cut.lastIndexOf("-") : max);
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Testimony URLs carry the title for search engines and humans while the
 * UUID at the end stays the source of truth: /testimony/twenty-minutes-in-heaven-<uuid>.
 * Old bare-UUID links keep working (the page redirects to the canonical form).
 */
export function testimonyPath(t: Pick<Testimony, "id" | "title">): string {
  const slug = slugify(t.title);
  return slug ? `/testimony/${slug}-${t.id}` : `/testimony/${t.id}`;
}

export function parseTestimonyParam(param: string): { id: string; slug: string } | null {
  const m = param.match(UUID_RE);
  if (!m) return null;
  const id = m[0].toLowerCase();
  const slug = param.slice(0, m.index).replace(/-$/, "");
  return { id, slug };
}

export function collectionPath(slug: string): string {
  return `/collections/${slug}`;
}

/** Trim to a search-snippet-friendly length at a word boundary. */
export function metaDescription(text: string, max = 158): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/** Path for a testimony in a display language. The original language has no prefix. */
export function localizedTestimonyPath(t: Pick<Testimony, "id" | "title" | "language">, lang: string): string {
  const base = testimonyPath(t);
  return lang === t.language ? base : `/${lang}${base}`;
}
