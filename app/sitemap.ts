import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { getAllTestimonies } from "@/lib/queries";
import { absoluteUrl, collectionPath, localizedTestimonyPath, testimonyPath } from "@/lib/seo";
import { createServerSupabase } from "@/lib/supabase-server";
import { BOOKS, bookSlug } from "@/lib/scripture";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const testimonies = await getAllTestimonies();
  const latest = testimonies[0]?.updated_at ?? new Date().toISOString();

  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: latest, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/archive"), lastModified: latest, changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/ask"), changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/pray"), changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/bible"), changeFrequency: "yearly", priority: 0.6 },
  ];

  const bible: MetadataRoute.Sitemap = BOOKS.flatMap((b) => [
    { url: absoluteUrl(`/bible/${bookSlug(b)}`), changeFrequency: "yearly" as const, priority: 0.4 },
    ...Array.from({ length: b.chapters }, (_, i) => ({ url: absoluteUrl(`/bible/${bookSlug(b)}/${i + 1}`), changeFrequency: "yearly" as const, priority: 0.3 })),
  ]);

  const collections: MetadataRoute.Sitemap = CATEGORIES.map((c) => {
    const inCat = testimonies.filter((t) => t.category === c.name);
    return {
      url: absoluteUrl(collectionPath(c.slug)),
      lastModified: inCat[0]?.updated_at ?? latest,
      changeFrequency: "weekly",
      priority: inCat.length ? 0.8 : 0.3,
    };
  });

  // Cached translations get their own sitemap entries; hreflang alternates link every version.
  const { data: tr } = await createServerSupabase().from("testimony_translations").select("testimony_id, language, updated_at").eq("status", "ready");
  const byId = new Map<string, { language: string; updated_at: string }[]>();
  for (const r of tr ?? []) byId.set(r.testimony_id, [...(byId.get(r.testimony_id) ?? []), r]);

  const entries: MetadataRoute.Sitemap = [];
  for (const t of testimonies) {
    const langs = [t.language, ...(byId.get(t.id) ?? []).map((r) => r.language)];
    const alternates = { languages: Object.fromEntries(langs.map((l) => [l, absoluteUrl(localizedTestimonyPath(t, l))])) };
    entries.push({ url: absoluteUrl(testimonyPath(t)), lastModified: t.updated_at, changeFrequency: "monthly", priority: t.part_number === 1 ? 0.7 : 0.6, alternates });
    for (const r of byId.get(t.id) ?? []) {
      entries.push({ url: absoluteUrl(localizedTestimonyPath(t, r.language)), lastModified: r.updated_at, changeFrequency: "monthly", priority: 0.5, alternates });
    }
  }

  return [...staticPages, ...collections, ...entries, ...bible];
}
