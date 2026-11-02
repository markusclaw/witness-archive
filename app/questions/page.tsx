import type { Metadata } from "next";
import Link from "next/link";
import { QUESTIONS, questionPath } from "@/lib/questions";
import { getQuestionCounts } from "@/lib/question-queries";
import { DEFAULT_OG_IMAGE, SITE_NAME, absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const TITLE = "Life's hardest questions";
const DESCRIPTION = "What happens when we die? Is hell real? Does God still heal? First-hand testimonies from people who say they experienced the answer.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/questions" },
  openGraph: { type: "website", title: `${TITLE} · ${SITE_NAME}`, description: DESCRIPTION, url: absoluteUrl("/questions"), images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }] },
};

export default async function QuestionsIndex() {
  const counts = await getQuestionCounts();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl("/questions"),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: QUESTIONS.map((q, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(questionPath(q.slug)), name: q.q })),
    },
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="eyebrow mb-3">Questions</p>
      <h1 className="font-display text-4xl text-parchment-50 sm:text-5xl">Answers to life&apos;s hardest questions</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-parchment-500">
        From the people who lived them. Each question gathers the testimonies that speak to it — first-hand accounts, in the witnesses&apos; own words, alongside the scripture they point to.
      </p>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2">
        {QUESTIONS.map((q) => (
          <li key={q.slug}>
            <Link href={questionPath(q.slug)} className="card group flex h-full flex-col p-6">
              <h2 className="font-display text-xl text-parchment-50 group-hover:text-gold-300">{q.q}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-parchment-500">{q.intro}</p>
              <p className="mt-auto pt-4 text-xs text-parchment-700">
                {counts[q.slug] ?? 0} {(counts[q.slug] ?? 0) === 1 ? "testimony" : "testimonies"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
