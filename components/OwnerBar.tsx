"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { LANGUAGES } from "@/lib/languages";

/**
 * A quiet edit link shown only to the testimony's author. While the author is
 * on the page it also warms the translation cache: it walks the translation
 * steps for every other language so readers never wait for them.
 */
export default function OwnerBar({ id, authorId, language, shown, published }: { id: string; authorId: string | null; language: string; shown: string; published: boolean }) {
  const [isOwner, setIsOwner] = useState(false);
  const [warming, setWarming] = useState<string | null>(null);

  useEffect(() => {
    if (!authorId) return;
    supabase.auth.getUser().then(({ data }) => setIsOwner(data.user?.id === authorId));
  }, [authorId]);

  useEffect(() => {
    if (!isOwner || !published) return;
    let cancelled = false;
    // The language being read is driven by the page itself; warm the others.
    const targets = LANGUAGES.filter((l) => l.code !== language && l.code !== shown);
    (async () => {
      for (const l of targets) {
        for (let guard = 0; guard < 60 && !cancelled; guard++) {
          let res: Response;
          try {
            res = await fetch("/api/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, language: l.code }), cache: "no-store" });
          } catch {
            break;
          }
          if (cancelled) return;
          if (res.status === 200) break;
          if (res.status !== 202) break;
          const job = (await res.json()) as { status: string; progress_done: number; progress_total: number; working?: boolean };
          if (job.status !== "pending") break;
          setWarming(`${l.nativeName} ${Math.min(job.progress_done, job.progress_total)}/${job.progress_total}`);
          if (job.working === false) await new Promise((r) => setTimeout(r, 4000));
        }
      }
      if (!cancelled) setWarming(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwner, published, id, language, shown]);

  if (!isOwner) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold-500/30 bg-gold-500/5 px-4 py-2 text-sm">
      <span className="text-parchment-300">
        This is your testimony.
        {warming && <span className="ml-3 text-xs text-gold-500/80">Preparing translations · {warming}</span>}
      </span>
      <span className="flex gap-3">
        <Link href={`/testimony/${id}/edit`} className="text-gold-400 hover:text-gold-300">Edit</Link>
        <Link href="/me" className="text-gold-400 hover:text-gold-300">Manage</Link>
      </span>
    </div>
  );
}
