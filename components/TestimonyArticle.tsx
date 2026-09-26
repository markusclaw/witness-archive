import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import CategoryChip from "@/components/CategoryChip";
import Comments from "@/components/Comments";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import OwnerBar from "@/components/OwnerBar";
import SeriesNav from "@/components/SeriesNav";
import ShareButton from "@/components/ShareButton";
import TestimonyCard from "@/components/TestimonyCard";
import TranslatedContent from "@/components/TranslatedContent";
import VideoEmbed from "@/components/VideoEmbed";
import ViewPing from "@/components/ViewPing";
import FollowButton from "@/components/FollowButton";
import { slugForCategoryName } from "@/lib/categories";
import { catalogNumber, compactNumber, formatDate, formatExperienced, formatLocation, readingTime } from "@/lib/format";
import { LANGUAGES, languageByCode } from "@/lib/languages";
import { getProfile, getRelatedTestimonies, getSeriesParts, getTestimonyById } from "@/lib/queries";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL, absoluteUrl, collectionPath, localizedTestimonyPath, metaDescription, parseTestimonyParam, testimonyPath } from "@/lib/seo";
import { getTranslation } from "@/lib/translate";
import type { Translation } from "@/lib/types";
import { extractYouTubeId, youtubeThumbnail, youtubeWatchUrl } from "@/lib/youtube";


async function load(param: string, lang: string) {
  const parsed = parseTestimonyParam(param);
  if (!parsed) return null;
  const testimony = await getTestimonyById(parsed.id);
  if (!testimony) return null;
  const translation = lang !== testimony.language ? await getTranslation(testimony.id, lang) : null;
  return { testimony, translation, canonicalPath: testimonyPath(testimony) };
}

/* ---------------- metadata ---------------- */

export async function testimonyMetadata(param: string, lang: string): Promise<Metadata> {
  const data = await load(param, lang);
  if (!data) return { title: "Testimony not found", robots: { index: false } };
  const { testimony: t, translation } = data;
  const shown = translation ?? t;
  const author = t.is_anonymous ? "Anonymous" : t.creator;
  const image = youtubeThumbnail(t.video_url, "maxres") ?? absoluteUrl(DEFAULT_OG_IMAGE);
  const title = t.part_number > 1 ? `${shown.title} (Part ${t.part_number})` : shown.title;
  const description = metaDescription(`${shown.description} — ${t.category}, ${author}.`);
  const languages: Record<string, string> = {};
  for (const l of LANGUAGES) languages[l.code] = absoluteUrl(localizedTestimonyPath(t, l.code));
  languages["x-default"] = absoluteUrl(testimonyPath(t));
  const canonical = localizedTestimonyPath(t, lang);

  return {
    title,
    description,
    alternates: { canonical, languages },
    authors: [{ name: author }],
    category: t.category,
    // Machine translations are indexable but shouldn't outrank the original.
    robots: translation && translation.source === "machine" ? { index: true, follow: true } : undefined,
    openGraph: {
      type: "article",
      title: `${title} · ${SITE_NAME}`,
      description,
      url: absoluteUrl(canonical),
      locale: lang === "es" ? "es_ES" : lang === "pt" ? "pt_BR" : "en_US",
      publishedTime: t.created_at,
      modifiedTime: t.updated_at,
      authors: [author],
      section: t.category,
      images: [{ url: image, width: 1280, height: 720, alt: shown.title }],
    },
    twitter: { card: "summary_large_image", title: `${title} · ${SITE_NAME}`, description, images: [image] },
  };
}

/* ---------------- page ---------------- */

