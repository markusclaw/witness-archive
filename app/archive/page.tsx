import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ArchiveBrowser from "@/components/ArchiveBrowser";
import { categoryBySlug } from "@/lib/categories";
import { getAllTestimonies } from "@/lib/queries";
import { DEFAULT_OG_IMAGE, SITE_NAME, absoluteUrl, collectionPath } from "@/lib/seo";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ category?: string; q?: string }>;

const DESCRIPTION = `Browse every testimony in the ${SITE_NAME}: near-death experiences, visions of heaven and hell, healings, angelic and divine encounters. Search by keyword or filter by kind of encounter.`;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: "Archive — every testimony",
    description: DESCRIPTION,
    alternates: { canonical: "/archive" },
    // Search-result pages are useful to people, not to indexes.
    robots: q ? { index: false, follow: true } : undefined,
    openGraph: { type: "website", title: `The archive · ${SITE_NAME}`, description: DESCRIPTION, url: absoluteUrl("/archive"), images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }] },
  };
}

export default async function ArchivePage({ searchParams }: { searchParams: SearchParams }) {
  const { category, q } = await searchParams;
  const cat = categoryBySlug(category);

  // A category without a search term has a real page of its own now.
  if (cat && q === undefined) redirect(collectionPath(cat.slug));

  const testimonies = await getAllTestimonies();

  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">The archive</p>
        <h1 className="font-display text-4xl text-parchment-50 sm:text-5xl">Every testimony</h1>
        <p className="mt-4 text-lg leading-relaxed text-parchment-500">
          Search by title, name, or keyword, or narrow the archive to a single kind of encounter.
        </p>
      </div>

      <ArchiveBrowser testimonies={testimonies} initialCategory={cat?.slug ?? ""} initialQuery={q ?? ""} />
    </main>
  );
}
