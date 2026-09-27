import { NextResponse } from "next/server";
import { isSupportedLanguage } from "@/lib/languages";
import { getTestimonyById } from "@/lib/queries";
import { ensureTranslation, getTranslationState } from "@/lib/translate";

export const dynamic = "force-dynamic";

/**
 * Keep working after the response has been sent. On Cloudflare that needs
 * `ctx.waitUntil`, otherwise the Worker is torn down as soon as it replies;
 * in local `next dev` the Node process simply keeps running the promise.
 */
async function runInBackground(work: Promise<unknown>) {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(work);
  } catch {
    work.catch((err) => console.error("background translation failed:", err));
  }
}

/**
 * POST { id, language } → the cached translation (200), or the running job's
 * progress (202) after starting it if needed. Bounded by (published
 * testimonies × supported languages) and cached forever, so it is safe to
 * leave unauthenticated.
 */
export async function POST(req: Request) {
  let body: { id?: unknown; language?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  const language = typeof body.language === "string" ? body.language.toLowerCase() : "";
  if (!id || !isSupportedLanguage(language)) return NextResponse.json({ error: "Unsupported language." }, { status: 400 });

  const testimony = await getTestimonyById(id);
  if (!testimony) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (testimony.language === language) return NextResponse.json({ error: "That is the original language." }, { status: 400 });

  const pending: Promise<unknown>[] = [];
  const result = await ensureTranslation(testimony, language, (work) => pending.push(work));
  if (!result) return NextResponse.json({ error: "Translation isn't available right now." }, { status: 503 });
  for (const work of pending) await runInBackground(work);

  return NextResponse.json(result, { status: result.status === "ready" ? 200 : 202 });
}

/** GET ?id=&language= → current state, for polling while a job runs. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const language = (url.searchParams.get("language") ?? "").toLowerCase();
  if (!id || !isSupportedLanguage(language)) return NextResponse.json({ error: "Unsupported language." }, { status: 400 });

  const state = await getTranslationState(id, language);
  if (!state) return NextResponse.json({ status: "missing" }, { status: 404 });
  return NextResponse.json(state, { status: state.status === "ready" ? 200 : 202, headers: { "cache-control": "no-store" } });
}
