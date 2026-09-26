"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function AuthNav() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!user) {
    return (
      <Link href="/auth" className="hover:text-blue-400 transition">
        Sign In
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-slate-400 hidden sm:inline">{user.email}</span>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          router.push("/");
        }}
        className="hover:text-blue-400 transition"
      >
        Sign Out
      </button>
    </div>
  );
}
