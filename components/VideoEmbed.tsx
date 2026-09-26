"use client";

import { useState } from "react";
import { youtubeEmbedUrl, youtubeThumbnail } from "@/lib/youtube";

/**
 * Click-to-play facade: shows the thumbnail first and only loads the YouTube
 * iframe on demand. Keeps the page fast and avoids third-party cookies until
 * the visitor chooses to watch.
 */
export default function VideoEmbed({ url, title }: { url: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const embed = youtubeEmbedUrl(url);
  const thumb = youtubeThumbnail(url, "maxres");

  if (!embed) {
    return (
      <div className="card p-6 text-sm text-parchment-500">
        This video link could not be embedded.{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-gold-300">
          Open it directly
        </a>
        .
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-ink-600 bg-ink-900 shadow-glow">
      {playing ? (
        <iframe
          src={`${embed}&autoplay=1`}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 flex h-full w-full items-center justify-center"
          aria-label={`Play video: ${title}`}
        >
          {thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <span className="absolute inset-0 bg-ink-950/40 transition group-hover:bg-ink-950/25" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gold-500 text-ink-950 shadow-lg transition group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
