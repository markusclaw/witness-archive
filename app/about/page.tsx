import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";

export const metadata: Metadata = {
  title: "About — what Witness Archive is and how it works",
  description:
    "Witness Archive is a community archive of first-person testimonies about near-death experiences, heaven, hell, healing, and divine encounters. What we collect, how publishing works, and answers to common questions.",
  alternates: { canonical: "/about" },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "What is Witness Archive?",
    a: "Witness Archive is a free, searchable archive of first-hand testimonies from people who describe supernatural experiences: near-death experiences, visions of heaven or hell, healings, angelic and divine encounters, prophetic dreams, and deliverance. Testimonies are written and published by their authors, credited to the original creator when they come from a video, and organized by the kind of encounter.",
  },
  {
    q: "Are the testimonies verified?",
    a: "No. We cannot verify what happened to someone on the other side of death, and we do not claim to. Every entry is presented as a first-person account, in the author's own words, with the author's name (or Anonymous) and the date it was added. Readers are trusted to weigh them for themselves.",
  },
  {
    q: "Who can publish a testimony?",
    a: "Anyone with a free account. You write it on the site, optionally attach a YouTube video, and publish under your name or anonymously. You can edit or unpublish it at any time, and long testimonies can be published in parts.",
  },
  {
    q: "Does AI write or change the testimonies?",
    a: "No. An optional assistant can fix grammar, punctuation, and paragraph breaks, and remove leftover transcript timestamps. It is instructed never to add, remove, or reinterpret anything. Every proposed edit is shown to the author as a highlighted comparison, and nothing is applied unless the author accepts it.",
  },
  {
    q: "Can I listen instead of read?",
    a: "Yes. Every written testimony has a Listen mode that reads it aloud using your device's built-in voice, with speed and voice controls and the current paragraph highlighted.",
  },
  {
    q: "How do I get my testimony removed, or report one?",
    a: "Authors can unpublish or delete their own testimonies from their account page. Original creators of embedded videos can request removal at any time. Content that mocks others or is plainly not a testimony is removed.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
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
            <Link href={`/collections/${c.slug}`} className="font-display text-lg text-parchment-50 hover:text-gold-300">
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

      <div className="hairline my-14" />

      <h2 className="font-display text-3xl text-parchment-50">Common questions</h2>
      <dl className="mt-6 space-y-6">
        {FAQ.map((f) => (
          <div key={f.q} className="card p-5">
            <dt className="font-display text-xl text-parchment-50">{f.q}</dt>
            <dd className="mt-2 leading-relaxed text-parchment-300">{f.a}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-14 flex flex-wrap gap-4">
        <Link href="/archive" className="btn btn-primary">Browse the archive</Link>
        <Link href="/submit" className="btn btn-ghost">Write your testimony</Link>
      </div>
    </main>
  );
}
