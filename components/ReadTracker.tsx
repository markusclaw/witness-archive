"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * Sends `testimony_view` once, then `read_progress` at 25/50/75/100% of the
 * article body as the visitor scrolls. 100% is the "finished reading" signal.
 */
export default function ReadTracker({
  id,
  category,
  language,
  shownLanguage,
  relationship,
  hasVideo,
  words,
}: {
  id: string;
  category: string;
  language: string;
  shownLanguage: string;
  relationship: string;
  hasVideo: boolean;
  words: number;
}) {
  useEffect(() => {
    track("testimony_view", {
      testimony_id: id,
      testimony_category: category,
      testimony_language: language,
      shown_language: shownLanguage,
      witness_relationship: relationship,
      has_video: hasVideo,
      length_bucket: words < 800 ? "short" : words < 2500 ? "medium" : "long",
    });
  }, [id, category, language, shownLanguage, relationship, hasVideo, words]);

  useEffect(() => {
    const body = document.querySelector<HTMLElement>('[itemprop="articleBody"]');
    if (!body) return;
    const sent = new Set<number>();
    let ticking = false;
    const check = () => {
      ticking = false;
      const rect = body.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const height = rect.height || 1;
      const seen = window.scrollY + window.innerHeight - top;
      const pct = Math.max(0, Math.min(100, Math.round((seen / height) * 100)));
      for (const m of [25, 50, 75, 100]) {
        if (pct >= m && !sent.has(m)) {
          sent.add(m);
          track("read_progress", { testimony_id: id, testimony_category: category, percent: m, shown_language: shownLanguage });
        }
      }
      if (sent.size === 4) window.removeEventListener("scroll", onScroll);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(check);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const t = window.setTimeout(check, 1500);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(t);
    };
  }, [id, category, shownLanguage]);

  return null;
}
