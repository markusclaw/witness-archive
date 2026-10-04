/**
 * Screens a prayer-wall post before it is published. Almost everything is
 * cleared instantly; the screener only holds the few things a human should
 * see first, and flags crisis language so the page can offer help kindly.
 * If Claude is unreachable the post is held rather than published blind.
 */

export interface ScreenResult {
  hold: boolean;
  /** The person may be in immediate danger (self-harm, suicide). Always held; the UI shows support. */
  crisis: boolean;
  reason: string;
}

const SYSTEM_PROMPT = `You review posts for the prayer wall of Witness Archive, a Christian community site where people share prayer requests, press "I prayed", and leave short words of encouragement.

Decide whether a post can be published immediately or should be held for a human moderator. Be generous: people write about illness, death, addiction, broken marriages, money trouble, doubt, and fear — that is the point of the wall and must be published. Hold ONLY when one of these applies:

- crisis: the writer says they are considering suicide or self-harm, or describes an active plan to hurt themselves (set crisis=true).
- danger: a threat of violence toward a named or identifiable person, or disclosure of ongoing abuse of a child.
- doxxing: a private individual is named with identifying details (full name plus address, phone, employer, school) in a way that could harm them. A first name, or a public figure, is fine.
- spam: advertising, links to products or services, money requests with payment details, or obviously off-topic content.
- hate: slurs or dehumanizing language about a group of people.
- harassment: the post exists to attack another member or a specific person.

Everything else is cleared, including strong emotion, grief, anger at God, doubt, unusual theology, and mentions of past self-harm or past abuse that are told as history.

Respond with only JSON: {"hold": boolean, "crisis": boolean, "reason": "one short sentence"}`;

export async function screenPrayerText(kind: "request" | "reply" | "answer", text: string): Promise<ScreenResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { hold: true, crisis: false, reason: "Screening is not configured." };
  const model = process.env.ANTHROPIC_SCREEN_MODEL ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: 200,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Post type: ${kind}\n\n<post>\n${text.slice(0, 6000)}\n</post>` }],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { content?: { text?: string }[]; error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message ?? String(res.status));
    const raw = (json.content ?? []).map((c) => c.text ?? "").join("");
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("unparseable screen response");
    const parsed = JSON.parse(m[0]) as Partial<ScreenResult>;
    const crisis = parsed.crisis === true;
    return { hold: parsed.hold === true || crisis, crisis, reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 300) : "" };
  } catch (err) {
    console.error("screenPrayerText:", err instanceof Error ? err.message : err);
    return { hold: true, crisis: false, reason: "Screening was unavailable; held for review." };
  }
}
