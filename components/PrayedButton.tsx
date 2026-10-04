"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";

/**
 * "I prayed" — one per member per request. Deliberately not a like: the
 * label says what you did, and pressing it again withdraws it quietly.
 */
export default function PrayedButton({ requestId, initialCount, size = "sm" }: { requestId: string; initialCount: number; size?: "sm" | "md" }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [prayed, setPrayed] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: row } = await supabase.from("prayers").select("request_id").eq("request_id", requestId).eq("user_id", data.user.id).maybeSingle();
        setPrayed(!!row);
      }
    });
  }, [requestId]);

  const toggle = async () => {
    if (user === undefined) return;
    if (!user) {
      router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    if (prayed) {
      const { error } = await supabase.from("prayers").delete().eq("request_id", requestId).eq("user_id", user.id);
      if (!error) {
        setPrayed(false);
        setCount((c) => Math.max(0, c - 1));
      }
    } else {
      const { error } = await supabase.from("prayers").insert({ request_id: requestId, user_id: user.id });
      if (!error) {
        setPrayed(true);
        setCount((c) => c + 1);
        track("prayed", { request_id: requestId });
      }
    }
    setBusy(false);
  };

  const cls = size === "md" ? "btn !px-5 !py-2 text-sm" : "btn !px-4 !py-1.5 text-xs";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={prayed}
      className={`${cls} ${prayed ? "border border-gold-500/70 bg-gold-500/15 text-parchment-50" : "btn-ghost"}`}
    >
      <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${prayed ? "text-gold-400" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M12 3v7m0 0c-2.5 0-4.5 2-4.5 4.5V21h9v-6.5C16.5 12 14.5 10 12 10z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {prayed ? "You prayed" : "I prayed"}
      <span className={`ml-1 rounded-full px-1.5 text-[0.7rem] ${prayed ? "bg-gold-500/20" : "bg-ink-700"}`}>{count}</span>
    </button>
  );
}
