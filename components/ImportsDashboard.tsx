"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { timeAgo } from "@/lib/format";

type Status = "queued" | "processing" | "published" | "duplicate" | "skipped" | "failed" | "blocked";

interface JobView {
  id: string;
  youtube_id: string;
  url: string;
  status: Status;
  reason: string | null;
  transcript_source: string | null;
  flags: string[];
  flag_labels: string[];
  flag_notes: Record<string, unknown>;
  needs_review: boolean;
  attempts: number;
  next_attempt_at: string | null;
  created_at: string;
  finished_at: string | null;
  testimony: { id: string; title: string; url: string; category: string } | null;
}

const TABS: { key: string; label: string; query: string }[] = [
  { key: "review", label: "Needs review", query: "needs_review=true" },
  { key: "queue", label: "Queue", query: "status=queued,processing,blocked" },
  { key: "problems", label: "Skipped & failed", query: "status=skipped,failed" },
  { key: "published", label: "Published", query: "status=published,duplicate" },
  { key: "all", label: "All", query: "" },
];

const STATUS_STYLE: Record<Status, string> = {
  queued: "text-parchment-300",
  processing: "text-gold-400",
  published: "text-emerald-300",
  duplicate: "text-parchment-500",
  skipped: "text-parchment-500",
  failed: "text-ember-500",
  blocked: "text-gold-400",
};

const STATUS_LABEL: Record<Status, string> = {
  queued: "Queued",
  processing: "Processing",
  published: "Published",
  duplicate: "Already in archive",
  skipped: "Skipped — no transcript",
  failed: "Failed",
  blocked: "Blocked — will retry",
};

