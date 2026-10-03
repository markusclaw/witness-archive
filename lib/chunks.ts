/**
 * Splitting a testimony into translation-sized runs of whole paragraphs.
 * Pure and shared by the server (which translates chunk by chunk) and the
 * page (which renders finished chunks while the rest is still in flight),
 * so both sides always agree on where the seams are.
 */

/** Roughly how many words go into one translation call. */
const CHUNK_WORDS = 600;

/** Split content into runs of whole paragraphs of about CHUNK_WORDS each. */
export function chunkParagraphs(content: string, target = CHUNK_WORDS): string[] {
  const paragraphs = content.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current: string[] = [];
  let words = 0;
  for (const p of paragraphs) {
    const n = p.split(/\s+/).length;
    if (current.length && words + n > target) {
      chunks.push(current.join("\n\n"));
      current = [];
      words = 0;
    }
    current.push(p);
    words += n;
  }
  if (current.length) chunks.push(current.join("\n\n"));
  return chunks;
}

