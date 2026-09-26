"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { displayNameFor } from "@/lib/user";

export default function AuthNav() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
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

  // Reserve the space while the session resolves to avoid layout shift.
  if (user === undefined) {
    return <span className="inline-block h-8 w-16" aria-hidden />;
  }

  if (!user) {
    return (
      <Link href="/auth" className="btn btn-ghost !px-4 !py-1.5 text-sm">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-parchment-500 sm:inline">{displayNameFor(user)}</span>
      <button
        type="button"
        onClick={async () => {
          await supabase.auth.signOut();
          router.push("/");
          router.refresh();
        }}
        className="btn btn-ghost !px-4 !py-1.5 text-sm"
      >
        Sign out
      </button>
    </div>
  );
}
