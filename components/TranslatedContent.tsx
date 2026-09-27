"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TestimonyBody from "@/components/TestimonyBody";
import { toParagraphs } from "@/lib/format";
import { languageByCode, languageNameIn } from "@/lib/languages";
import { testimonyPath } from "@/lib/seo";
import type { Testimony, Translation, TranslationJob } from "@/lib/types";

type Shown = Pick<Translation, "title" | "description" | "content"> & { source?: Translation["source"] };

/**
 * Title, description, and body in the requested language. If the translation
 * is already cached it arrives server-rendered; otherwise this asks the server
 * to generate it (once, then cached for everyone) while showing the original.
 */
export default function TranslatedContent({
  testimony,
  lang,
  initial,
  meta,
  between,
  hideDescription = false,
}: {
  testimony: Testimony;
  lang: string;
  initial: Translation | null;
  meta: React.ReactNode;
  between: React.ReactNode;
  hideDescription?: boolean;
}) {
  const isTranslated = lang !== testimony.language;
  const language = languageByCode(lang)!;
  const [translation, setTranslation] = useState<Translation | null>(initial);
  const [status, setStatus] = useState<"idle" | "loading" | "failed">(isTranslated && !initial ? "loading" : "idle");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Ask the server for the translation. A cached one comes back at once; otherwise
  // the server starts a background job and we poll its progress until it is ready.
  useEffect(() => {
    if (!isTranslated || translation) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const handle = (res: Response, data: Translation | TranslationJob) => {
      if (cancelled) return;
      if (res.status === 200 && data.status === "ready") {
        setTranslation(data);
        setStatus("idle");
        return;
      }
      if (res.status === 202 && data.status === "pending") {
        setProgress({ done: data.progress_done, total: data.progress_total });
        timer = setTimeout(poll, 3000);
        return;
      }
      setStatus("failed");
    };

    const poll = async () => {
      try {
        const res = await fetch(`/api/translate?id=${encodeURIComponent(testimony.id)}&language=${encodeURIComponent(lang)}`, { cache: "no-store" });
        if (res.status === 404) throw new Error("gone");
        handle(res, (await res.json()) as Translation | TranslationJob);
      } catch {
        if (!cancelled) setStatus("failed");
      }
    };

    (async () => {
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: testimony.id, language: lang }),
        });
        if (res.status !== 200 && res.status !== 202) throw new Error(String(res.status));
        handle(res, (await res.json()) as Translation | TranslationJob);
      } catch {
        if (!cancelled) setStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isTranslated, translation, testimony.id, lang]);

  const shown: Shown = translation ?? testimony;
  const paragraphs = toParagraphs(shown.content);
  const originalName = languageNameIn(testimony.language, lang);

  return (
    <>
      <header>
        <h1 className="font-display text-4xl font-light leading-tight text-parchment-50 sm:text-5xl" itemProp="headline">
          {shown.title}
        </h1>
        {!(hideDescription && !translation) && shown.description && (
          <p className="mt-5 text-lg leading-relaxed text-parchment-300" itemProp="description">{shown.description}</p>
        )}
        {meta}
        {isTranslated && (
          <p className="mt-4 rounded-lg border border-ink-600 bg-ink-900/60 px-4 py-2 text-xs text-parchment-500">
            {status === "loading" ? (
              <span className="text-gold-300">
                {language.ui.translating}
                {progress && progress.total > 1 && ` ${Math.min(progress.done, progress.total)}/${progress.total}`}
              </span>
            ) : status === "failed" ? (
              <>Translation isn&apos;t available right now — showing the original.</>
            ) : (
              <>
                {(translation?.source ?? "machine") === "machine" ? language.ui.machineNotice.replace("{lang}", originalName) : `${language.ui.original}: ${originalName}.`}{" "}
                <Link href={testimonyPath(testimony)} className="text-gold-400 underline hover:text-gold-300">
                  {languageByCode(testimony.language)?.ui.readIn ?? originalName}
                </Link>
              </>
            )}
          </p>
        )}
      </header>

      {between}

      {status === "loading" ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          {progress && progress.total > 1 && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
              <div className="h-full bg-gold-500 transition-[width] duration-700" style={{ width: `${Math.max(4, (100 * progress.done) / progress.total)}%` }} />
            </div>
          )}
          {[95, 100, 88, 97, 60].map((w, i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-ink-700" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : paragraphs.length > 0 ? (
        <div itemProp="articleBody">
          <TestimonyBody paragraphs={paragraphs} title={shown.title} lang={translation ? lang : testimony.language} />
        </div>
      ) : (
        !testimony.video_url && <p className="text-parchment-500">A written account for this testimony has not been added yet.</p>
      )}
    </>
  );
}
