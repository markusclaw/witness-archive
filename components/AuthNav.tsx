"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { displayNameFor } from "@/lib/user";
import { fetchMyProfile } from "@/lib/profiles";
import type { Profile } from "@/lib/types";
import Avatar from "@/components/Avatar";

/** Signed out: a Sign in button. Signed in: an avatar that opens the account menu. */
export default function AuthNav() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  // Load (and reload, after Settings saves) the profile row.
  useEffect(() => {
    if (!user) {
      queueMicrotask(() => setProfile(null));
      return;
    }
    fetchMyProfile(user.id).then(setProfile);
    const onUpdate = () => fetchMyProfile(user.id).then(setProfile);
    window.addEventListener("wa:profile-updated", onUpdate);
    return () => window.removeEventListener("wa:profile-updated", onUpdate);
  }, [user]);

  // Close on route change, outside click, or Escape.
  useEffect(() => {
    queueMicrotask(() => setOpen(false));
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (user === undefined) return <span className="inline-block h-9 w-9" aria-hidden />;

  if (!user) {
    return (
      <Link href={`/auth?next=${encodeURIComponent(pathname)}`} className="btn btn-ghost !px-4 !py-1.5 text-sm">
        Sign in
      </Link>
    );
  }

  const name = profile?.display_name || displayNameFor(user);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        className="flex items-center gap-2 rounded-full p-0.5 transition hover:ring-2 hover:ring-gold-500/40 focus-visible:ring-2 focus-visible:ring-gold-500"
      >
        <Avatar name={name} src={profile?.avatar_url} seed={user.id} size="sm" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-ink-600 bg-ink-900 shadow-2xl shadow-black/60"
        >
          <div className="flex items-center gap-3 border-b border-ink-700 px-4 py-3">
            <Avatar name={name} src={profile?.avatar_url} seed={user.id} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-parchment-50">{name}</p>
              <p className="truncate text-xs text-parchment-700">{user.email}</p>
            </div>
          </div>
          <div className="py-1">
            <MenuLink href="/following" label="Following" />
            <MenuLink href="/me" label="My testimonies" />
            <MenuLink href="/submit" label="Write a testimony" />
            <MenuLink href="/settings" label="Settings" />
          </div>
          <div className="border-t border-ink-700 py-1">
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setOpen(false);
                await supabase.auth.signOut();
                router.push("/");
                router.refresh();
              }}
              className="block w-full px-4 py-2 text-left text-sm text-parchment-300 hover:bg-ink-800 hover:text-parchment-50"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} role="menuitem" className="block px-4 py-2 text-sm text-parchment-300 hover:bg-ink-800 hover:text-parchment-50">
      {label}
    </Link>
  );
}
