"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type State = "idle" | "sending" | "sent" | "verifying" | "error";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
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
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setState("error");
      setError("Couldn't send the email. Check the address and try again.");
      return;
    }
    setState("sent");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const token = code.trim();
    if (token.length < 6) return;
    setState("verifying");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });

    if (error) {
      setState("error");
      setError("That code didn't work. Check it and try again.");
      return;
    }
    // Signed in — full navigation so the server picks up the new session.
    window.location.href = "/";
  }

  if (state === "sent" || state === "verifying" || (state === "error" && code)) {
    return (
      <form onSubmit={verify} className="flex flex-col gap-3">
        <div className="rounded-[3px] border border-rule bg-card p-4">
          <p className="label mb-1">Check your email</p>
          <p className="text-ink">
            We sent a code to{" "}
            <span className="font-medium">{email}</span>. Enter it below — or, on
            a computer, just tap the link in the email.
          </p>
        </div>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded-[3px] border border-rule bg-card px-4 py-3 text-center text-[20px] tracking-[0.3em] text-ink outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={state === "verifying" || code.length < 6}
          className="rounded-[3px] bg-ink px-4 py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
        >
          {state === "verifying" ? "Signing in" : "Sign in"}
        </button>
        {error && <p className="text-sm text-flag">{error}</p>}
        <button
          type="button"
          onClick={() => {
            setCode("");
            setState("idle");
          }}
          className="text-sm text-ink-soft underline"
        >
          Use a different email
        </button>
      </form>
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
