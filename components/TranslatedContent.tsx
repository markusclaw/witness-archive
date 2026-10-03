"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TestimonyBody from "@/components/TestimonyBody";
import { toParagraphs } from "@/lib/format";
import { chunkParagraphs } from "@/lib/chunks";
import { languageByCode, languageNameIn } from "@/lib/languages";
import { testimonyPath } from "@/lib/seo";
import type { Testimony, Translation, TranslationJob } from "@/lib/types";
import { track } from "@/lib/analytics";

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
  const [partial, setPartial] = useState<TranslationJob | null>(null);

  // Drive the translation one step per request: each POST translates one more
  // chunk and reports progress; we call again until it comes back ready. If a
  // step fails (Claude hiccup), retry a couple of times before giving up.
  useEffect(() => {
    if (!isTranslated || translation) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    const step = async () => {
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: testimony.id, language: lang }),
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status !== 200 && res.status !== 202) throw new Error(String(res.status));
        const data = (await res.json()) as Translation | TranslationJob;
        if (data.status === "ready") {
          setTranslation(data);
          setStatus("idle");
          return;
        }
        if (data.status === "pending") {
          failures = 0;
          setProgress({ done: data.progress_done, total: data.progress_total });
          setPartial(data);
          // Another visitor is translating this chunk → wait; otherwise go straight on.
          timer = setTimeout(step, data.working === false ? 4000 : 250);
          return;
        }
        throw new Error(data.error ?? "failed");
      } catch {
        if (cancelled) return;
        failures += 1;
        if (failures <= 2) timer = setTimeout(step, 3000 * failures);
        else setStatus("failed");
      }
    };

    track("translate", { testimony_id: testimony.id, from_language: testimony.language, to_language: lang });
    void step();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isTranslated, translation, testimony.id, testimony.language, lang]);

  const shown: Shown = translation ?? (partial?.title ? { title: partial.title, description: partial.description ?? testimony.description, content: testimony.content } : testimony);
  const paragraphs = toParagraphs(shown.content);

  // While translating: the finished chunks in the new language, the rest still in the original.
  const originalChunks = useMemo(() => chunkParagraphs(testimony.content ?? ""), [testimony.content]);
  const doneParts = partial?.parts ?? [];
  const translatedSoFar = toParagraphs(doneParts.join("\n\n"));
  const remaining = toParagraphs(originalChunks.slice(doneParts.length).join("\n\n"));
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
        <div aria-busy="true" aria-live="polite">
          {progress && progress.total > 1 && (
            <div className="mb-6 h-1 w-full overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
              <div className="h-full bg-gold-500 transition-[width] duration-700" style={{ width: `${Math.max(4, (100 * progress.done) / progress.total)}%` }} />
            </div>
          )}
          {translatedSoFar.length > 0 && (
            <div className="prose-testimony" lang={lang}>
              {translatedSoFar.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
          {remaining.length > 0 && (
            <div className="relative mt-2 border-t border-dashed border-gold-500/30 pt-6" lang={testimony.language}>
              <span className="absolute -top-2.5 left-0 bg-ink-950 pr-2 text-[0.7rem] uppercase tracking-[0.18em] text-gold-500">
                {language.ui.translating}
                {progress && progress.total > 1 && ` ${Math.min(progress.done, progress.total)}/${progress.total}`}
              </span>
              <div className="prose-testimony prose-continued opacity-45">
                {(translatedSoFar.length ? remaining : remaining.slice(0, 6)).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          )}
          {translatedSoFar.length === 0 && remaining.length === 0 &&
            [95, 100, 88, 97, 60].map((w, i) => <div key={i} className="mb-4 h-5 animate-pulse rounded bg-ink-700" style={{ width: `${w}%` }} />)}
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
