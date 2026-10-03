/** Text preparation for the browser's speech synthesis. */

/** "Chapter 3: The hospital" / "Capítulo 2 — …" / "Part 2" */
export function isHeadingLine(p: string): boolean {
  return /^(chapter|cap[ií]tulo|part|parte)\s+\d+\b/i.test(p.trim()) && p.trim().length < 90;
}

/**
 * Split a paragraph into sentences for one-utterance-per-sentence speech.
 * Keeps abbreviations like "Dr." and "St." attached, and never returns a
 * fragment longer than ~220 characters (long run-ons get split at commas or
 * semicolons so the engine still breathes).
 */
export function splitSentences(text: string): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return [];
  const protectedText = t.replace(/\b(Dr|Mr|Mrs|Ms|St|Sr|Sra|Jr|vs|etc|Rev|Pr|Pst)\.\s/g, "$1\u2024 ");
  const rough = protectedText.split(/(?<=[.!?…]["'”’)]?)\s+(?=[A-ZÁÉÍÓÚÑ¿¡"“‘(])/).map((x) => x.replace(/\u2024/g, ".").trim()).filter(Boolean);
  const out: string[] = [];
  for (const s of rough) {
    if (s.length <= 220) {
      out.push(s);
      continue;
    }
    let rest = s;
    while (rest.length > 220) {
      let cut = Math.max(rest.lastIndexOf(", ", 220), rest.lastIndexOf("; ", 220), rest.lastIndexOf(" — ", 220));
      if (cut < 60) cut = rest.lastIndexOf(" ", 220); // no clause break: fall back to a word boundary
      if (cut < 60) break;
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}
