"use client";

import { useMemo } from "react";
import { uniqueReferences } from "@/lib/scripture";
import { ScriptureRef } from "@/components/ScriptureRef";

const LABEL: Record<string, string> = {
  en: "Scripture in this testimony",
  es: "Escrituras en este testimonio",
  pt: "Escrituras neste testemunho",
};

/** The passages a testimony leans on, gathered under the text as chips that open the verse. */
export default function ScriptureStrip({ text, lang = "en", label }: { text: string; lang?: string; label?: string }) {
  const refs = useMemo(() => uniqueReferences(text), [text]);
  if (!refs.length) return null;
  return (
    <aside className="mt-10 border-t border-ink-700 pt-6" aria-label={label ?? LABEL[lang] ?? LABEL.en}>
      <p className="eyebrow mb-3">{label ?? LABEL[lang] ?? LABEL.en}</p>
      <div className="flex flex-wrap gap-2">
        {refs.map((r, i) => (
          <ScriptureRef key={i} reference={r} chip lang={lang} />
        ))}
      </div>
    </aside>
  );
}
