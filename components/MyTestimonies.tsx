"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { TESTIMONY_COLUMNS } from "@/lib/queries";
import type { Testimony } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { testimonyPath } from "@/lib/seo";

export default function MyTestimonies() {
  const params = useSearchParams();
  const justSaved = params.get("saved");
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [rows, setRows] = useState<Testimony[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (u: User) => {
    const { data } = await supabase
      .from("testimonies")
      .select(TESTIMONY_COLUMNS)
      .eq("author_id", u.id)
      .order("series_id")
      .order("part_number");
    setRows((data ?? []) as Testimony[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) void load(data.user);
      else setLoaded(true);
    });
  }, [load]);

  const setStatus = async (row: Testimony, status: Testimony["status"]) => {
    setBusy(row.id);
    const { error } = await supabase.from("testimonies").update({ status }).eq("id", row.id);
    if (!error) setRows((r) => r.map((x) => (x.id === row.id ? { ...x, status } : x)));
    setBusy(null);
  };

  const remove = async (row: Testimony) => {
    if (!window.confirm(`Delete "${row.title}"? This cannot be undone.`)) return;
    setBusy(row.id);
    const { error } = await supabase.from("testimonies").delete().eq("id", row.id);
    if (!error) setRows((r) => r.filter((x) => x.id !== row.id));
    setBusy(null);
  };

  if (user === undefined || !loaded) return <p className="text-sm text-parchment-700">Loading…</p>;
  if (!user) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-2xl text-parchment-50">Sign in to see your testimonies</p>
        <Link href="/auth?next=/me" className="btn btn-primary mt-6">
          Sign in
        </Link>
      </div>
    );
  }

  // Group by series, keep part order.
  const series = new Map<string, Testimony[]>();
  for (const r of rows) series.set(r.series_id, [...(series.get(r.series_id) ?? []), r]);

  return (
    <div className="space-y-8">
      {justSaved && <p className="rounded-lg border border-gold-500/40 bg-gold-500/10 p-3 text-sm text-parchment-100">Draft saved. It&apos;s private until you publish it.</p>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-parchment-500">
          {rows.length} {rows.length === 1 ? "testimony" : "testimonies"} · {rows.filter((r) => r.status === "published").length} published
        </p>
        <div className="flex gap-2">
          <Link href="/settings" className="btn btn-ghost !py-2">Settings</Link>
          <Link href="/submit" className="btn btn-primary !py-2">Write a new one</Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="font-display text-2xl text-parchment-50">You haven&apos;t written anything yet.</p>
          <p className="mt-2 text-parchment-500">When you do, drafts and published testimonies will live here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...series.entries()].map(([sid, parts]) => (
            <div key={sid} className="card overflow-hidden">
              {parts.map((row, i) => (
                <div key={row.id} className={`flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between ${i > 0 ? "border-t border-ink-700" : ""}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {parts.length > 1 && <span className="chip">Part {row.part_number}</span>}
                      <span className={`chip ${row.status === "published" ? "" : "!border-ink-500 !bg-ink-800 !text-parchment-500"}`}>{row.status}</span>
                    </div>
                    <p className="font-display mt-2 truncate text-xl text-parchment-50">{row.title}</p>
                    <p className="mt-1 text-xs text-parchment-700">
                      {row.category} · updated {formatDate(row.updated_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {row.status === "published" && (
                      <Link href={testimonyPath(row)} className="btn btn-ghost !px-3 !py-1.5">
                        View
                      </Link>
                    )}
                    <Link href={`/testimony/${row.id}/edit`} className="btn btn-ghost !px-3 !py-1.5">
                      Edit
                    </Link>
                    <button type="button" disabled={busy === row.id} onClick={() => setStatus(row, row.status === "published" ? "draft" : "published")} className="btn btn-ghost !px-3 !py-1.5">
                      {row.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                    <button type="button" disabled={busy === row.id} onClick={() => remove(row)} className="btn btn-ghost !px-3 !py-1.5 hover:!border-ember-500 hover:!text-ember-500">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              <div className="border-t border-ink-700 bg-ink-900/50 px-5 py-3">
                <Link href={`/submit?series=${sid}`} className="text-sm text-gold-400 hover:text-gold-300">
                  + Add Part {Math.max(...parts.map((p) => p.part_number)) + 1}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
