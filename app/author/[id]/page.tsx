import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import TestimonyCard from "@/components/TestimonyCard";
import { compactNumber } from "@/lib/format";
import { getFollowerCount, getProfile, getTestimoniesByAuthor } from "@/lib/queries";
import { DEFAULT_OG_IMAGE, SITE_NAME, absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) return { title: "Author not found", robots: { index: false } };
  const title = `${profile.display_name} — testimonies`;
  const description = profile.bio ?? `Testimonies shared by ${profile.display_name} on ${SITE_NAME}.`;
  return {
    title,
    description,
    alternates: { canonical: `/author/${id}` },
    openGraph: { type: "profile", title: `${title} · ${SITE_NAME}`, description, url: absoluteUrl(`/author/${id}`), images: [{ url: profile.avatar_url ?? DEFAULT_OG_IMAGE }] },
  };
}

export default async function AuthorPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const profile = await getProfile(id);
  if (!profile) notFound();
  const [testimonies, followers] = await Promise.all([getTestimoniesByAuthor(id), getFollowerCount(id)]);
  const totalViews = testimonies.reduce((n, t) => n + (t.view_count ?? 0), 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: { "@type": "Person", name: profile.display_name, description: profile.bio ?? undefined, image: profile.avatar_url ?? undefined, url: absoluteUrl(`/author/${id}`) },
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <Avatar name={profile.display_name} src={profile.avatar_url} seed={profile.id} size="xl" />
        <div className="flex-1">
          <p className="eyebrow mb-2">Author</p>
          <h1 className="font-display text-4xl text-parchment-50">{profile.display_name}</h1>
          {profile.bio && <p className="mt-2 max-w-2xl text-parchment-300">{profile.bio}</p>}
          <p className="mt-3 text-sm text-parchment-500">
            {testimonies.length} {testimonies.length === 1 ? "testimony" : "testimonies"} · {compactNumber(followers)} {followers === 1 ? "follower" : "followers"}
            {totalViews > 0 && <> · {compactNumber(totalViews)} views</>}
          </p>
        </div>
        <FollowButton userId={id} initialCount={followers} size="md" />
      </header>

      <div className="hairline my-12" />

      {testimonies.length === 0 ? (
        <p className="text-parchment-500">No published testimonies yet.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonies.map((t, i) => (
            <TestimonyCard key={t.id} testimony={t} priority={i < 3} />
          ))}
        </div>
      )}
    </main>
  );
}
