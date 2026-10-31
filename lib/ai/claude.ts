/** Minimal Anthropic Messages call shared by the writing assistants and the import runner. Server only. */

export class ClaudeError extends Error {
  constructor(
    message: string,
    public readonly kind: "not_configured" | "network" | "api" | "unparseable",
    public readonly status?: number,
  ) {
    super(message);
  }
}

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
}

export async function callClaude(opts: { system: string; user: string; maxTokens: number; timeoutMs?: number; model?: string }): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ClaudeError("The assistant is not configured on this server.", "not_configured");
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  let res: Response;
  try {
    res = await fetch(process.env.ANTHROPIC_API_URL ?? "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: opts.maxTokens, temperature: 0, system: opts.system, messages: [{ role: "user", content: opts.user }] }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 300_000),
    });
  } catch (err) {
    throw new ClaudeError(`Couldn't reach the assistant: ${err instanceof Error ? err.message : "network error"}`, "network");
  }
  const json = (await res.json().catch(() => ({}))) as AnthropicResponse;
  if (!res.ok) throw new ClaudeError(`The assistant returned an error (${res.status}): ${json.error?.message ?? "unknown"}`, "api", res.status);
  return (json.content ?? []).map((c) => c.text ?? "").join("");
}
