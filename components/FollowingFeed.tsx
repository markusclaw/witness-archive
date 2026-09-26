"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { TESTIMONY_COLUMNS } from "@/lib/queries";
import { fetchProfiles } from "@/lib/profiles";
import type { Profile, Testimony } from "@/lib/types";
import Avatar from "@/components/Avatar";
import TestimonyCard from "@/components/TestimonyCard";

export default function FollowingFeed() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [authors, setAuthors] = useState<Profile[]>([]);
  const [items, setItems] = useState<Testimony[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (!data.user) {
        setLoaded(true);
        return;
      }
      const { data: f } = await supabase.from("follows").select("followee_id").eq("follower_id", data.user.id);
      const ids = (f ?? []).map((r) => r.followee_id as string);
      if (ids.length) {
        const [profiles, { data: t }] = await Promise.all([
          fetchProfiles(ids),
          supabase.from("testimonies").select(TESTIMONY_COLUMNS).in("author_id", ids).eq("status", "published").eq("is_anonymous", false).order("created_at", { ascending: false }).limit(60),
        ]);
        setAuthors(ids.map((id) => profiles[id]).filter(Boolean));
        setItems((t ?? []) as Testimony[]);
      }
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <p className="text-sm text-parchment-700">Loading…</p>;
  if (!user) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-2xl text-parchment-50">Sign in to see your feed</p>
        <Link href="/auth?next=/following" className="btn btn-primary mt-6">Sign in</Link>
      </div>
    );
  }
  if (authors.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="font-display text-2xl text-parchment-50">You&apos;re not following anyone yet.</p>
        <p className="mt-2 text-parchment-500">Press Follow on any testimony, and new ones from that person will show up here.</p>
        <Link href="/archive" className="btn btn-ghost mt-6">Browse the archive</Link>
      </div>
    );
  }
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-3">
        {authors.map((a) => (
          <Link key={a.id} href={`/author/${a.id}`} className="flex items-center gap-2 rounded-full border border-ink-600 py-1 pl-1 pr-3 text-sm text-parchment-300 hover:border-gold-500/40 hover:text-parchment-50">
            <Avatar name={a.display_name} src={a.avatar_url} seed={a.id} size="xs" />
            {a.display_name}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="text-parchment-500">Nothing published yet from the people you follow.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <TestimonyCard key={t.id} testimony={t} />
          ))}
        </div>
      )}
    </div>
  );
}
