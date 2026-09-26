import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import CategoryChip from "@/components/CategoryChip";
import Comments from "@/components/Comments";
import OwnerBar from "@/components/OwnerBar";
import SeriesNav from "@/components/SeriesNav";
import ShareButton from "@/components/ShareButton";
import TestimonyBody from "@/components/TestimonyBody";
import TestimonyCard from "@/components/TestimonyCard";
import VideoEmbed from "@/components/VideoEmbed";
import { slugForCategoryName } from "@/lib/categories";
import { catalogNumber, formatDate, readingTime, toParagraphs } from "@/lib/format";
import { getRelatedTestimonies, getSeriesParts, getTestimonyById } from "@/lib/queries";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL, absoluteUrl, collectionPath, metaDescription, parseTestimonyParam, testimonyPath } from "@/lib/seo";
import { extractYouTubeId, youtubeThumbnail, youtubeWatchUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id: param } = await params;
  const parsed = parseTestimonyParam(param);
  const t = parsed ? await getTestimonyById(parsed.id) : null;
  if (!t) return { title: "Testimony not found", robots: { index: false } };

  const canonical = testimonyPath(t);
  const image = youtubeThumbnail(t.video_url, "maxres") ?? absoluteUrl(DEFAULT_OG_IMAGE);
  const author = t.is_anonymous ? "Anonymous" : t.creator;
  const title = t.part_number > 1 ? `${t.title} (Part ${t.part_number})` : t.title;
  const description = metaDescription(`${t.description} A first-hand ${t.category.toLowerCase()} testimony by ${author}.`);

  return {
    title,
    description,
    alternates: { canonical },
    authors: [{ name: author }],
    category: t.category,
    openGraph: {
      type: "article",
      title: `${title} · ${SITE_NAME}`,
      description,
      url: absoluteUrl(canonical),
      publishedTime: t.created_at,
      modifiedTime: t.updated_at,
      authors: [author],
      section: t.category,
      tags: [t.category, "testimony", "supernatural"],
      images: [{ url: image, width: 1280, height: 720, alt: t.title }],
    },
    twitter: { card: "summary_large_image", title: `${title} · ${SITE_NAME}`, description, images: [image] },
  };
}

