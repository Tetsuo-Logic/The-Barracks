"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type State = "idle" | "sending" | "sent" | "error";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("sending");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setState("error");
      setError("Couldn't send the link. Check the address and try again.");
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="rounded-[3px] border border-rule bg-card p-5 shadow-[var(--shadow-card)]">
        <p className="label mb-1">Check your email</p>
        <p className="text-ink">
          A link is on its way to{" "}
          <span className="font-medium">{email}</span>. Open it on this phone to
          sign in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-3">
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
      <button
        type="submit"
        disabled={state === "sending"}
        className="rounded-[3px] bg-ink px-4 py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
      >
        {state === "sending" ? "Sending" : "Send the link"}
      </button>
      {error && <p className="text-sm text-flag">{error}</p>}
    </form>
  );
}
