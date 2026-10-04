import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminSupabase } from "@/lib/supabase-admin";
import { screenPrayerText } from "@/lib/prayer-screen";
import { PRAYER_CATEGORIES } from "@/lib/prayer";
import { isSupportedLanguage } from "@/lib/languages";

export const dynamic = "force-dynamic";

type Body =
  | { action: "request"; title?: unknown; body?: unknown; anonymous?: unknown }
  | { action: "title"; requestId?: unknown; title?: unknown; category?: unknown }
  | { action: "reply"; requestId?: unknown; content?: unknown; displayName?: unknown }
  | { action: "answer"; requestId?: unknown; answer?: unknown }
  | { action: "status"; requestId?: unknown; status?: unknown }
  | { action: "review"; requestId?: unknown; replyId?: unknown; decision?: unknown };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** If the assistant couldn't offer a title: the first clause of the request. */
function fallbackTitle(text: string): string {
  const first = text.split(/[.!?\n]/)[0].trim();
  const words = first.split(/\s+/).slice(0, 8).join(" ");
  return (words.length >= 3 ? words : "A prayer request").slice(0, 120);
}

/**
 * Every write to the prayer wall comes through here: the member is verified
 * from their token, the text is screened, and the row is written with the
 * service role (clients have no insert policy, by design).
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Sign in to post on the prayer wall." }, { status: 401 });
  const {
    data: { user },
    error: userError,
  } = await createServerSupabase().auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "The prayer wall is not configured on this server." }, { status: 503 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: profile } = await admin.from("profiles").select("display_name, role").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.role === "admin";
  const myName = str(profile?.display_name, 80) || str((user.user_metadata as { display_name?: string } | null)?.display_name, 80) || (user.email ?? "Member").split("@")[0];

  if (body.action === "request") {
    const text = str(body.body, 3000);
    const anonymous = body.anonymous === true;
    if (text.length < 10) return NextResponse.json({ error: "Tell us a little more — at least a sentence." }, { status: 400 });

    // One Claude call screens the post and reads its language, kind and a title.
    const screen = await screenPrayerText("request", text);
    const givenTitle = str(body.title, 120);
    const title = givenTitle.length >= 3 ? givenTitle : screen.title && screen.title.length >= 3 ? screen.title : fallbackTitle(text);
    const category = PRAYER_CATEGORIES.some((c) => c.slug === screen.category) ? (screen.category as string) : "other";
    const language = screen.language && isSupportedLanguage(screen.language) ? screen.language : "en";

    const { data, error } = await admin
      .from("prayer_requests")
      .insert({ user_id: user.id, display_name: anonymous ? null : myName, anonymous, title, body: text, category, language, review: screen.hold ? "held" : "clear", review_note: screen.hold ? screen.reason : null })
      .select("*")
      .single();
    if (error || !data) {
      console.error("prayer request:", error?.message);
      return NextResponse.json({ error: "Couldn't save your request. Try again in a moment." }, { status: 500 });
    }
    return NextResponse.json({ request: data, held: screen.hold, crisis: screen.crisis });
  }

  if (body.action === "title") {
    const requestId = str(body.requestId, 64);
    const title = str(body.title, 120);
    if (title.length < 3) return NextResponse.json({ error: "A title needs at least a few letters." }, { status: 400 });
    const { data: target } = await admin.from("prayer_requests").select("id, user_id").eq("id", requestId).maybeSingle();
    if (!target || (target.user_id !== user.id && !isAdmin)) return NextResponse.json({ error: "Not your request." }, { status: 403 });
    const category = PRAYER_CATEGORIES.some((c) => c.slug === body.category) ? (body.category as string) : undefined;
    const { error } = await admin.from("prayer_requests").update({ title, ...(category ? { category } : {}) }).eq("id", requestId);
    if (error) return NextResponse.json({ error: "Couldn't rename it." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reply") {
    const requestId = str(body.requestId, 64);
    const content = str(body.content, 1000);
    if (!requestId || content.length < 1) return NextResponse.json({ error: "Write a word first." }, { status: 400 });
    const { data: target } = await admin.from("prayer_requests").select("id, review, status").eq("id", requestId).maybeSingle();
    if (!target || target.review !== "clear") return NextResponse.json({ error: "That request isn't open for replies." }, { status: 404 });
    const screen = await screenPrayerText("reply", content);
    const { data, error } = await admin
      .from("prayer_replies")
      .insert({ request_id: requestId, user_id: user.id, author: myName, content, review: screen.hold ? "held" : "clear" })
      .select("*")
      .single();
    if (error || !data) {
      console.error("prayer reply:", error?.message);
      return NextResponse.json({ error: "Couldn't post your reply. Try again in a moment." }, { status: 500 });
    }
    return NextResponse.json({ reply: data, held: screen.hold, crisis: screen.crisis });
  }

  if (body.action === "answer" || body.action === "status") {
    const requestId = str(body.requestId, 64);
    const { data: target } = await admin.from("prayer_requests").select("id, user_id").eq("id", requestId).maybeSingle();
    if (!target || (target.user_id !== user.id && !isAdmin)) return NextResponse.json({ error: "Not your request." }, { status: 403 });
    if (body.action === "status") {
      const status = body.status === "open" || body.status === "closed" ? body.status : null;
      if (!status) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      const { error } = await admin.from("prayer_requests").update({ status }).eq("id", requestId);
      if (error) return NextResponse.json({ error: "Couldn't update." }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    const answer = str(body.answer, 3000);
    if (answer.length < 5) return NextResponse.json({ error: "Tell us what happened — a sentence or two." }, { status: 400 });
    const screen = await screenPrayerText("answer", answer);
    // An answer that needs review holds the whole request until an admin clears it.
    const { data, error } = await admin
      .from("prayer_requests")
      .update({ answer, status: "answered", answered_at: new Date().toISOString(), ...(screen.hold ? { review: "held", review_note: screen.reason } : {}) })
      .eq("id", requestId)
      .select("*")
      .single();
    if (error || !data) return NextResponse.json({ error: "Couldn't save the answer." }, { status: 500 });
    return NextResponse.json({ request: data, held: screen.hold, crisis: screen.crisis });
  }

  if (body.action === "review") {
    if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
    const decision = body.decision === "clear" || body.decision === "removed" ? body.decision : null;
    if (!decision) return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
    const replyId = str(body.replyId, 64);
    const requestId = str(body.requestId, 64);
    const table = replyId ? "prayer_replies" : "prayer_requests";
    const id = replyId || requestId;
    if (!id) return NextResponse.json({ error: "Nothing to review." }, { status: 400 });
    const { error } = await admin.from(table).update({ review: decision }).eq("id", id);
    if (error) return NextResponse.json({ error: "Couldn't update." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
