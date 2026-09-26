import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CategoryChip from "@/components/CategoryChip";
import Comments from "@/components/Comments";
import ShareButton from "@/components/ShareButton";
import TestimonyCard from "@/components/TestimonyCard";
import VideoEmbed from "@/components/VideoEmbed";
import { catalogNumber, formatDate, readingTime, toParagraphs } from "@/lib/format";
import { getRelatedTestimonies, getSeriesParts, getTestimonyById } from "@/lib/queries";
import SeriesNav from "@/components/SeriesNav";
import TestimonyBody from "@/components/TestimonyBody";
import OwnerBar from "@/components/OwnerBar";
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

  const [related, parts] = await Promise.all([
    getRelatedTestimonies(testimony.category, testimony.series_id, 3),
    getSeriesParts(testimony.series_id),
  ]);
  const paragraphs = toParagraphs(testimony.content);
  const watchUrl = youtubeWatchUrl(testimony.video_url);
  const minutes = readingTime(testimony.content);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: testimony.title,
    description: testimony.description,
    datePublished: testimony.created_at,
    author: { "@type": "Person", name: testimony.is_anonymous ? "Anonymous" : testimony.creator },
    ...(parts.length > 1 ? { isPartOf: { "@type": "CreativeWorkSeries", name: parts[0].title }, position: testimony.part_number } : {}),
    articleSection: testimony.category,
    ...(watchUrl ? { video: { "@type": "VideoObject", name: testimony.title, url: watchUrl } } : {}),
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="mx-auto max-w-3xl px-5 pt-12">
        <OwnerBar id={testimony.id} authorId={testimony.author_id} />
        <nav aria-label="Breadcrumb" className="mb-8 text-xs text-parchment-700">
          <Link href="/archive" className="hover:text-gold-300">Archive</Link>
          <span className="mx-2">/</span>
          <span>{testimony.category}</span>
        </nav>

        <header>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <CategoryChip name={testimony.category} />
            {parts.length > 1 && <span className="chip">Part {testimony.part_number} of {parts.length}</span>}
            <span className="text-[0.65rem] tracking-[0.2em] text-parchment-700">{catalogNumber(testimony.id)}</span>
          </div>
          <h1 className="font-display text-4xl font-light leading-tight text-parchment-50 sm:text-5xl">
            {testimony.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-parchment-300">{testimony.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-parchment-500">
            <span>
              Shared by <span className="text-parchment-100">{testimony.is_anonymous ? "Anonymous" : testimony.creator}</span>
            </span>
            {testimony.experienced_on && (
              <>
                <span aria-hidden>·</span>
                <span>Happened {formatDate(testimony.experienced_on + "T12:00:00")}</span>
              </>
            )}
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

        <SeriesNav parts={parts} currentId={testimony.id} position="top" />

        {testimony.video_url && (
          <section aria-label="Video" className="mb-12">
            <VideoEmbed url={testimony.video_url} title={testimony.title} />
            {watchUrl && (
              <p className="mt-3 text-xs text-parchment-700">
                Video by {testimony.is_anonymous ? "the author" : testimony.creator}.{" "}
                <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-gold-300">
                  Watch on YouTube
                </a>
              </p>
            )}
          </section>
        )}

        {paragraphs.length > 0 ? (
          <TestimonyBody paragraphs={paragraphs} title={testimony.title} />
        ) : (
          !testimony.video_url && (
            <p className="text-parchment-500">A written account for this testimony has not been added yet.</p>
          )
        )}

        {!testimony.is_anonymous && testimony.author_bio && (
          <aside className="mt-10 rounded-xl border border-ink-600 bg-ink-900/60 p-5">
            <p className="eyebrow mb-1">About {testimony.creator}</p>
            <p className="text-sm text-parchment-300">{linkify(testimony.author_bio)}</p>
          </aside>
        )}

        <SeriesNav parts={parts} currentId={testimony.id} position="bottom" />

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

/** Turn bare URLs in a short bio into links; everything else stays plain text. */
function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="text-gold-400 underline hover:text-gold-300">
        {part.replace(/^https?:\/\//, "")}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
