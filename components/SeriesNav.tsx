import Link from "next/link";
import type { Testimony } from "@/lib/types";
import { localizedTestimonyPath } from "@/lib/seo";

export default function SeriesNav({ parts, currentId, position = "top", lang }: { parts: Testimony[]; currentId: string; position?: "top" | "bottom"; lang?: string }) {
  const href = (p: Testimony) => (lang ? localizedTestimonyPath(p, lang) : localizedTestimonyPath(p, p.language));
  if (parts.length < 2) return null;
  const idx = parts.findIndex((p) => p.id === currentId);
  const prev = idx > 0 ? parts[idx - 1] : null;
  const next = idx >= 0 && idx < parts.length - 1 ? parts[idx + 1] : null;

  if (position === "top") {
    return (
      <nav aria-label="Series" className="mb-8 rounded-xl border border-ink-600 bg-ink-900/60 p-4">
        <p className="eyebrow mb-3">A testimony in {parts.length} parts</p>
        <ol className="flex flex-wrap gap-2">
          {parts.map((p) => (
            <li key={p.id}>
              {p.id === currentId ? (
                <span className="chip chip-active" aria-current="page">Part {p.part_number}</span>
              ) : (
                <Link href={href(p)} className="chip chip-interactive" title={p.title}>
                  Part {p.part_number}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label="Continue the series" className="mt-12 grid gap-4 sm:grid-cols-2">
      {prev ? (
        <Link href={href(prev)} className="card p-5">
          <p className="text-xs text-parchment-700">← Part {prev.part_number}</p>
          <p className="font-display mt-1 text-lg text-parchment-50">{prev.title}</p>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={href(next)} className="card p-5 text-right sm:col-start-2">
          <p className="text-xs text-gold-400">Continue to Part {next.part_number} →</p>
          <p className="font-display mt-1 text-lg text-parchment-50">{next.title}</p>
        </Link>
      )}
    </nav>
  );
}
