"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { fetchMyProfile, squareImage } from "@/lib/profiles";
import { displayNameFor } from "@/lib/user";
import type { Profile } from "@/lib/types";
import Avatar from "@/components/Avatar";
import { isInternal, setInternal } from "@/lib/analytics";

export default function SettingsForm() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pwNotice, setPwNotice] = useState<string | null>(null);
  const [internal, setInternalState] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    queueMicrotask(() => setInternalState(isInternal()));
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const p: Profile | null = await fetchMyProfile(data.user.id);
        setDisplayName(p?.display_name || displayNameFor(data.user));
        setBio(p?.bio ?? "");
        setAvatarUrl(p?.avatar_url ?? null);
      }
    });
  }, []);

  const onPickAvatar = async (file: File | undefined) => {
    if (!file || !user) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await squareImage(file, 256);
      const path = `${user.id}/avatar.jpg`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;
      const { error: dbErr } = await supabase.from("profiles").upsert({ id: user.id, avatar_url: url, display_name: displayName.trim() || displayNameFor(user) });
      if (dbErr) throw dbErr;
      setAvatarUrl(url);
      window.dispatchEvent(new Event("wa:profile-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that image.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    if (!user) return;
    setUploading(true);
    await supabase.storage.from("avatars").remove([`${user.id}/avatar.jpg`]);
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    setAvatarUrl(null);
    window.dispatchEvent(new Event("wa:profile-updated"));
    setUploading(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const name = displayName.trim();
    if (name.length < 2) {
      setError("Display name needs at least 2 characters.");
      setSaving(false);
      return;
    }
    const { error: dbErr } = await supabase.from("profiles").upsert({ id: user.id, display_name: name, bio: bio.trim() || null, avatar_url: avatarUrl });
    if (dbErr) {
      setError("Couldn't save. Try again in a moment.");
      setSaving(false);
      return;
    }
    // Keep auth metadata in sync so the name is available everywhere without a lookup.
    await supabase.auth.updateUser({ data: { display_name: name } });
    window.dispatchEvent(new Event("wa:profile-updated"));
    setNotice("Saved.");
    setSaving(false);
    setTimeout(() => setNotice(null), 2500);
  };

  const sendReset = async () => {
    if (!user?.email) return;
    const { error: e } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/auth` });
    setPwNotice(e ? "Couldn't send the email right now." : `Password reset link sent to ${user.email}.`);
  };

  if (user === undefined) return null;
  if (!user) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-2xl text-parchment-50">Sign in to manage your account</p>
        <Link href="/auth?next=/settings" className="btn btn-primary mt-6">Sign in</Link>
      </div>
    );
  }

  const name = displayName.trim() || displayNameFor(user);

  return (
    <form onSubmit={save} className="space-y-8">
      {/* Avatar */}
      <section className="card flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center">
        <Avatar name={name} src={avatarUrl} seed={user.id} size="xl" />
        <div className="flex-1">
          <p className="font-medium text-parchment-50">Profile photo</p>
          <p className="mt-1 text-sm text-parchment-500">Square works best. JPG, PNG, or WebP up to 2 MB — we resize it for you.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar-file" onChange={(e) => onPickAvatar(e.target.files?.[0])} />
            <label htmlFor="avatar-file" className={`btn btn-ghost !px-4 !py-1.5 text-sm ${uploading ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
              {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
            </label>
            {avatarUrl && (
              <button type="button" onClick={removeAvatar} disabled={uploading} className="btn btn-ghost !px-4 !py-1.5 text-sm">
                Remove
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Identity */}
      <section className="card space-y-5 p-6">
        <div>
          <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium text-parchment-100">Display name</label>
          <input id="displayName" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} required minLength={2} />
          <p className="mt-1.5 text-xs text-parchment-700">Shown on your responses and as the default name on new testimonies.</p>
        </div>
        <div>
          <label htmlFor="bio" className="mb-1.5 block text-sm font-medium text-parchment-100">About you</label>
          <textarea id="bio" className="input resize-y" rows={3} value={bio} onChange={(e) => setBio(e.target.value.slice(0, 280))} placeholder="A sentence or two. Optional." />
          <p className="mt-1.5 text-right text-xs text-parchment-700">{bio.length}/280</p>
        </div>
        <div>
          <p className="mb-1.5 block text-sm font-medium text-parchment-100">Email</p>
          <p className="text-sm text-parchment-500">{user.email}</p>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-ink-700 pt-5">
          <div className="text-sm">
            {notice && <span className="text-gold-300">{notice}</span>}
            {error && <span className="text-ember-500">{error}</span>}
          </div>
          <button type="submit" disabled={saving} className="btn btn-primary">{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </section>

      {/* Security */}
      <section className="card flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-parchment-50">Password</p>
          <p className="mt-1 text-sm text-parchment-500">{pwNotice ?? "We'll email you a link to set a new one."}</p>
        </div>
        <button type="button" onClick={sendReset} className="btn btn-ghost !py-2 text-sm">Send reset link</button>
      </section>

      {/* Analytics */}
      <section className="card p-6">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={internal}
            onChange={(e) => {
              setInternal(e.target.checked);
              setInternalState(e.target.checked);
            }}
            className="mt-1 h-4 w-4 accent-gold-500"
          />
          <span>
            <span className="block font-medium text-parchment-50">Exclude my visits from analytics</span>
            <span className="mt-1 block text-sm text-parchment-500">
              For the team. Marks everything you do in this browser as internal traffic so it doesn&apos;t count as a reader. It&apos;s per device — turn it on in each browser you use, or open any page with <code className="text-parchment-300">?internal=1</code>.
            </span>
          </span>
        </label>
      </section>
    </form>
  );
}
