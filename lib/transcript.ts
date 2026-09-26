/**
 * Deterministic cleanup for pasted video transcripts (YouTube "show transcript",
 * auto-captions, etc.). Removes timestamp artifacts and re-joins the broken
 * lines so the text reads as prose. Purely mechanical — no wording changes.
 *
 * Handles shapes like:
 *   0:00  /  1:02  /  12:34:56
 *   0:000 seconds  /  0:1515 seconds  /  1:021 minute, 2 seconds   (YouTube's flattened format)
 *   [00:12]  /  (1:05)  /  00:12 -->  00:15
 */
const TIMESTAMP_PATTERNS: RegExp[] = [
  // YouTube flattened "M:SSSS seconds" / "M:SSS minute, S seconds" glued to the next word
  /\b\d{1,2}:\d{2,4}\s*(?:minutes?|minute)?,?\s*(?:\d{1,3}\s*)?seconds?(?=\S|\s)/gi,
  // SRT / VTT ranges
  /\b\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?/g,
  // bracketed or bare timestamps at a line start
  /^\s*[\[(]?\d{1,2}:\d{2}(?::\d{2})?[\])]?\s*/gm,
  // bare timestamps inline
  /(?:^|\s)[\[(]\d{1,2}:\d{2}(?::\d{2})?[\])](?=\s|$)/g,
];

const FILLER = /\b(?:um+|uh+|erm+|hmm+)\b[,.]?\s*/gi;

export function looksLikeTranscript(text: string): boolean {
  const sample = text.slice(0, 4000);
  const hits = (sample.match(/\d{1,2}:\d{2,4}/g) ?? []).length;
  const lines = sample.split("\n").length;
  return hits >= 4 || (lines > 20 && hits >= 2);
}

export function cleanTranscript(text: string): string {
  let t = text.replace(/\r\n?/g, "\n");
  for (const re of TIMESTAMP_PATTERNS) t = t.replace(re, " ");
  // SRT cue numbers on their own line
  t = t.replace(/^\s*\d{1,5}\s*$/gm, "");
  t = t.replace(FILLER, "");

  // Re-flow: a line break mid-sentence is a wrap, not a paragraph.
  const lines = t.split("\n").map((l) => l.replace(/\s+/g, " ").trim());
  const out: string[] = [];
  let buf = "";
  const flush = () => {
    if (buf.trim()) out.push(buf.trim());
    buf = "";
  };
  for (const line of lines) {
    if (!line) {
      flush();
      continue;
    }
    // Headings like "Chapter 1: ..." stand alone.
    if (/^(chapter|part)\s+\d+\b/i.test(line) && line.length < 80) {
      flush();
      out.push(line);
      continue;
    }
    buf = buf ? `${buf} ${line}` : line;
  }
  flush();

  // Split very long runs into paragraphs at sentence boundaries (~5 sentences).
  const paragraphs: string[] = [];
  for (const block of out) {
    if (block.length < 700) {
      paragraphs.push(block);
      continue;
    }
    const sentences = block.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [block];
    let para = "";
    let n = 0;
    for (const s of sentences) {
      para += s;
      n++;
      if (n >= 5 && para.length > 400) {
        paragraphs.push(para.trim());
        para = "";
        n = 0;
      }
    }
    if (para.trim()) paragraphs.push(para.trim());
  }

  return paragraphs.join("\n\n").replace(/[ \t]+([,.;:!?])/g, "$1").trim();
}
