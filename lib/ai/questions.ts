/**
 * Questions, with the assistant:
 *   tagQuestions — which of the archive's questions a testimony speaks to (0–3)
 *   summarizeQuestion — "What witnesses report": patterns across the tagged testimonies
 * Server only.
 */
import { callClaude, ClaudeError } from "@/lib/ai/claude";
import { QUESTIONS, QUESTION_SLUGS, type Question } from "@/lib/questions";

const TAG_PROMPT = `You sort first-person testimonies for Witness Archive by the big questions they speak to. A testimony speaks to a question when the experience itself is evidence someone could weigh on that question — not when the question is only mentioned in passing.

The questions (slug — question — what counts):
${QUESTIONS.map((q) => `- ${q.slug} — ${q.q} — ${q.tagHint}`).join("\n")}

Pick at most 3, most relevant first. Pick none if the text doesn't really speak to any (for example a general sermon or teaching with no experience in it). Return ONLY JSON: {"questions": ["slug", …]}`;

export function tagModel(): string {
  return process.env.QUESTION_TAG_MODEL ?? "claude-haiku-4-5";
}

export async function tagQuestions(t: { title: string; description?: string | null; category?: string | null; content?: string | null }): Promise<string[]> {
  const text = await callClaude({
    system: TAG_PROMPT,
    model: tagModel(),
    maxTokens: 200,
    timeoutMs: 60_000,
    user: `Title: ${t.title}\nCategory: ${t.category ?? ""}\nSummary: ${t.description ?? ""}\n\n<testimony>\n${(t.content ?? "").slice(0, 8_000)}\n</testimony>`,
  });
  const slugs = parseSlugs(text);
  if (!slugs) throw new ClaudeError("The tagger's reply couldn't be read.", "unparseable");
  return slugs;
}

export function parseSlugs(text: string): string[] | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as { questions?: unknown };
    if (!Array.isArray(o.questions)) return null;
    return [...new Set(o.questions.filter((s): s is string => typeof s === "string" && QUESTION_SLUGS.includes(s)))].slice(0, 3);
  } catch {
    return null;
  }
}

export interface Pattern {
  text: string;
  testimony_ids: string[];
}

const SUMMARY_PROMPT = `You write the "What witnesses report" section of a Witness Archive question page. You are given one question and a numbered list of testimonies tagged with it. Describe the recurring patterns across what these witnesses report — what many of them describe, where accounts agree, and notable differences.

Rules:
- Report, never assert. Write "Witnesses describe…", "Several say…", "One account…". Never state the claims as established fact and never add your own theology or opinion.
- Only use what is in the testimonies. Every pattern must cite the testimony numbers it comes from.
- 3 to 6 patterns, each one or two plain sentences. No names of living private people beyond what the testimony titles show.
- If the testimonies disagree, say so plainly.

Return ONLY JSON: {"patterns": [{"text": "…", "testimonies": [1, 4, 7]}, …]}`;

export async function summarizeQuestion(q: Question, items: { id: string; title: string; description: string | null; content: string | null }[]): Promise<Pattern[]> {
  const list = items
    .map((t, i) => `[${i + 1}] ${t.title}\n${t.description ?? ""}\n${(t.content ?? "").replace(/\s+/g, " ").slice(0, 1_500)}`)
    .join("\n\n");
  const text = await callClaude({
    system: SUMMARY_PROMPT,
    maxTokens: 1_500,
    timeoutMs: 120_000,
    user: `Question: ${q.q}\n\n<testimonies>\n${list}\n</testimonies>`,
  });
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new ClaudeError("The summary couldn't be read.", "unparseable");
  try {
    const o = JSON.parse(m[0]) as { patterns?: { text?: unknown; testimonies?: unknown }[] };
    return (o.patterns ?? [])
      .map((p) => ({
        text: typeof p.text === "string" ? p.text.trim().slice(0, 600) : "",
        testimony_ids: (Array.isArray(p.testimonies) ? p.testimonies : [])
          .map((n) => items[Number(n) - 1]?.id)
          .filter((id): id is string => !!id),
      }))
      .filter((p) => p.text)
      .slice(0, 6);
  } catch {
    throw new ClaudeError("The summary couldn't be read.", "unparseable");
  }
}
