import { CATEGORIES } from "@/lib/categories";
import { callClaude, ClaudeError } from "@/lib/ai/claude";
import type { DatePrecision, ExtractedDetails } from "@/lib/types";

export const EXTRACT_MAX_CHARS = 60_000;

export const EXTRACT_PROMPT = `You read a first-person testimony for Witness Archive and pull out the facts that belong in its catalog record. You never invent anything: every value must be supported by the text, and you quote the supporting phrase as evidence. When the text does not say, return null.

Return ONLY a JSON object with exactly these keys:
{
  "witness": { "name": "<the person the experience happened to, as named in the text — e.g. from 'My name is Maria Santoso'>", "first_person": true|false, "evidence": "<quoted phrase>" } or null,
  "source": "<ministry, church, channel, interviewer or book credited in the text>" or null,
  "titles": [three short title options, 3–8 words each, plain and specific, no clickbait, no quotation marks, Title Case],
  "description": one sentence (max 160 characters) summarizing what happened, in third person, no spoilers about the ending,
  "category": one of ${JSON.stringify(CATEGORIES.map((c) => c.name))} or null,
  "experienced": { "date": "YYYY-MM-DD", "precision": "day" | "month" | "year" | "approx", "confidence": "high" | "low", "evidence": "<quoted phrase>" } or null,
  "location": { "text": "<place as the author wrote it>", "city": string|null, "region": string|null, "country": string|null, "country_code": "<ISO 3166-1 alpha-2>"|null, "confidence": "high" | "low", "evidence": "<quoted phrase>" } or null
}

Rules for "experienced": this is when the experience happened, not when it was written. "April of 1999" → date "1999-04-01", precision "month". "in 1987" → "1987-01-01", precision "year". "about twenty years ago" with no anchor → null. "the summer I turned 30" with no year → null. Only use "day" when the day is stated.
Rules for "location": where the experience happened, not where the author lives now unless it is the same. Infer region/country only when unambiguous (e.g. "Houston" → Texas, United States, US). A hospital name alone is not a location unless its city is known from the text.
Confidence for "experienced" and "location": "high" only when the witness clearly states when / where THEIR central experience happened, in words you can quote. Use "low" when you had to combine clues, when it is unclear whether the time or place belongs to the central experience or to some other part of their life, or when the place is only where they live, grew up or were speaking from. Never take a date or place from a passing mention: a Bible passage or biblical place ("in Jerusalem", "on the road to Damascus"), another person's story, a sermon illustration, a ministry trip they mention in passing, or the video's upload date. If the only candidates are passing mentions, return null.
Rules for "witness": this is the person who LIVED the experience, not a narrator, interviewer, or the person posting. Use the name exactly as the text gives it (first name only is fine). "first_person" is true when the account is told in the first person by the witness themselves ("I died…"), false when it is retold about someone else ("my grandmother told me…", "this is the story of…"). If no name is given, return null even when first person.
If <video_metadata> is present, you may use it for the witness name, the source (channel), and to anchor relative dates — but the testimony text always wins when they disagree.
Rules for "source": only when the text or the video metadata credits where it came from ("interviewed by…", "as told on…", a channel or ministry name). Never guess.
Category: pick the single best fit for the central experience. Near-death with a heaven vision → "Heaven" if heaven is the focus, otherwise "Near-Death Experience".`;

export interface ExtractVideoContext {
  title?: string | null;
  channel?: string | null;
  publishedAt?: string | null;
  description?: string | null;
}

export async function extractDetails(content: string, opts: { title?: string; video?: ExtractVideoContext } = {}): Promise<ExtractedDetails> {
  const v = opts.video ?? {};
  const videoContext = [
    v.title?.trim() ? `Video title: ${v.title.trim()}` : null,
    v.channel?.trim() ? `Channel: ${v.channel.trim()}` : null,
    v.publishedAt ? `Video published: ${v.publishedAt.slice(0, 10)} (this is when it was uploaded, NOT when the experience happened — use it only to anchor relative dates like "three years ago")` : null,
    v.description?.trim() ? `Video description:\n${v.description.trim().slice(0, 3000)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const title = opts.title?.trim();
  const text = await callClaude({
    system: EXTRACT_PROMPT,
    maxTokens: 1_500,
    user: `${title ? `Working title from the author: ${title}\n\n` : ""}${videoContext ? `<video_metadata>\n${videoContext}\n</video_metadata>\n\n` : ""}<testimony>\n${content.slice(0, EXTRACT_MAX_CHARS)}\n</testimony>`,
  });
  const parsed = parseExtracted(text);
  if (!parsed) throw new ClaudeError("The assistant's reply couldn't be read.", "unparseable");
  return parsed;
}

export function parseExtracted(text: string): ExtractedDetails | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const o = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const str = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
    const titles = Array.isArray(o.titles) ? o.titles.map((t) => str(t, 120)).filter((t): t is string => !!t).slice(0, 3) : [];
    const categoryName = str(o.category);
    const category = categoryName && CATEGORIES.some((c) => c.name === categoryName) ? categoryName : null;

    let experienced: ExtractedDetails["experienced"] = null;
    if (o.experienced && typeof o.experienced === "object") {
      const e = o.experienced as Record<string, unknown>;
      const date = str(e.date, 10);
      const precision = str(e.precision, 10) as DatePrecision | null;
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && precision && ["day", "month", "year", "approx"].includes(precision)) {
        experienced = { date, precision, evidence: str(e.evidence) ?? "", confidence: e.confidence === "high" ? "high" : "low" };
      }
    }

    let location: ExtractedDetails["location"] = null;
    if (o.location && typeof o.location === "object") {
      const l = o.location as Record<string, unknown>;
      const textv = str(l.text, 160);
      if (textv) {
        const cc = str(l.country_code, 2);
        location = {
          text: textv,
          city: str(l.city, 80),
          region: str(l.region, 80),
          country: str(l.country, 80),
          country_code: cc && /^[A-Za-z]{2}$/.test(cc) ? cc.toUpperCase() : null,
          evidence: str(l.evidence) ?? "",
          confidence: l.confidence === "high" ? "high" : "low",
        };
      }
    }

    let witness: ExtractedDetails["witness"] = null;
    if (o.witness && typeof o.witness === "object") {
      const w = o.witness as Record<string, unknown>;
      const name = str(w.name, 80);
      if (name && !/^(unknown|anonymous|null|none)$/i.test(name)) {
        witness = { name, first_person: w.first_person !== false, evidence: str(w.evidence) ?? "" };
      }
    }
    const source = str(o.source, 120);

    return { titles, witness, source, description: str(o.description, 200), category, experienced, location };
  } catch {
    return null;
  }
}