export default async function TestimonyArticle({ param, lang, prefixed = false }: { param: string; lang: string; prefixed?: boolean }) {
  const language = languageByCode(lang);
  if (!language) notFound();

  const data = await load(param, lang);
  if (!data) notFound();
  const { testimony, translation, canonicalPath } = data;

  // Canonical URL per (testimony, language). Old / stale links 308 to it.
  const expected = localizedTestimonyPath(testimony, lang);
  const actual = prefixed ? `/${lang}/testimony/${param}` : `/testimony/${param}`;
  if (actual !== expected) permanentRedirect(expected);

  const [related, parts, authorProfile] = await Promise.all([
    getRelatedTestimonies(testimony.category, testimony.series_id, 3),
    getSeriesParts(testimony.series_id),
    testimony.is_anonymous ? Promise.resolve(null) : getProfile(testimony.author_id),
  ]);

  const ui = language.ui;
  const isTranslated = lang !== testimony.language;
  const watchUrl = youtubeWatchUrl(testimony.video_url);
  const videoId = extractYouTubeId(testimony.video_url);
  const minutes = readingTime(testimony.content);
  const author = testimony.is_anonymous ? "Anonymous" : testimony.creator;
  const url = absoluteUrl(expected);
  const image = youtubeThumbnail(testimony.video_url, "maxres") ?? absoluteUrl(DEFAULT_OG_IMAGE);
  const wordCount = testimony.content ? testimony.content.trim().split(/\s+/).length : 0;
  const idx = parts.findIndex((p) => p.id === testimony.id);
  const prev = idx > 0 ? parts[idx - 1] : null;
  const next = idx >= 0 && idx < parts.length - 1 ? parts[idx + 1] : null;
  const shown: Pick<Translation, "title" | "description" | "content"> = translation ?? testimony;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        mainEntityOfPage: url,
        url,
        headline: shown.title,
        description: shown.description,
        image: [image],
        datePublished: testimony.created_at,
        dateModified: testimony.updated_at,
        author: { "@type": "Person", name: author },
        publisher: { "@id": `${SITE_URL}/#organization` },
        articleSection: testimony.category,
        keywords: [testimony.category, "testimony", "first-hand account", "supernatural experience"].join(", "),
        inLanguage: lang,
        isAccessibleForFree: true,
        ...(formatLocation(testimony)
          ? {
              contentLocation: {
                "@type": "Place",
                name: formatLocation(testimony),
                ...(testimony.location_country
                  ? { address: { "@type": "PostalAddress", addressLocality: testimony.location_city ?? undefined, addressRegion: testimony.location_region ?? undefined, addressCountry: testimony.location_country_code ?? testimony.location_country } }
                  : {}),
              },
            }
          : {}),
        ...(isTranslated ? { translationOfWork: { "@type": "Article", "@id": `${absoluteUrl(canonicalPath)}#article`, inLanguage: testimony.language } } : {}),
        ...(wordCount ? { wordCount } : {}),
        ...(shown.content ? { articleBody: shown.content } : {}),
        isPartOf:
          parts.length > 1
            ? [{ "@id": `${SITE_URL}/#website` }, { "@type": "CreativeWorkSeries", name: parts[0].title, url: absoluteUrl(localizedTestimonyPath(parts[0], lang)) }]
            : { "@id": `${SITE_URL}/#website` },
        ...(parts.length > 1 ? { position: testimony.part_number } : {}),
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
          { "@type": "ListItem", position: 3, name: shown.title, item: url },
        ],
      },
    ],
  };

  const metaRow = (
    <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-parchment-500">
      <span itemProp="author" itemScope itemType="https://schema.org/Person" className="flex items-center gap-2">
        {!testimony.is_anonymous && <Avatar name={author} src={authorProfile?.avatar_url} seed={testimony.author_id ?? author} size="xs" />}
        <span>
          {ui.sharedBy}{" "}
          {!testimony.is_anonymous && testimony.author_id ? (
            <Link href={`/author/${testimony.author_id}`} className="text-parchment-100 hover:text-gold-300" itemProp="url">
              <span itemProp="name">{author}</span>
            </Link>
          ) : (
            <span className="text-parchment-100" itemProp="name">{author}</span>
          )}
        </span>
        {!testimony.is_anonymous && testimony.author_id && <FollowButton userId={testimony.author_id} />}
      </span>
      {testimony.experienced_on && (
        <>
          <span aria-hidden>·</span>
          <span title="When it happened">{formatExperienced(testimony.experienced_on, testimony.experienced_precision)}</span>
        </>
      )}
      {formatLocation(testimony) && (
        <>
          <span aria-hidden>·</span>
          <span title="Where it happened">{formatLocation(testimony)}</span>
        </>
      )}
      <span aria-hidden>·</span>
      <time dateTime={testimony.created_at} itemProp="datePublished">{formatDate(testimony.created_at)}</time>
      {minutes && (
        <>
          <span aria-hidden>·</span>
          <span>{minutes}</span>
        </>
      )}
      {testimony.view_count > 0 && (
        <>
          <span aria-hidden>·</span>
          <span title="Views">{compactNumber(testimony.view_count)} {testimony.view_count === 1 ? "view" : "views"}</span>
        </>
      )}
      <span className="ml-auto">
        <ShareButton title={shown.title} />
      </span>
    </div>
  );

  const between = (
    <>
      <div className="hairline my-10" />
      <SeriesNav parts={parts} currentId={testimony.id} position="top" lang={lang} />
      {testimony.video_url && (
        <section aria-label="Video" className="mb-12">
          <VideoEmbed url={testimony.video_url} title={testimony.title} />
          {watchUrl && (
            <p className="mt-3 text-xs text-parchment-700">
              <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-gold-300">YouTube</a>
            </p>
          )}
        </section>
      )}
    </>
  );

  return (
    <main lang={lang}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ViewPing id={testimony.id} />
      {prev && <link rel="prev" href={absoluteUrl(localizedTestimonyPath(prev, lang))} />}
      {next && <link rel="next" href={absoluteUrl(localizedTestimonyPath(next, lang))} />}

      <article className="mx-auto max-w-3xl px-5 pt-12" itemScope itemType="https://schema.org/Article">
        <OwnerBar id={testimony.id} authorId={testimony.author_id} />
        <nav aria-label="Breadcrumb" className="mb-8 text-xs text-parchment-700">
          <Link href="/archive" className="hover:text-gold-300">Archive</Link>
          <span className="mx-2">/</span>
          <Link href={collectionPath(slugForCategoryName(testimony.category))} className="hover:text-gold-300">{testimony.category}</Link>
        </nav>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <CategoryChip name={testimony.category} />
          {parts.length > 1 && <span className="chip">{ui.partOf(testimony.part_number, parts.length)}</span>}
          <span className="text-[0.65rem] tracking-[0.2em] text-parchment-700">{catalogNumber(testimony.id)}</span>
          <span className="ml-auto">
            <LanguageSwitcher testimony={testimony} current={lang} />
          </span>
        </div>

        <TranslatedContent testimony={testimony} lang={lang} initial={translation} meta={metaRow} between={between} />

        {!testimony.is_anonymous && testimony.author_bio && (
          <aside className="mt-10 flex gap-4 rounded-xl border border-ink-600 bg-ink-900/60 p-5">
            <Avatar name={author} src={authorProfile?.avatar_url} seed={testimony.author_id ?? author} size="lg" />
            <div className="flex-1">
              <p className="eyebrow mb-1">
                {testimony.author_id ? <Link href={`/author/${testimony.author_id}`} className="hover:text-gold-300">{testimony.creator}</Link> : testimony.creator}
              </p>
              <p className="text-sm text-parchment-300">{linkify(testimony.author_bio)}</p>
              {testimony.author_id && <div className="mt-3"><FollowButton userId={testimony.author_id} /></div>}
            </div>
          </aside>
        )}

        <SeriesNav parts={parts} currentId={testimony.id} position="bottom" lang={lang} />

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
