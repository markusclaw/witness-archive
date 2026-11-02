import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TestimonyCard from "@/components/TestimonyCard";
import CrisisNote from "@/components/CrisisNote";
import { QUESTIONS, questionBySlug, questionPath, scriptureHref } from "@/lib/questions";
import { getQuestionSummary, getTestimoniesForQuestion } from "@/lib/question-queries";
import { DEFAULT_OG_IMAGE, SITE_NAME, absoluteUrl, testimonyPath } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const q = questionBySlug(slug);
  if (!q) return { title: "Question not found", robots: { index: false } };
  const description = `${q.intro.split(". ")[0]}. First-hand testimonies on ${SITE_NAME}.`.slice(0, 300);
  return {
    title: `${q.q} Testimonies from people who lived it`,
    description,
    alternates: { canonical: questionPath(q.slug) },
    openGraph: { type: "article", title: `${q.q} · ${SITE_NAME}`, description, url: absoluteUrl(questionPath(q.slug)), images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: `${q.q} · ${SITE_NAME}`, description },
  };
}

export default async function QuestionPage({ params }: { params: Params }) {
  const { slug } = await params;
  const q = questionBySlug(slug);
  if (!q) notFound();

  const [items, summary] = await Promise.all([getTestimoniesForQuestion(q.slug), q.sensitive ? Promise.resolve(null) : getQuestionSummary(q.slug)]);
  const byId = new Map(items.map((t) => [t.id, t]));
  const patterns = (summary?.patterns ?? []).map((p) => ({ ...p, sources: p.testimony_ids.map((id) => byId.get(id)).filter((t): t is NonNullable<typeof t> => !!t) }));
  const others = QUESTIONS.filter((o) => o.slug !== q.slug);
  const url = absoluteUrl(questionPath(q.slug));

  const answerText = [q.intro, ...patterns.map((p) => p.text)].join(" ");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        url,
        mainEntity: [{ "@type": "Question", name: q.q, acceptedAnswer: { "@type": "Answer", text: answerText, url } }],
      },
      {
        "@type": "ItemList",
        name: `Testimonies on: ${q.q}`,
        numberOfItems: items.length,
        itemListElement: items.slice(0, 50).map((t, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(testimonyPath(t)), name: t.title })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Questions", item: absoluteUrl("/questions") },
          { "@type": "ListItem", position: 2, name: q.q, item: url },
        ],
      },
    ],
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="mb-8 text-xs text-parchment-700">
        <Link href="/questions" className="hover:text-gold-300">Questions</Link>
        <span className="mx-2">/</span>
        <span>{q.short}</span>
      </nav>

      <div className="max-w-3xl">
        {q.sensitive && (
          <div className="mb-10">
            <CrisisNote variant="page" />
          </div>
        )}
        <p className="eyebrow mb-3">A question, answered by witnesses</p>
        <h1 className="font-display text-4xl leading-tight text-parchment-50 sm:text-5xl">{q.q}</h1>
        <p className="mt-5 text-lg leading-relaxed text-parchment-300">{q.intro}</p>
        <p className="mt-3 text-sm text-parchment-700">
          {items.length} {items.length === 1 ? "testimony" : "testimonies"} in the archive speak to this question.
        </p>
      </div>

      {patterns.length > 0 && (
        <section aria-labelledby="patterns" className="mt-14 max-w-3xl">
          <p className="eyebrow mb-3">What witnesses report</p>
          <h2 id="patterns" className="font-display mb-6 text-3xl text-parchment-50">Across {summary!.testimony_count} accounts</h2>
          <ul className="space-y-5">
            {patterns.map((p, i) => (
              <li key={i} className="border-l border-gold-500/40 pl-5">
                <p className="leading-relaxed text-parchment-200">{p.text}</p>
                {p.sources.length > 0 && (
                  <p className="mt-2 text-xs text-parchment-700">
                    {p.sources.slice(0, 4).map((t, j) => (
                      <span key={t.id}>
                        {j > 0 && " · "}
                        <Link href={testimonyPath(t)} className="hover:text-gold-300">{t.title}</Link>
                      </span>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs text-parchment-700">A summary of what the testimonies below say, written with an AI assistant from their text. It reports their claims; it does not verify them.</p>
        </section>
      )}

      {q.scripture.length > 0 && (
        <section aria-labelledby="scripture" className="mt-14 max-w-3xl">
          <p className="eyebrow mb-3">In scripture</p>
          <h2 id="scripture" className="sr-only">Related scripture</h2>
          <div className="flex flex-wrap gap-2">
            {q.scripture.map((r) => (
              <Link key={r.label} href={scriptureHref(r)} className="rounded-full border border-ink-600 px-3 py-1 text-sm text-parchment-300 transition hover:border-gold-500/40 hover:text-gold-300">
                {r.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="testimonies" className="mt-16">
        <p className="eyebrow mb-3">In their own words</p>
        <h2 id="testimonies" className="font-display mb-8 text-3xl text-parchment-50">The testimonies</h2>
        {items.length === 0 ? (
          <div className="card p-12 text-center text-parchment-500">
            No testimonies are linked to this question yet.{" "}
            <Link href="/submit" className="text-gold-400 hover:text-gold-300">If this is your story, it belongs here.</Link>
          </div>
        ) : (
          <div className="feed grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <TestimonyCard key={t.id} testimony={t} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-20">
        <p className="eyebrow mb-4">Other questions</p>
        <div className="flex flex-wrap gap-2">
          {others.map((o) => (
            <Link key={o.slug} href={questionPath(o.slug)} className="rounded-full border border-ink-600 px-3 py-1 text-sm text-parchment-500 transition hover:border-gold-500/40 hover:text-parchment-100">
              {o.q}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
