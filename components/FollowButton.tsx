"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export default function FollowButton({ userId, initialCount, size = "sm" }: { userId: string; initialCount?: number; size?: "sm" | "md" }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState(initialCount ?? 0);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user && data.user.id !== userId) {
        const { data: row } = await supabase.from("follows").select("followee_id").eq("follower_id", data.user.id).eq("followee_id", userId).maybeSingle();
        setFollowing(!!row);
      }
    });
  }, [userId]);

  if (user === undefined || user?.id === userId) return null;

  const toggle = async () => {
    if (!user) {
      router.push(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    if (following) {
      const { error } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("followee_id", userId);
      if (!error) {
        setFollowing(false);
        setCount((c) => Math.max(0, c - 1));
      }
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, followee_id: userId });
      if (!error) {
        setFollowing(true);
        setCount((c) => c + 1);
      }
    }
    setBusy(false);
  };

  const cls = size === "md" ? "btn !px-5 !py-2 text-sm" : "btn !px-3 !py-1 text-xs";
  return (
    <button type="button" onClick={toggle} disabled={busy} className={`${cls} ${following ? "btn-ghost" : "btn-primary"}`} aria-pressed={following}>
      {following ? "Following" : "Follow"}
      {initialCount !== undefined && <span className={following ? "text-parchment-500" : "text-ink-950/70"}>· {count}</span>}
    </button>
  );
}
