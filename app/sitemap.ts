import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { getAllTestimonies } from "@/lib/queries";
import { absoluteUrl, collectionPath, testimonyPath } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const testimonies = await getAllTestimonies();
  const latest = testimonies[0]?.updated_at ?? new Date().toISOString();

  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: latest, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/archive"), lastModified: latest, changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.5 },
  ];

  const collections: MetadataRoute.Sitemap = CATEGORIES.map((c) => {
    const inCat = testimonies.filter((t) => t.category === c.name);
    return {
      url: absoluteUrl(collectionPath(c.slug)),
      lastModified: inCat[0]?.updated_at ?? latest,
      changeFrequency: "weekly",
      priority: inCat.length ? 0.8 : 0.3,
    };
  });

  const entries: MetadataRoute.Sitemap = testimonies.map((t) => ({
    url: absoluteUrl(testimonyPath(t)),
    lastModified: t.updated_at,
    changeFrequency: "monthly",
    priority: t.part_number === 1 ? 0.7 : 0.6,
  }));

  return [...staticPages, ...collections, ...entries];
}
