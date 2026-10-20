/**
 * The reader's side of the word maps: split a verse into words and spaces the
 * same way scripts/vt/align-match.mjs does, so stored token positions line up.
 */
export const WORD = /[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu;

export type Piece = { text: string; word: number | null };

/** The verse as alternating pieces; word pieces carry their token index. */
export function pieces(text: string): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(WORD)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), word: null });
    out.push({ text: m[0], word: n++ });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), word: null });
  return out;
}
