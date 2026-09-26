"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

/** A quiet edit link shown only to the testimony's author. */
export default function OwnerBar({ id, authorId }: { id: string; authorId: string | null }) {
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    if (!authorId) return;
    supabase.auth.getUser().then(({ data }) => setIsOwner(data.user?.id === authorId));
  }, [authorId]);
  if (!isOwner) return null;
  return (
    <div className="mb-6 flex items-center justify-between rounded-lg border border-gold-500/30 bg-gold-500/5 px-4 py-2 text-sm">
      <span className="text-parchment-300">This is your testimony.</span>
      <span className="flex gap-3">
        <Link href={`/testimony/${id}/edit`} className="text-gold-400 hover:text-gold-300">Edit</Link>
        <Link href="/me" className="text-gold-400 hover:text-gold-300">Manage</Link>
      </span>
    </div>
  );
}
