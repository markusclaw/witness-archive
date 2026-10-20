/**
 * Place word-map entries on a verse. Shared logic with lib/align.ts (the
 * reader uses the stored token positions; keep the tokenizer identical).
 */
export const WORD = /[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu;

export function wordTokens(text) {
  return [...text.matchAll(WORD)].map((m) => m[0]);
}

const norm = (s) => s.toLowerCase().replace(/’/g, "'");

/**
 * Find each entry's phrase in the verse, in reading order (falling back to the
 * first unused place if the model listed it out of order). Returns entries
 * with i (index of the first word token) and n (number of word tokens).
 */
export function matchAlignment(text, map) {
  const toks = wordTokens(text).map(norm);
  const used = new Array(toks.length).fill(false);
  const kept = [];
  const dropped = [];
  let cursor = 0;
  const fits = (at, ws) => ws.every((w, k) => at + k < toks.length && !used[at + k] && toks[at + k] === w);
  for (const m of map) {
    const ws = wordTokens(m.w).map(norm);
    if (!ws.length) {
      dropped.push(m);
      continue;
    }
    let at = -1;
    for (let j = cursor; j <= toks.length - ws.length && at < 0; j++) if (fits(j, ws)) at = j;
    for (let j = 0; j <= toks.length - ws.length && at < 0; j++) if (fits(j, ws)) at = j;
    if (at < 0) {
      dropped.push(m);
      continue;
    }
    for (let k = 0; k < ws.length; k++) used[at + k] = true;
    cursor = at + ws.length;
    kept.push({ w: m.w, h: m.h, i: at, n: ws.length });
  }
  return { kept, dropped };
}
