import type { Metadata } from "next";
import ArchiveBrowser from "@/components/ArchiveBrowser";
import { categoryBySlug } from "@/lib/categories";
import { getAllTestimonies } from "@/lib/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ category?: string; q?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { category } = await searchParams;
  const cat = categoryBySlug(category);
  return {
    title: cat ? `${cat.name} testimonies` : "Archive",
    description: cat
      ? cat.blurb
      : "Browse every testimony in the Witness Archive — heaven, hell, healing, angelic and divine encounters.",
  };
}

export default async function ArchivePage({ searchParams }: { searchParams: SearchParams }) {
  const { category, q } = await searchParams;
  const testimonies = await getAllTestimonies();
  const cat = categoryBySlug(category);

  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">{cat ? "Collection" : "The archive"}</p>
        <h1 className="font-display text-4xl text-parchment-50 sm:text-5xl">
          {cat ? cat.name : "Every testimony"}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-parchment-500">
          {cat
            ? cat.blurb
            : "Search by title, name, or keyword, or narrow the archive to a single kind of encounter."}
        </p>
      </div>

      <ArchiveBrowser testimonies={testimonies} initialCategory={cat?.slug ?? ""} initialQuery={q ?? ""} />
    </main>
  );
}
