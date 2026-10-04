"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PrayerOwnerPanel from "@/components/PrayerOwnerPanel";
import { prayerCategory } from "@/lib/prayer";
import type { PrayerRequest } from "@/lib/types";

/**
 * A request the public can't see yet (held for review) is still visible to
 * its author and to admins: their session passes RLS where the server's anon
 * client did not.
 */
export default function HeldPrayerView({ id }: { id: string }) {
  const [r, setR] = useState<PrayerRequest | null | undefined>(undefined);
  useEffect(() => {
    supabase
      .from("prayer_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setR((data as PrayerRequest | null) ?? null));
  }, [id]);
  if (r === undefined) return <main className="mx-auto max-w-3xl px-5 py-12 text-parchment-500">Loading…</main>;
  if (!r) notFound();
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <PrayerOwnerPanel r={r} />
      <span className="chip">{prayerCategory(r.category).name}</span>
      <h1 className="font-display mt-4 text-4xl font-light leading-tight text-parchment-50">{r.title}</h1>
      <div className="prose-testimony mt-8 whitespace-pre-wrap">{r.body}</div>
      {r.answer && <p className="mt-6 border-l-2 border-gold-500/50 pl-3 text-parchment-100">{r.answer}</p>}
    </main>
  );
}
