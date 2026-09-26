"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { compactNumber } from "@/lib/format";

export default function HeartButton({ testimonyId, initialCount }: { testimonyId: string; initialCount: number }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [hearted, setHearted] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: row } = await supabase.from("hearts").select("testimony_id").eq("testimony_id", testimonyId).eq("user_id", data.user.id).maybeSingle();
        setHearted(!!row);
      }
    });
  }, [testimonyId]);

  const toggle = async () => {
    if (user === undefined) return;
    if (!user) {
      router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    if (hearted) {
      const { error } = await supabase.from("hearts").delete().eq("testimony_id", testimonyId).eq("user_id", user.id);
      if (!error) {
        setHearted(false);
        setCount((c) => Math.max(0, c - 1));
      }
    } else {
      const { error } = await supabase.from("hearts").insert({ testimony_id: testimonyId, user_id: user.id });
      if (!error) {
        setHearted(true);
        setCount((c) => c + 1);
      }
    }
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={hearted}
      aria-label={hearted ? "Remove your heart" : "Heart this testimony"}
      className={`btn !px-4 !py-1.5 text-xs ${hearted ? "border border-ember-500/60 bg-ember-500/15 text-parchment-50" : "btn-ghost"}`}
    >
      <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${hearted ? "text-ember-500" : ""}`} fill={hearted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 21s-7-4.6-9.3-9A5.3 5.3 0 0 1 12 6.6 5.3 5.3 0 0 1 21.3 12C19 16.4 12 21 12 21z" strokeLinejoin="round" />
      </svg>
      {count > 0 ? compactNumber(count) : "Heart"}
    </button>
  );
}