export default async function TestimonyPage({ params }: { params: Params }) {
  const { id: param } = await params;
  const parsed = parseTestimonyParam(param);
  if (!parsed) notFound();

  const testimony = await getTestimonyById(parsed.id);
  if (!testimony) notFound();

  // One canonical URL per testimony: the slugged form. Old bare-UUID and stale-slug links 301 to it.
  const canonicalPath = testimonyPath(testimony);
  if (`/testimony/${param}` !== canonicalPath) permanentRedirect(canonicalPath);

  const [related, parts] = await Promise.all([
    getRelatedTestimonies(testimony.category, testimony.series_id, 3),
    getSeriesParts(testimony.series_id),
  ]);
  const paragraphs = toParagraphs(testimony.content);
  const watchUrl = youtubeWatchUrl(testimony.video_url);
  const videoId = extractYouTubeId(testimony.video_url);
  const minutes = readingTime(testimony.content);
  const author = testimony.is_anonymous ? "Anonymous" : testimony.creator;
  const url = absoluteUrl(canonicalPath);
  const image = youtubeThumbnail(testimony.video_url, "maxres") ?? absoluteUrl(DEFAULT_OG_IMAGE);
  const wordCount = testimony.content ? testimony.content.trim().split(/\s+/).length : 0;
  const idx = parts.findIndex((p) => p.id === testimony.id);
  const prev = idx > 0 ? parts[idx - 1] : null;
  const next = idx >= 0 && idx < parts.length - 1 ? parts[idx + 1] : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        mainEntityOfPage: url,
        url,
        headline: testimony.title,
        description: testimony.description,
        image: [image],
        datePublished: testimony.created_at,
        dateModified: testimony.updated_at,
        author: { "@type": "Person", name: author },
        publisher: { "@id": `${SITE_URL}/#organization` },
        isPartOf: { "@id": `${SITE_URL}/#website` },
        articleSection: testimony.category,
        keywords: [testimony.category, "testimony", "first-hand account", "supernatural experience"].join(", "),
        inLanguage: "en",
        isAccessibleForFree: true,
        ...(wordCount ? { wordCount } : {}),
        ...(testimony.content ? { articleBody: testimony.content } : {}),
        ...(parts.length > 1
          ? {
              isPartOf: [{ "@id": `${SITE_URL}/#website` }, { "@type": "CreativeWorkSeries", name: parts[0].title, url: absoluteUrl(testimonyPath(parts[0])) }],
              position: testimony.part_number,
            }
          : {}),
        ...(videoId
          ? {
              video: {
                "@type": "VideoObject",
                name: testimony.title,
                description: testimony.description,
                thumbnailUrl: [`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`],
                uploadDate: testimony.created_at,
                embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
                contentUrl: watchUrl,
              },
            }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Archive", item: absoluteUrl("/archive") },
          { "@type": "ListItem", position: 2, name: testimony.category, item: absoluteUrl(collectionPath(slugForCategoryName(testimony.category))) },
          { "@type": "ListItem", position: 3, name: testimony.title, item: url },
        ],
      },
    ],
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {prev && <link rel="prev" href={absoluteUrl(testimonyPath(prev))} />}
      {next && <link rel="next" href={absoluteUrl(testimonyPath(next))} />}

      <article className="mx-auto max-w-3xl px-5 pt-12" itemScope itemType="https://schema.org/Article">
        <OwnerBar id={testimony.id} authorId={testimony.author_id} />
        <nav aria-label="Breadcrumb" className="mb-8 text-xs text-parchment-700">
          <Link href="/archive" className="hover:text-gold-300">Archive</Link>
          <span className="mx-2">/</span>
          <Link href={collectionPath(slugForCategoryName(testimony.category))} className="hover:text-gold-300">{testimony.category}</Link>
        </nav>

        <header>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <CategoryChip name={testimony.category} />
            {parts.length > 1 && <span className="chip">Part {testimony.part_number} of {parts.length}</span>}
            <span className="text-[0.65rem] tracking-[0.2em] text-parchment-700">{catalogNumber(testimony.id)}</span>
          </div>
          <h1 className="font-display text-4xl font-light leading-tight text-parchment-50 sm:text-5xl" itemProp="headline">
            {testimony.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-parchment-300" itemProp="description">{testimony.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-parchment-500">
            <span itemProp="author" itemScope itemType="https://schema.org/Person">
              Shared by <span className="text-parchment-100" itemProp="name">{author}</span>
            </span>
            {testimony.experienced_on && (
              <>
                <span aria-hidden>·</span>
                <span>Happened {formatDate(testimony.experienced_on + "T12:00:00")}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <time dateTime={testimony.created_at} itemProp="datePublished">Added {formatDate(testimony.created_at)}</time>
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
          <div itemProp="articleBody">
            <TestimonyBody paragraphs={paragraphs} title={testimony.title} />
          </div>
        ) : (
          !testimony.video_url && <p className="text-parchment-500">A written account for this testimony has not been added yet.</p>
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
          <h2 id="comments-heading" className="font-display mb-8 text-3xl text-parchment-50">Conversation</h2>
          <Comments testimonyId={testimony.id} />
        </section>
      </article>

      {related.length > 0 && (
        <section className="mx-auto mt-24 max-w-6xl px-5">
          <p className="eyebrow mb-3">More from this collection</p>
          <h2 className="font-display mb-8 text-3xl text-parchment-50">
            <Link href={collectionPath(slugForCategoryName(testimony.category))} className="hover:text-gold-300">
              More {testimony.category.toLowerCase()} testimonies
            </Link>
          </h2>
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
