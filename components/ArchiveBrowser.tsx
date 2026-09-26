"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import TestimonyCard from "@/components/TestimonyCard";
import { CATEGORIES, categoryBySlug } from "@/lib/categories";
import type { Testimony } from "@/lib/types";

type Sort = "newest" | "oldest" | "title";

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
        (t.content ?? "").toLowerCase().includes(needle)
      );
    });
    list = [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      const d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sort === "newest" ? -d : d;
    });
    return list;
  }, [testimonies, category, query, sort]);

  return (
    <div>
      {/* Controls */}
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-md">
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, names, keywords…"
            className="input !pl-9"
          />
        </label>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-parchment-700">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="input !w-auto !py-2"
            aria-label="Sort testimonies"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>
      </div>

      {/* Category chips */}
      <div className="mb-10 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory("")}
          className={`chip chip-interactive ${category === "" ? "chip-active" : ""}`}
        >
          All · {testimonies.length}
        </button>
        {CATEGORIES.map((c) => {
          const n = counts[c.name] ?? 0;
          if (n === 0 && category !== c.slug) return null;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => setCategory(category === c.slug ? "" : c.slug)}
              className={`chip chip-interactive ${category === c.slug ? "chip-active" : ""}`}
            >
              {c.name} · {n}
            </button>
          );
        })}
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
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-parchment-700">
            {results.length} {results.length === 1 ? "result" : "results"}
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((t) => (
              <TestimonyCard key={t.id} testimony={t} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
