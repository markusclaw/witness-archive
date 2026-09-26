import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CategoryChip from "@/components/CategoryChip";
import Comments from "@/components/Comments";
import ShareButton from "@/components/ShareButton";
import TestimonyCard from "@/components/TestimonyCard";
import VideoEmbed from "@/components/VideoEmbed";
import { catalogNumber, formatDate, readingTime, toParagraphs } from "@/lib/format";
import { getRelatedTestimonies, getTestimonyById } from "@/lib/queries";
import { youtubeThumbnail, youtubeWatchUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const t = await getTestimonyById(id);
  if (!t) return { title: "Testimony not found" };
  const image = youtubeThumbnail(t.video_url, "maxres");
  return {
    title: t.title,
    description: t.description,
    openGraph: {
      type: "article",
      title: t.title,
      description: t.description,
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function TestimonyPage({ params }: { params: Params }) {
  const { id } = await params;
  const testimony = await getTestimonyById(id);
  if (!testimony) notFound();

  const related = await getRelatedTestimonies(testimony.category, testimony.id, 3);
  const paragraphs = toParagraphs(testimony.content);
  const watchUrl = youtubeWatchUrl(testimony.video_url);
  const minutes = readingTime(testimony.content);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: testimony.title,
    description: testimony.description,
    datePublished: testimony.created_at,
    author: { "@type": "Person", name: testimony.creator },
    articleSection: testimony.category,
    ...(watchUrl ? { video: { "@type": "VideoObject", name: testimony.title, url: watchUrl } } : {}),
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="mx-auto max-w-3xl px-5 pt-12">
        <nav aria-label="Breadcrumb" className="mb-8 text-xs text-parchment-700">
          <Link href="/archive" className="hover:text-gold-300">Archive</Link>
          <span className="mx-2">/</span>
          <span>{testimony.category}</span>
        </nav>

        <header>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <CategoryChip name={testimony.category} />
            <span className="text-[0.65rem] tracking-[0.2em] text-parchment-700">{catalogNumber(testimony.id)}</span>
          </div>
          <h1 className="font-display text-4xl font-light leading-tight text-parchment-50 sm:text-5xl">
            {testimony.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-parchment-300">{testimony.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-parchment-500">
            <span>
              Shared by <span className="text-parchment-100">{testimony.creator}</span>
            </span>
            <span aria-hidden>·</span>
            <time dateTime={testimony.created_at}>Added {formatDate(testimony.created_at)}</time>
            {minutes && (
              <>
                <span aria-hidden>·</span>
                <span>{minutes}</span>
              </>
            )}
            <span className="ml-auto">
              <ShareButton title={testimony.title} />
            </span>
          </div>
        </header>

        <div className="hairline my-10" />

        {testimony.video_url && (
          <section aria-label="Video" className="mb-12">
            <VideoEmbed url={testimony.video_url} title={testimony.title} />
            {watchUrl && (
              <p className="mt-3 text-xs text-parchment-700">
                Video by {testimony.creator}.{" "}
                <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-gold-300">
                  Watch on YouTube
                </a>
              </p>
            )}
          </section>
        )}

        {paragraphs.length > 0 ? (
          <section aria-label="Written account" className="prose-testimony">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        ) : (
          !testimony.video_url && (
            <p className="text-parchment-500">A written account for this testimony has not been added yet.</p>
          )
        )}

        <div className="hairline my-14" />

        <section aria-labelledby="comments-heading">
          <p className="eyebrow mb-3">Responses</p>
          <h2 id="comments-heading" className="font-display mb-8 text-3xl text-parchment-50">
            Conversation
          </h2>
          <Comments testimonyId={testimony.id} />
        </section>
      </article>

      {related.length > 0 && (
        <section className="mx-auto mt-24 max-w-6xl px-5">
          <p className="eyebrow mb-3">More from this collection</p>
          <h2 className="font-display mb-8 text-3xl text-parchment-50">Related testimonies</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((t) => (
              <TestimonyCard key={t.id} testimony={t} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
