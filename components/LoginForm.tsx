"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Email + password. One form: if the email is new it creates the account, if it
// exists it signs in. Works reliably inside an installed Home Screen app, where
// emailed magic links can't (they open the browser, not the app).
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mail = email.trim();
    if (!mail || password.length < 6) {
      setError("Enter your email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();

    // Try to sign in first.
    const signIn = await supabase.auth.signInWithPassword({ email: mail, password });
    if (!signIn.error) {
      window.location.href = "/";
      return;
    }

    // No session — maybe a new player. Try to create the account.
    const signUp = await supabase.auth.signUp({ email: mail, password });
    if (signUp.error) {
      setBusy(false);
      setError(
        /already/i.test(signUp.error.message)
          ? "That email's taken — check your password."
          : "Couldn't sign you in. Check your details and try again.",
      );
      return;
    }
    if (!signUp.data.session) {
      // Email confirmation is still switched on in Supabase.
      setBusy(false);
      setError("Almost there — confirm your account from the email we just sent, then sign in.");
      return;
    }
    window.location.href = "/";
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="off"
        spellCheck={false}
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-[3px] border border-rule bg-card px-4 py-3 text-ink outline-none placeholder:text-ink-soft/60 focus:border-ink"
      />
      <input
        type="password"
        autoComplete="current-password"
        required
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-[3px] border border-rule bg-card px-4 py-3 text-ink outline-none placeholder:text-ink-soft/60 focus:border-ink"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-[3px] bg-ink px-4 py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
      >
        {busy ? "One sec" : "Sign in"}
      </button>
      {error && <p className="text-sm text-flag">{error}</p>}
      <p className="text-xs text-ink-soft">
        First time? Just pick a password — it creates your account.
      </p>
    </form>
  );
}
