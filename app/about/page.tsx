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

      <h2 className="font-display text-3xl text-parchment-50">How testimonies are chosen</h2>
      <div className="mt-4 space-y-4 leading-relaxed text-parchment-300">
        <p>
          We are curators, not judges. We cannot verify what happened to someone on the other side of
          death, and we don&apos;t pretend to. What we do look for is sincerity, a clear first-person account,
          and a life that was visibly changed by the experience.
        </p>
        <p>
          Every submission is read by a person before it is published. We credit the original creator,
          embed the video from its public source rather than re-uploading it, and take entries down at a
          creator&apos;s request.
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
        <Link href="/submit" className="btn btn-ghost">Submit a testimony</Link>
      </div>
    </main>
  );
}
