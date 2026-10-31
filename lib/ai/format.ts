import { callClaude, ClaudeError } from "@/lib/ai/claude";

export const FORMAT_MAX_CHARS = 60_000;

export const FORMAT_PROMPT = `You are a careful copy editor for Witness Archive, a collection of first-person testimonies about profound personal and spiritual experiences.

Your only job is to improve READABILITY of the text you are given. You must preserve the author's meaning, voice, facts, chronology, names, and every claim exactly as written.

You MAY:
- fix spelling, punctuation, and grammar
- break wall-of-text into paragraphs at natural pauses (separate paragraphs with a blank line)
- untangle a run-on sentence when the meaning is unambiguous
- remove accidental duplicated words or transcription artifacts ("um", "uh", repeated phrases)
- remove leftover video-transcript artifacts: timestamps such as "0:1515 seconds" or "[1:02]", caption cue numbers, and line breaks that fall mid-sentence (join them back into sentences)
- normalize quotation marks and capitalization

You MUST NOT:
- add, remove, soften, strengthen, or reinterpret any detail, claim, or emotion
- summarize, shorten for length, or "improve" the story
- change first person to third person, or alter the author's tone or dialect
- add headings, titles, bullet points, markdown, or commentary inside the text
- invent transitions or sentences that were not there

If a passage is unclear and you cannot fix it without guessing at the meaning, leave it as written and mention it in a note instead.

Respond in exactly this format and nothing else:

<formatted>
the full edited text, with blank lines between paragraphs
</formatted>
<notes>
- one short, warm, specific observation or suggestion for the author
- another, if needed
</notes>

Notes are optional and should be few (0–4); leave the notes block empty if there is nothing worth saying. They are for things you deliberately did not change: a passage that might read clearer if the author restructured it, an ambiguity only they can resolve, or a place where the timeline was hard to follow. Never be critical of the experience itself.`;

/** One formatting pass over text the model can handle in a single call. */
export async function formatText(content: string, model?: string): Promise<{ formatted: string; notes: string[] }> {
  const text = await callClaude({ system: FORMAT_PROMPT, user: `Here is the testimony text:\n\n<testimony>\n${content}\n</testimony>`, maxTokens: 24_000, model });
  const parsed = parseSuggestion(text);
  if (!parsed) throw new ClaudeError("The assistant's reply couldn't be read.", "unparseable");
  return parsed;
}

/** Model for bulk transcript formatting (imports). Cheaper than the default; override with IMPORT_FORMAT_MODEL. */
export function importFormatModel(): string {
  return process.env.IMPORT_FORMAT_MODEL ?? "claude-haiku-4-5";
}

/**
 * A formatted piece should keep nearly all of the words. If a cheaper model
 * shortened or summarized it, the piece is redone with the default model.
 */
export function lostTooMuch(original: string, formatted: string): boolean {
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const before = words(original);
  return before > 200 && words(formatted) < before * 0.8;
}

/**
 * Format a transcript of any length: split into pieces of about `pieceChars`,
 * format them in parallel, and join. Long videos finish in the time of one
 * piece instead of one very long call. With `model`, each piece uses that
 * model and falls back to the default model if it came back noticeably short
 * or unreadable.
 */
export async function formatLongText(content: string, opts: { pieceChars?: number; model?: string } = {}): Promise<{ formatted: string; notes: string[]; fallbacks: number }> {
  const pieces = splitForFormatting(content, opts.pieceChars ?? 14_000);
  let fallbacks = 0;
  const results = await Promise.all(
    pieces.map(async (p) => {
      if (!opts.model) return formatText(p);
      try {
        const r = await formatText(p, opts.model);
        if (!lostTooMuch(p, r.formatted)) return r;
      } catch (err) {
        if (err instanceof ClaudeError && err.kind === "not_configured") throw err;
      }
      fallbacks++;
      return formatText(p);
    }),
  );
  return { formatted: results.map((r) => r.formatted).join("\n\n"), notes: results.flatMap((r) => r.notes).slice(0, 6), fallbacks };
}

export function splitForFormatting(content: string, pieceChars: number): string[] {
  if (content.length <= pieceChars * 1.3) return [content];
  const pieces: string[] = [];
  let rest = content;
  while (rest.length > pieceChars * 1.3) {
    const window = rest.slice(0, pieceChars);
    // Best cut: a line break, then a sentence end, then any space — in the last half of the window.
    const min = Math.floor(pieceChars / 2);
    const at = (re: RegExp) => {
      let best = -1;
      for (const m of window.matchAll(re)) if ((m.index ?? 0) >= min) best = (m.index ?? 0) + m[0].length;
      return best;
    };
    let cut = at(/\n/g);
    if (cut < 0) cut = at(/[.!?…]["»”)]?\s/g);
    if (cut < 0) cut = at(/\s/g);
    if (cut < 0) cut = pieceChars;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut);
  }
  if (rest.trim()) pieces.push(rest.trim());
  return pieces;
}

export function parseSuggestion(text: string): { formatted: string; notes: string[] } | null {
  const f = text.match(/<formatted>\s*([\s\S]*?)\s*<\/formatted>/i);
  if (!f || !f[1].trim()) return null;
  const n = text.match(/<notes>\s*([\s\S]*?)\s*<\/notes>/i);
  const notes = n
    ? n[1]
        .split(/\n/)
        .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];
  return { formatted: f[1].trim(), notes };
}

export function normalizeSpace(s: string) {
  return s.replace(/\s+/g, " ").trim();
}
