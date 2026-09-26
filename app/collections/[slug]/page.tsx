import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TestimonyCard from "@/components/TestimonyCard";
import { CATEGORIES, categoryBySlug } from "@/lib/categories";
import { getAllTestimonies } from "@/lib/queries";
import { DEFAULT_OG_IMAGE, SITE_NAME, absoluteUrl, collectionPath, testimonyPath } from "@/lib/seo";
import { youtubeThumbnail } from "@/lib/youtube";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const cat = categoryBySlug(slug);
  if (!cat) return { title: "Collection not found", robots: { index: false } };
  const title = `${cat.name} testimonies`;
  const description = `${cat.blurb} First-hand ${cat.name.toLowerCase()} testimonies, credited and searchable, on ${SITE_NAME}.`;
  return {
    title,
    description,
    alternates: { canonical: collectionPath(slug) },
    openGraph: { type: "website", title: `${title} · ${SITE_NAME}`, description, url: absoluteUrl(collectionPath(slug)), images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: `${title} · ${SITE_NAME}`, description },
  };
}

export default async function CollectionPage({ params }: { params: Params }) {
  const { slug } = await params;
  const cat = categoryBySlug(slug);
  if (!cat) notFound();

  const all = await getAllTestimonies();
  const items = all.filter((t) => t.category === cat.name);
  const others = CATEGORIES.filter((c) => c.slug !== cat.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${cat.name} testimonies`,
    description: cat.blurb,
    url: absoluteUrl(collectionPath(cat.slug)),
    isPartOf: { "@id": `${absoluteUrl("/")}#website` },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Archive", item: absoluteUrl("/archive") },
        { "@type": "ListItem", position: 2, name: cat.name, item: absoluteUrl(collectionPath(cat.slug)) },
      ],
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.slice(0, 50).map((t, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absoluteUrl(testimonyPath(t)),
        name: t.title,
        ...(youtubeThumbnail(t.video_url) ? { image: youtubeThumbnail(t.video_url) } : {}),
      })),
    },
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="mb-8 text-xs text-parchment-700">
        <Link href="/archive" className="hover:text-gold-300">Archive</Link>
        <span className="mx-2">/</span>
        <span>{cat.name}</span>
      </nav>

      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">Collection</p>
        <h1 className="font-display text-4xl text-parchment-50 sm:text-5xl">{cat.name} testimonies</h1>
        <p className="mt-4 text-lg leading-relaxed text-parchment-500">{cat.blurb}</p>
        <p className="mt-3 text-sm text-parchment-700">
          {items.length} {items.length === 1 ? "testimony" : "testimonies"} ·{" "}
          <Link href={`/archive?category=${cat.slug}&q=`} className="text-gold-400 hover:text-gold-300">
            Search within this collection
          </Link>
        </p>
      </div>

      {items.length === 0 ? (
        <div className="card p-14 text-center">
          <p className="font-display text-2xl text-parchment-50">No {cat.name.toLowerCase()} testimonies yet.</p>
          <p className="mt-2 text-parchment-500">If this is your story, it would be the first.</p>
          <Link href="/submit" className="btn btn-primary mt-6">Write your testimony</Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t, i) => (
            <TestimonyCard key={t.id} testimony={t} priority={i < 3} />
          ))}
        </div>
      )}

      <section className="mt-20">
        <p className="eyebrow mb-4">Other collections</p>
        <div className="flex flex-wrap gap-2">
          {others.map((c) => (
            <Link key={c.slug} href={collectionPath(c.slug)} className="chip chip-interactive">{c.name}</Link>
          ))}
        </div>
      </section>
    </main>
  );
}
