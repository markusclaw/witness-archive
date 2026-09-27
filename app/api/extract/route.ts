import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/categories";
import { createServerSupabase } from "@/lib/supabase-server";
import type { DatePrecision, ExtractedDetails } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_CHARS = 60_000;

const SYSTEM_PROMPT = `You read a first-person testimony for Witness Archive and pull out the facts that belong in its catalog record. You never invent anything: every value must be supported by the text, and you quote the supporting phrase as evidence. When the text does not say, return null.

Return ONLY a JSON object with exactly these keys:
{
  "witness": { "name": "<the person the experience happened to, as named in the text — e.g. from 'My name is Maria Santoso'>", "first_person": true|false, "evidence": "<quoted phrase>" } or null,
  "source": "<ministry, church, channel, interviewer or book credited in the text>" or null,
  "titles": [three short title options, 3–8 words each, plain and specific, no clickbait, no quotation marks, Title Case],
  "description": one sentence (max 160 characters) summarizing what happened, in third person, no spoilers about the ending,
  "category": one of ${JSON.stringify(CATEGORIES.map((c) => c.name))} or null,
  "experienced": { "date": "YYYY-MM-DD", "precision": "day" | "month" | "year" | "approx", "evidence": "<quoted phrase>" } or null,
  "location": { "text": "<place as the author wrote it>", "city": string|null, "region": string|null, "country": string|null, "country_code": "<ISO 3166-1 alpha-2>"|null, "evidence": "<quoted phrase>" } or null
}

Rules for "experienced": this is when the experience happened, not when it was written. "April of 1999" → date "1999-04-01", precision "month". "in 1987" → "1987-01-01", precision "year". "about twenty years ago" with no anchor → null. "the summer I turned 30" with no year → null. Only use "day" when the day is stated.
Rules for "location": where the experience happened, not where the author lives now unless it is the same. Infer region/country only when unambiguous (e.g. "Houston" → Texas, United States, US). A hospital name alone is not a location unless its city is known from the text.
Rules for "witness": this is the person who LIVED the experience, not a narrator, interviewer, or the person posting. Use the name exactly as the text gives it (first name only is fine). "first_person" is true when the account is told in the first person by the witness themselves ("I died…"), false when it is retold about someone else ("my grandmother told me…", "this is the story of…"). If no name is given, return null even when first person.
Rules for "source": only when the text itself credits where it came from ("interviewed by…", "as told on…", a channel or ministry name). Never guess.
Category: pick the single best fit for the central experience. Near-death with a heaven vision → "Heaven" if heaven is the focus, otherwise "Near-Death Experience".`;

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "The assistant is not configured on this server." }, { status: 503 });

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Sign in to use the assistant." }, { status: 401 });
  const {
    data: { user },
  } = await createServerSupabase().auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });

  let body: { content?: unknown; title?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (content.length < 200) return NextResponse.json({ error: "Write a little more first — a few paragraphs helps the assistant find the details." }, { status: 400 });

  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: 1_500,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `${title ? `Working title from the author: ${title}\n\n` : ""}<testimony>\n${content.slice(0, MAX_CHARS)}\n</testimony>` }],
      }),
    });
  } catch (err) {
    console.error("extract: fetch failed", err);
    return NextResponse.json({ error: "Couldn't reach the assistant. Try again in a moment." }, { status: 502 });
  }
  const json = (await res.json().catch(() => ({}))) as AnthropicResponse;
  if (!res.ok) {
    console.error("extract: api error", res.status, json.error?.message);
    return NextResponse.json({ error: "The assistant returned an error. Try again in a moment." }, { status: 502 });
  }
  const text = (json.content ?? []).map((c) => c.text ?? "").join("");
  const parsed = parse(text);
  if (!parsed) {
    console.error("extract: unparseable", text.slice(0, 200));
    return NextResponse.json({ error: "The assistant's reply couldn't be read. Try again." }, { status: 502 });
  }
  return NextResponse.json(parsed);
}

function parse(text: string): ExtractedDetails | null {
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
        experienced = { date, precision, evidence: str(e.evidence) ?? "" };
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