async function authedFetch(path: string, init: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return fetch(path, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${session?.access_token ?? ""}`, "content-type": "application/json" } });
}

/** Import status and review list for videos brought in through the API (Muse). */
export default function ImportsDashboard() {
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [tab, setTab] = useState("review");
  const [jobs, setJobs] = useState<JobView[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [urls, setUrls] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (which: string) => {
    const q = TABS.find((t) => t.key === which)?.query ?? "";
    const res = await authedFetch(`/api/v1/imports?limit=100${q ? `&${q}` : ""}`);
    if (res.status === 401 || res.status === 403) return setState("denied");
    const json = (await res.json()) as { jobs: JobView[]; counts: Record<string, number> };
    setJobs(json.jobs ?? []);
    setCounts(json.counts ?? {});
    setState("ready");
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  const markReviewed = async (id: string) => {
    setBusy(id);
    await authedFetch(`/api/v1/imports/${id}`, { method: "PATCH", body: JSON.stringify({ reviewed: true }) });
    await load(tab);
    setBusy(null);
  };

  const runOne = async () => {
    setBusy("run");
    setMessage("Processing the next video — this can take a minute or two…");
    const res = await authedFetch("/api/v1/imports/run", { method: "POST", body: JSON.stringify({ max: 1 }) });
    const json = (await res.json().catch(() => ({}))) as { processed?: { status: string; testimony: { title: string } | null; reason: string | null }[]; remaining?: { queued: number } };
    const p = json.processed?.[0];
    setMessage(p ? `${STATUS_LABEL[p.status as Status] ?? p.status}${p.testimony ? `: ${p.testimony.title}` : p.reason ? `: ${p.reason}` : ""}. ${json.remaining?.queued ?? 0} left in the queue.` : "Nothing waiting in the queue.");
    await load(tab);
    setBusy(null);
  };

  const queueUrls = async () => {
    const list = urls.split(/\s+/).filter(Boolean);
    if (!list.length) return;
    setBusy("queue");
    const res = await authedFetch("/api/v1/imports", { method: "POST", body: JSON.stringify({ urls: list }) });
    const json = (await res.json().catch(() => ({}))) as { summary?: Record<string, number> };
    setMessage(Object.entries(json.summary ?? {}).map(([k, v]) => `${v} ${k.replace("_", " ")}`).join(" · ") || "Couldn't queue those links.");
    setUrls("");
    await load(tab);
    setBusy(null);
  };

  if (state === "loading") return <p className="text-parchment-500">Loading…</p>;
  if (state === "denied") return <p className="text-parchment-500">This page is for the team.</p>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Needs review", counts.needs_review],
          ["Published", counts.published],
          ["In queue", (counts.queued ?? 0) + (counts.processing ?? 0)],
          ["Blocked", counts.blocked],
          ["Skipped", counts.skipped],
          ["Failed", counts.failed],
          ["Already in archive", counts.duplicate],
        ].map(([label, n]) => (
          <div key={label as string} className="card p-4">
            <p className="text-2xl text-parchment-50">{(n as number) ?? 0}</p>
            <p className="text-xs text-parchment-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="card space-y-3 p-5">
        <label htmlFor="import-urls" className="text-sm text-parchment-300">Add YouTube links (one per line)</label>
        <textarea id="import-urls" className="input min-h-24 w-full" value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={queueUrls} disabled={!!busy || !urls.trim()}>
            Queue
          </button>
          <button type="button" className="btn btn-ghost" onClick={runOne} disabled={!!busy}>
            {busy === "run" ? "Processing…" : "Process next video"}
          </button>
        </div>
        {message && <p className="text-sm text-parchment-500">{message}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`rounded-full border px-3 py-1 text-sm ${tab === t.key ? "border-gold-400 text-gold-400" : "border-parchment-700 text-parchment-500"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {jobs.length === 0 ? (
        <p className="text-parchment-500">{tab === "review" ? "Nothing to review." : "Nothing here."}</p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((j) => (
            <li key={j.id} className="card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className={`text-sm ${STATUS_STYLE[j.status]}`}>{STATUS_LABEL[j.status]}</p>
                <p className="text-xs text-parchment-700">
                  {timeAgo(j.finished_at ?? j.created_at)}
                  {j.transcript_source ? ` · transcript: ${j.transcript_source}` : ""}
                  {j.attempts > 1 ? ` · ${j.attempts} attempts` : ""}
                </p>
              </div>
              {j.testimony ? (
                <p className="mt-1 text-parchment-50">
                  <a href={j.testimony.url} className="hover:text-gold-400">{j.testimony.title}</a>
                  <span className="text-xs text-parchment-500"> · {j.testimony.category}</span>
                </p>
              ) : null}
              <p className="mt-1 text-xs">
                <a href={j.url} target="_blank" rel="noreferrer" className="text-parchment-500 underline">{j.url}</a>
              </p>
              {j.reason && <p className="mt-2 text-sm text-parchment-300">{j.reason}</p>}
              {j.flags.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {j.flags.map((f, i) => (
                    <li key={f} className="text-gold-400">
                      ⚑ {j.flag_labels[i]}
                      <FlagNote note={j.flag_notes[f]} />
                    </li>
                  ))}
                </ul>
              )}
              {j.testimony && (j.needs_review || j.flags.length > 0) && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={`/testimony/${j.testimony.id}/edit`} className="btn btn-ghost">Edit testimony</Link>
                  {j.needs_review && (
                    <button type="button" className="btn btn-ghost" disabled={busy === j.id} onClick={() => markReviewed(j.id)}>
                      Mark reviewed
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FlagNote({ note }: { note: unknown }) {
  if (!note || typeof note !== "object") return null;
  if (Array.isArray(note)) {
    return (
      <span className="block pl-4 text-xs text-parchment-500">
        {note.map((m: { title?: string; url?: string; reasons?: string[] }, i) => (
          <span key={i} className="block">
            Similar: <a href={m.url} className="underline">{m.title}</a> ({(m.reasons ?? []).join(", ").replace(/_/g, " ")})
          </span>
        ))}
      </span>
    );
  }
  const n = note as { suggested?: string; evidence?: string; language?: string };
  return (
    <span className="block pl-4 text-xs text-parchment-500">
      {n.suggested ? `Assistant's guess: ${n.suggested}` : null}
      {n.evidence ? ` — “${n.evidence}”` : null}
      {n.language ? `Language: ${n.language}` : null}
    </span>
  );
}
