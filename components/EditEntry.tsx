"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { TESTIMONY_COLUMNS } from "@/lib/queries";
import type { Testimony } from "@/lib/types";
import TestimonyEditor from "@/components/TestimonyEditor";

/** Drafts are invisible to the server (RLS), so the editor loads the row client-side as the signed-in author. */
export default function EditEntry({ id }: { id: string }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "ready"; row: Testimony } | { status: "missing" }>({ status: "loading" });

  useEffect(() => {
    supabase
      .from("testimonies")
      .select(TESTIMONY_COLUMNS)
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setState(data ? { status: "ready", row: data as Testimony } : { status: "missing" }));
  }, [id]);

  if (state.status === "loading") return <p className="text-sm text-parchment-700">Loading…</p>;
  if (state.status === "missing") {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-2xl text-parchment-50">Nothing to edit here.</p>
        <p className="mt-2 text-parchment-500">Either this testimony isn&apos;t yours, or you need to sign in first.</p>
        <Link href={`/auth?next=${encodeURIComponent(`/testimony/${id}/edit`)}`} className="btn btn-ghost mt-6">
          Sign in
        </Link>
      </div>
    );
  }
  return <TestimonyEditor existing={state.row} />;
}
