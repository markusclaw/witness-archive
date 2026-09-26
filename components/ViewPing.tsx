"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/** Counts one view per visitor per testimony per day. Fires only in a real browser, after render. */
export default function ViewPing({ id }: { id: string }) {
  useEffect(() => {
    const key = `wa:viewed:${id}:${new Date().toISOString().slice(0, 10)}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      /* private mode: count anyway */
    }
    const t = window.setTimeout(() => {
      supabase.rpc("record_view", { p_id: id }).then(({ error }) => {
        if (error) console.error("record_view:", error.message);
      });
    }, 1500); // a real read, not a bounce
    return () => window.clearTimeout(t);
  }, [id]);
  return null;
}
