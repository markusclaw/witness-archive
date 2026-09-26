import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";

export const metadata: Metadata = {
  title: "About",
  description: "Why Witness Archive exists, what we collect, and how testimonies are chosen.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <p className="eyebrow mb-3">About the project</p>
      <h1 className="font-display text-4xl font-light leading-tight text-parchment-50 sm:text-5xl">
        Some stories are too important to be lost in an algorithm.
      </h1>

      <div className="prose-testimony mt-10">
        <p>
          Across the internet there are thousands of people who have described the same thing: they died,
          or nearly did, or found themselves somewhere they could not explain — and they came back
          different. Their accounts are scattered across old channels, deleted uploads, church livestreams,
          and interviews with a few hundred views. They are hard to find, easy to lose, and almost never
          in conversation with one another.
        </p>
        <p>
          Witness Archive exists to change that. We gather first-hand testimonies of the supernatural into
          a single, permanent, searchable place — credited to the people who shared them, organized by the
          kind of encounter, and open to respectful discussion.
        </p>
      </div>

      <div className="hairline my-14" />

      <h2 className="font-display text-3xl text-parchment-50">What we collect</h2>
      <p className="mt-4 leading-relaxed text-parchment-300">
        Every entry in the archive is a first-person account. We don&apos;t publish commentary, reaction
        videos, or second-hand retellings. The collections are:
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <li key={c.slug} className="card p-4">
            <Link href={`/archive?category=${c.slug}`} className="font-display text-lg text-parchment-50 hover:text-gold-300">
              {c.name}
            </Link>
            <p className="mt-1 text-sm text-parchment-500">{c.blurb}</p>
          </li>
        ))}
      </ul>

      <div className="hairline my-14" />

      <h2 className="font-display text-3xl text-parchment-50">How testimonies get here</h2>
      <div className="mt-4 space-y-4 leading-relaxed text-parchment-300">
        <p>
          Anyone with an account can write and publish their own testimony, under their name or anonymously.
          We are not judges: we cannot verify what happened to someone on the other side of death, and we
          don&apos;t pretend to. What we ask for is a sincere, first-person account of something that
          happened to you.
        </p>
        <p>
          Writing is hard, and an experience like this is harder still to put into words. So we offer an
          assistant that tidies grammar, punctuation, and paragraph breaks — and nothing else. It never
          changes what you said, every edit is shown to you before it&apos;s applied, and you can keep your
          original. Long testimonies can be published in parts so they&apos;re read the way they were told.
        </p>
        <p>
          Videos are embedded from their public source rather than re-uploaded, and any entry comes down at
          its author&apos;s request. Accounts that publish content mocking others or plainly not a testimony will be
          removed.
        </p>
      </div>

      <div className="hairline my-14" />

      <h2 className="font-display text-3xl text-parchment-50">A note on discussion</h2>
      <p className="mt-4 leading-relaxed text-parchment-300">
        People are trusting this space with the most vulnerable thing that ever happened to them. Ask
        questions, share your own experience, disagree if you must — but do it the way you would across a
        kitchen table. Responses that mock or harass will be removed.
      </p>

      <div className="mt-14 flex flex-wrap gap-4">
        <Link href="/archive" className="btn btn-primary">Browse the archive</Link>
        <Link href="/submit" className="btn btn-ghost">Write your testimony</Link>
      </div>
    </main>
  );
}
