"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/categories";
import { extractYouTubeId } from "@/lib/youtube";

export default function SubmitForm() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [creator, setCreator] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].name);
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const videoOk = !videoUrl.trim() || !!extractYouTubeId(videoUrl);
  const hasBody = !!videoUrl.trim() || transcript.trim().length >= 200;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.from("submissions").insert({
      user_id: user.id,
      title: title.trim(),
      video_url: videoUrl.trim() || null,
      creator: creator.trim(),
      category,
      transcript: transcript.trim(),
      notes: notes.trim() || null,
    });
    if (error) {
      console.error("submission:", error.message);
      setError("We couldn't save your submission. Please try again in a moment.");
      setSubmitting(false);
      return;
    }
    setDone(true);
    setSubmitting(false);
  };

  if (user === undefined) return null;

  if (!user) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-2xl text-parchment-50">Sign in to submit</p>
        <p className="mt-2 text-parchment-500">
          We ask for an account so we can follow up with questions before publishing.
        </p>
        <Link href="/auth?next=/submit" className="btn btn-primary mt-6">
          Sign in or create an account
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card p-10 text-center">
        <p className="eyebrow mb-3">Received</p>
        <p className="font-display text-3xl text-parchment-50">Thank you.</p>
        <p className="mx-auto mt-3 max-w-md text-parchment-500">
          Your submission is in the queue. Someone will read it, tidy the formatting if needed, and reach out
          if we have questions before it goes live.
        </p>
        <Link href="/archive" className="btn btn-ghost mt-8">
          Back to the archive
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-6 p-6 sm:p-8">
      <Field label="Title" htmlFor="title" hint="A short, plain description. We may edit it for clarity.">
        <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} placeholder="e.g. What I saw during my heart surgery" />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Whose testimony is this?" htmlFor="creator" hint="Your name, or the original creator's channel.">
          <input id="creator" className="input" value={creator} onChange={(e) => setCreator(e.target.value)} required maxLength={80} placeholder="Name or channel" />
        </Field>
        <Field label="Kind of encounter" htmlFor="category">
          <select id="category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="YouTube link"
        htmlFor="video"
        hint="Optional. We embed from the public source; nothing is re-uploaded."
        error={!videoOk ? "That doesn't look like a YouTube link." : undefined}
      >
        <input id="video" className="input" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" inputMode="url" />
      </Field>

      <Field
        label="Written account or transcript"
        htmlFor="transcript"
        hint={
          videoUrl.trim()
            ? "Optional with a video, but strongly encouraged — it makes the testimony searchable and readable."
            : "Required without a video. Rough notes are fine; we'll help with formatting and grammar."
        }
      >
        <textarea id="transcript" className="input resize-y" rows={12} value={transcript} onChange={(e) => setTranscript(e.target.value)} maxLength={50000} placeholder="Start wherever feels right…" />
        <p className="mt-1 text-right text-xs text-parchment-700">{transcript.trim().split(/\s+/).filter(Boolean).length} words</p>
      </Field>

      <Field label="Anything we should know?" htmlFor="notes" hint="Optional — context, a request for anonymity, a link to the original interview.">
        <textarea id="notes" className="input resize-y" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
      </Field>

      <label className="flex items-start gap-3 text-sm text-parchment-300">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-gold-500" required />
        <span>
          This is a first-hand account, and I have the right to share it. I understand a person will review it and may edit it for clarity before publishing.
        </span>
      </label>

      {error && <p className="text-sm text-ember-500">{error}</p>}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-parchment-700">{hasBody ? "" : "Add a video link or at least ~200 characters of written account."}</p>
        <button type="submit" disabled={submitting || !consent || !videoOk || !hasBody} className="btn btn-primary">
          {submitting ? "Sending…" : "Submit for review"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-parchment-100">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-ember-500">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-parchment-700">{hint}</p>
      ) : null}
    </div>
  );
}
