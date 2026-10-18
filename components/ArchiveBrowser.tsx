"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import TestimonyCard from "@/components/TestimonyCard";
import { CATEGORIES, categoryBySlug } from "@/lib/categories";
import type { Testimony } from "@/lib/types";

type Sort = "newest" | "oldest" | "title" | "views" | "hearts";

/** How many cards to render at a time; more load as you near the end. */
const PAGE = 12;

export default function ArchiveBrowser({
  testimonies,
  initialCategory,
  initialQuery,
}: {
  testimonies: Testimony[];
  initialCategory: string;
  initialQuery: string;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<Sort>("newest");
  const [limit, setLimit] = useState(PAGE);
  const top = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Keep the URL shareable without triggering a server round-trip.
  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (query.trim()) params.set("q", query.trim());
    const next = params.toString() ? `${pathname}?${params}` : pathname;
    window.history.replaceState(window.history.state, "", next);
  }, [category, query, pathname]);

  /** A new filter starts the feed over, back at the top. */
  const restart = () => {
    setLimit(PAGE);
    const el = top.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  };
  const pickCategory = (slug: string) => {
    setCategory(slug);
    restart();
  };

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of testimonies) m[t.category] = (m[t.category] ?? 0) + 1;
    return m;
  }, [testimonies]);

  const results = useMemo(() => {
    const cat = categoryBySlug(category);
    const needle = query.trim().toLowerCase();
    let list = testimonies.filter((t) => {
      if (cat && t.category.toLowerCase() !== cat.name.toLowerCase()) return false;
      if (!needle) return true;
      return (
        t.title.toLowerCase().includes(needle) ||
        t.description.toLowerCase().includes(needle) ||
        t.creator.toLowerCase().includes(needle) ||
        [t.location_city, t.location_region, t.location_country, t.location_text].some((v) => (v ?? "").toLowerCase().includes(needle)) ||
        (t.content ?? "").toLowerCase().includes(needle)
      );
    });
    list = [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "views") return (b.view_count ?? 0) - (a.view_count ?? 0);
      if (sort === "hearts") return (b.heart_count ?? 0) - (a.heart_count ?? 0);
      const d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sort === "newest" ? -d : d;
    });
    return list;
  }, [testimonies, category, query, sort]);

  const shown = results.slice(0, limit);
  const more = results.length > limit;

  // Load the next batch as the end of the list scrolls into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((n) => n + PAGE);
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [more, limit]);

  return (
    <div ref={top} className="scroll-mt-16">
      {/* Controls — on phones a slim bar that stays under the header while you scroll */}
      <div className="sticky top-[3.72rem] z-30 -mx-5 mb-5 border-b border-ink-700/70 bg-ink-950/90 px-5 pb-3 pt-3 backdrop-blur-md sm:static sm:z-auto sm:mx-0 sm:mb-10 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="flex items-center gap-2 sm:mb-6 sm:gap-4 lg:justify-between">
          <label className="relative block min-w-0 flex-1 lg:max-w-md">
            <span className="sr-only">Search testimonies</span>
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-700"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="Search titles, names, places…"
              className="input !h-10 !pl-9 sm:!h-auto"
            />
          </label>

          <label className="flex shrink-0 items-center gap-3 text-sm">
            <span className="hidden text-parchment-700 sm:inline">Sort</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as Sort);
                restart();
              }}
              className="input !h-10 !w-auto !py-0 !pl-3 !pr-8 !text-sm sm:!h-auto sm:!py-2"
              aria-label="Sort testimonies"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="views">Most viewed</option>
              <option value="hearts">Most loved</option>
              <option value="title">A–Z</option>
            </select>
          </label>
        </div>

        {/* Category chips: one swipeable row on phones, wrapped from tablet up */}
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:mt-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <button
            type="button"
            onClick={() => pickCategory("")}
            className={`chip chip-interactive shrink-0 ${category === "" ? "chip-active" : ""}`}
          >
            All<span className="hidden sm:inline"> · {testimonies.length}</span>
          </button>
          {CATEGORIES.map((c) => {
            const n = counts[c.name] ?? 0;
            if (n === 0 && category !== c.slug) return null;
            return (
              <button
                key={c.slug}
                type="button"
                onClick={() => pickCategory(category === c.slug ? "" : c.slug)}
                className={`chip chip-interactive shrink-0 whitespace-nowrap ${category === c.slug ? "chip-active" : ""}`}
              >
                {c.name}<span className="hidden sm:inline"> · {n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <div className="card p-14 text-center">
          <p className="font-display text-2xl text-parchment-50">Nothing here yet.</p>
          <p className="mt-2 text-parchment-500">
            {testimonies.length === 0
              ? "The archive is being assembled — check back soon."
              : "Try a different search or clear the filters."}
          </p>
          {(category || query) && (
            <button
              type="button"
              onClick={() => {
                setCategory("");
                setQuery("");
                setLimit(PAGE);
                router.replace(pathname);
              }}
              className="btn btn-ghost mt-6"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="mb-4 hidden text-xs uppercase tracking-[0.2em] text-parchment-700 sm:block">
            {results.length} {results.length === 1 ? "result" : "results"}
          </p>
          <div className="feed grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((t, i) => (
              <TestimonyCard key={t.id} testimony={t} priority={i < 2} />
            ))}
          </div>
          {more ? (
            <div ref={sentinel} className="flex justify-center py-10">
              <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="btn btn-ghost !h-9 !px-5 !text-sm">
                Show more
              </button>
            </div>
          ) : (
            results.length > PAGE && (
              <p className="py-10 text-center text-xs uppercase tracking-[0.2em] text-parchment-700">
                That’s all {results.length}
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}
