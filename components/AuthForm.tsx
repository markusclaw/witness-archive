"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup" | "reset";

export default function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/archive";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push(next);
          router.refresh();
        } else {
          setNotice("Check your inbox — we sent a link to confirm your email.");
        }
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        setNotice("If that address has an account, a reset link is on its way.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const heading = mode === "signup" ? "Create your account" : mode === "reset" ? "Reset your password" : "Welcome back";

  return (
    <div className="card p-8">
      <p className="eyebrow mb-3">Members</p>
      <h1 className="font-display text-3xl text-parchment-50">{heading}</h1>
      <p className="mt-2 text-sm text-parchment-500">
        {mode === "signup"
          ? "An account lets you respond to testimonies and submit your own."
          : mode === "reset"
            ? "Enter your email and we'll send you a link."
            : "Sign in to join the conversation."}
      </p>

      {error && <p className="mt-5 rounded-lg border border-ember-500/40 bg-ember-500/10 p-3 text-sm text-parchment-100">{error}</p>}
      {notice && <p className="mt-5 rounded-lg border border-gold-500/40 bg-gold-500/10 p-3 text-sm text-parchment-100">{notice}</p>}

      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "signup" && (
          <div>
            <label htmlFor="displayName" className="mb-1.5 block text-sm text-parchment-300">
              Display name
            </label>
            <input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              minLength={2}
              maxLength={40}
              className="input"
              placeholder="How you'll appear on responses"
              autoComplete="nickname"
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm text-parchment-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        {mode !== "reset" && (
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm text-parchment-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="input"
              placeholder="At least 8 characters"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>
        )}
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? "One moment…" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-2 text-center text-sm text-parchment-500">
        {mode === "signin" && (
          <>
            <button type="button" onClick={() => setMode("signup")} className="hover:text-gold-300">
              New here? <span className="text-gold-400">Create an account</span>
            </button>
            <button type="button" onClick={() => setMode("reset")} className="hover:text-gold-300">
              Forgot your password?
            </button>
          </>
        )}
        {mode !== "signin" && (
          <button type="button" onClick={() => setMode("signin")} className="hover:text-gold-300">
            Already have an account? <span className="text-gold-400">Sign in</span>
          </button>
        )}
      </div>
    </div>
  );
}
