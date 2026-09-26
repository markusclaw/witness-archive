import type { Metadata } from "next";
import AskPanel from "@/components/AskPanel";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `${q.slice(0, 80)} — Ask the archive` : "Ask the archive",
    description: "Ask a question and get an answer drawn only from the testimonies in the archive, with every claim linked to its source.",
    robots: { index: false, follow: true },
    alternates: { canonical: "/ask" },
  };
}

export default async function AskPage({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <AskPanel initialQuestion={(q ?? "").trim()} />
    </main>
  );
}
