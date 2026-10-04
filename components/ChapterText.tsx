"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * The verses of a chapter. `?v=16` or `?v=16-18` highlights a passage and
 * scrolls to it; clicking a verse number selects it (and updates the URL so
 * the link can be shared).
 */
export default function ChapterText({ verses, lang }: { verses: { verse: number; text: string }[]; lang: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [range, setRange] = useState<[number, number] | null>(null);

  useEffect(() => {
    const v = params.get("v");
    const m = v && /^(\d{1,3})(?:-(\d{1,3}))?$/.exec(v);
    const next: [number, number] | null = m ? [Number(m[1]), Number(m[2] ?? m[1])] : null;
    queueMicrotask(() => setRange(next));
    if (next) {
      const el = document.getElementById(`v${next[0]}`);
      if (el) setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
    }
  }, [params]);

  const select = (n: number) => {
    const q = new URLSearchParams(params.toString());
    if (range && range[0] === n && range[1] === n) q.delete("v");
    else if (range && range[0] === range[1] && n !== range[0]) q.set("v", `${Math.min(range[0], n)}-${Math.max(range[0], n)}`);
    else q.set("v", String(n));
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  return (
    <div className="prose-testimony prose-chapter" lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <p>
        {verses.map((v) => {
          const hit = !!range && v.verse >= range[0] && v.verse <= range[1];
          return (
            <span key={v.verse} id={`v${v.verse}`} className={`verse ${hit ? "verse-hit" : ""}`}>
              <button type="button" onClick={() => select(v.verse)} className="verse-num" aria-label={`Verse ${v.verse}`}>
                {v.verse}
              </button>
              {v.text}{" "}
            </span>
          );
        })}
      </p>
    </div>
  );
}
