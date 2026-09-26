import Link from "next/link";
import TestimonyCard from "@/components/TestimonyCard";
import AskBox from "@/components/AskBox";
import { SUGGESTED_QUESTIONS } from "@/lib/ask";
import { CATEGORIES } from "@/lib/categories";
import { getCategoryCounts, getRecentTestimonies, getTrending } from "@/lib/queries";
import type { Metadata } from "next";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export const dynamic = "force-dynamic";

export default async function Home() {
  const [recent, counts, trending] = await Promise.all([getRecentTestimonies(3), getCategoryCounts(), getTrending(7, 3)]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-24 text-center sm:pt-32">
          <p className="eyebrow fade-up mb-6">A record of the unexplainable</p>
          <h1 className="font-display fade-up mx-auto max-w-4xl text-5xl font-light leading-[1.05] tracking-tight text-parchment-50 sm:text-7xl">
            They came back <em className="text-gold-400 not-italic">changed.</em>
            <br />
            These are their words.
          </h1>
          <p className="fade-up mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-parchment-300">
            Witness Archive gathers first-hand testimonies of heaven, hell, healing, and divine encounter —
            stories scattered across the internet — into one place where they can be found, heard, and
            discussed with care.
          </p>
          <div className="fade-up mx-auto mt-10 max-w-2xl">
            <AskBox />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {SUGGESTED_QUESTIONS.slice(0, 3).map((s) => (
                <Link key={s} href={`/ask?q=${encodeURIComponent(s)}`} className="rounded-full border border-ink-600 px-3 py-1 text-xs text-parchment-500 transition hover:border-gold-500/40 hover:text-parchment-100">
                  {s}
                </Link>
              ))}
              <Link href="/archive" className="rounded-full px-3 py-1 text-xs text-gold-400 hover:text-gold-300">
                Browse all →
              </Link>
            </div>
          </div>
          {total > 0 && (
            <p className="mt-8 text-xs tracking-[0.2em] text-parchment-700 uppercase">
              {total} {total === 1 ? "testimony" : "testimonies"} · {Object.keys(counts).length} collections
            </p>
          )}
        </div>
        <div className="hairline mx-auto max-w-4xl" />
      </section>

      {/* Recent */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow mb-3">Recently added</p>
            <h2 className="font-display text-3xl text-parchment-50 sm:text-4xl">Latest entries</h2>
          </div>
          <Link href="/archive" className="hidden text-sm text-gold-400 hover:text-gold-300 sm:block">
            View all →
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="card p-12 text-center text-parchment-500">
            The archive is being assembled. The first testimonies will appear here soon.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((t, i) => (
              <TestimonyCard key={t.id} testimony={t} priority={i === 0} />
            ))}
          </div>
        )}
      </section>

      {/* Trending */}
      {trending.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-20">
          <p className="eyebrow mb-3">Most read this week</p>
          <h2 className="font-display mb-10 text-3xl text-parchment-50 sm:text-4xl">What people are turning to</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trending.map((t) => (
              <TestimonyCard key={t.id} testimony={t} />
            ))}
          </div>
        </section>
      )}

      {/* Collections */}
      <section className="border-y border-ink-700 bg-ink-900/60">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="eyebrow mb-3">Collections</p>
          <h2 className="font-display mb-10 text-3xl text-parchment-50 sm:text-4xl">Explore by encounter</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                href={`/collections/${c.slug}`}
                className="card group flex flex-col p-6"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-xl text-parchment-50 group-hover:text-gold-300">{c.name}</h3>
                  <span className="text-xs text-parchment-700">{counts[c.name] ?? 0}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-parchment-500">{c.blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-12 md:grid-cols-3">
          {[
            {
              n: "01",
              title: "Gathered",
              body: "We track down testimonies that live in old uploads, obscure channels, and forgotten interviews, and give each one a permanent home.",
            },
            {
              n: "02",
              title: "Contextualized",
              body: "Every entry is catalogued by the kind of encounter, credited to its original creator, and paired with a readable written account where one exists.",
            },
            {
              n: "03",
              title: "Shared",
              body: "Members write and publish their own testimonies — in parts if the story is long — and respond to one another with questions, their own experiences, or simply the acknowledgment that they were heard.",
            },
          ].map((s) => (
            <div key={s.n}>
              <p className="font-display text-4xl text-gold-500/60">{s.n}</p>
              <h3 className="font-display mt-3 text-2xl text-parchment-50">{s.title}</h3>
              <p className="mt-3 leading-relaxed text-parchment-500">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-8">
        <div className="card relative overflow-hidden p-10 text-center sm:p-16">
          <p className="eyebrow mb-4">Have a story?</p>
          <h2 className="font-display mx-auto max-w-2xl text-3xl text-parchment-50 sm:text-4xl">
            If something happened to you that you cannot explain, it belongs here.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-parchment-500">
            Write it in your own words. An assistant can tidy the grammar and paragraphs — never the meaning — and you
            publish when it feels right. Anonymously, if you prefer.
          </p>
          <Link href="/submit" className="btn btn-primary mt-8">
            Write your testimony
          </Link>
        </div>
      </section>
    </main>
  );
}
