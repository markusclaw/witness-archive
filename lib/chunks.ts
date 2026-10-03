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


/**
 * Split into runs of whole paragraphs no longer than `maxChars` (speech
 * synthesis requests are byte-capped). A single paragraph longer than the cap
 * is split at sentence ends.
 */
export function chunkParagraphsByChars(content: string, maxChars = 3500): string[] {
  const paragraphs = content.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const units: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= maxChars) {
      units.push(p);
      continue;
    }
    // Sentences first; a sentence that is itself over the cap is split at word boundaries.
    const pieces = p.split(/(?<=[.!?…])\s+/).flatMap((sen) => {
      if (sen.length <= maxChars) return [sen];
      const out: string[] = [];
      let w = "";
      for (const word of sen.split(" ")) {
        if (w && w.length + word.length + 1 > maxChars) {
          out.push(w);
          w = word;
        } else w = w ? `${w} ${word}` : word;
      }
      if (w) out.push(w);
      return out;
    });
    let buf = "";
    for (const s of pieces) {
      if (buf && buf.length + s.length + 1 > maxChars) {
        units.push(buf);
        buf = s;
      } else buf = buf ? `${buf} ${s}` : s;
    }
    if (buf) units.push(buf);
  }
  const chunks: string[] = [];
  let current: string[] = [];
  let len = 0;
  for (const u of units) {
    if (current.length && len + u.length + 2 > maxChars) {
      chunks.push(current.join("\n\n"));
      current = [];
      len = 0;
    }
    current.push(u);
    len += u.length + 2;
  }
  if (current.length) chunks.push(current.join("\n\n"));
  return chunks;
}

/** Small, stable content hash (FNV-1a) so a changed text can be detected cheaply. */
export function contentHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0") + text.length.toString(36);
}
