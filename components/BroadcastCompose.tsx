"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBroadcast } from "@/app/actions/broadcasts";
import { createTrial } from "@/app/actions/trials";
import { Avatar } from "@/components/Avatar";
import { shortDate } from "@/lib/dates";
import type { BroadcastKind, Profile } from "@/lib/types";

type Mode = BroadcastKind | "court";

const KINDS: { value: Mode; label: string; hint: string }[] = [
  { value: "yesno", label: "Yes / No", hint: "They answer yes or no." },
  { value: "dates", label: "Deploy", hint: "Deployment check — offer nights; they tick what they can do." },
  { value: "ask", label: "Ask", hint: "They reply in words." },
  { value: "announce", label: "Tell", hint: "Just put out a dispatch." },
  { value: "court", label: "Court", hint: "Court-martial someone for flaking." },
];

export function BroadcastCompose({ candidates }: { candidates: Profile[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("yesno");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [defendant, setDefendant] = useState<string | null>(null);
  const [dateOptions, setDateOptions] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hint = KINDS.find((k) => k.value === mode)?.hint;
  const isCourt = mode === "court";
  const isDates = mode === "dates";

  function addDate() {
    if (!newDate || dateOptions.includes(newDate)) return;
    setDateOptions((d) => [...d, newDate].sort());
    setNewDate("");
  }

  async function send() {
    setSending(true);
    setError(null);

    if (isCourt) {
      if (!defendant) {
        setError("Pick who's on trial.");
        setSending(false);
        return;
      }
      const res = await createTrial({ defendantId: defendant, charge: body });
      if (!res.ok) {
        setError(res.error);
        setSending(false);
        return;
      }
      router.push(`/trial/${res.id}`);
      return;
    }

    if (isDates && dateOptions.length === 0) {
      setError("Add at least one date.");
      setSending(false);
      return;
    }

    const res = await createBroadcast({
      kind: mode,
      title: title || undefined,
      body: body || (isDates ? "Which of these can you do?" : ""),
      optionDates: isDates ? dateOptions : undefined,
    });
    if (!res.ok) {
      setError(res.error);
      setSending(false);
      return;
    }
    setBody("");
    setTitle("");
    setSending(false);
    router.refresh();
  }

  return (
    <div className="rounded-[3px] border border-rule bg-card p-4">
      <p className="label mb-2">Comms 📡</p>

      <div className="mb-3 flex overflow-hidden rounded-[3px] border border-rule">
        {KINDS.map((k, i) => {
          const active = k.value === mode;
          const court = k.value === "court";
          return (
            <button
              key={k.value}
              onClick={() => setMode(k.value)}
              className="flex-1 py-2 font-narrow text-xs font-semibold uppercase tracking-[0.06em] transition-colors"
              style={{
                backgroundColor: active ? (court ? "var(--color-flag)" : "var(--color-ink)") : "transparent",
                color: active ? "var(--color-paper)" : court ? "var(--color-flag)" : "var(--color-ink)",
                borderLeft: i > 0 ? "1px solid var(--color-rule)" : "none",
              }}
            >
              {k.label}
            </button>
          );
        })}
      </div>
      <p className="mb-3 text-sm text-ink-soft">{hint}</p>

      {isCourt ? (
        <>
          <p className="label mb-2">The accused</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {candidates.length === 0 && (
              <p className="text-sm text-ink-soft">Nobody else has signed in yet.</p>
            )}
            {candidates.map((p) => {
              const active = defendant === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setDefendant(p.id)}
                  className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3"
                  style={{
                    borderColor: active ? "var(--color-flag)" : "var(--color-rule)",
                    backgroundColor: active ? "rgba(180,55,42,0.08)" : "transparent",
                  }}
                >
                  <Avatar name={p.name} avatarUrl={p.avatar_url} colour={p.colour} size={22} />
                  <span className="text-sm text-ink">{p.name}</span>
                </button>
              );
            })}
          </div>
          <p className="label mb-1">The offence</p>
        </>
      ) : (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Heading (optional)"
          className="mb-2 w-full rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
        />
      )}

      {isDates && (
        <div className="mb-3">
          <p className="label mb-1">Dates to offer</p>
          <div className="flex gap-2">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="min-w-0 flex-1 rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
            />
            <button
              type="button"
              onClick={addDate}
              className="shrink-0 rounded-[3px] border border-ink px-4 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink"
            >
              Add
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-soft">The squad pick a time that suits them on each night they can do.</p>
          {dateOptions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {dateOptions.map((d) => (
                <span
                  key={d}
                  className="flex items-center gap-2 rounded-[3px] border border-rule px-2.5 py-1 text-sm text-ink"
                >
                  {shortDate(d)}
                  <button
                    type="button"
                    onClick={() => setDateOptions((o) => o.filter((x) => x !== d))}
                    className="text-ink-soft"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder={
          isCourt
            ? "Said in, then ghosted us on the night"
            : mode === "yesno"
              ? "Anyone about for a game Sunday?"
              : mode === "dates"
                ? "Which nights can you do? (optional note)"
                : mode === "ask"
                  ? "What night suits everyone next week?"
                  : "Servers are down tonight, heads up."
        }
        className="w-full resize-none rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
      />

      {error && <p className="mt-2 text-sm text-flag">{error}</p>}

      <button
        onClick={send}
        disabled={
          sending ||
          (isCourt && !defendant) ||
          (isDates ? dateOptions.length === 0 : !body.trim())
        }
        className="mt-3 w-full rounded-[3px] px-4 py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
        style={{ backgroundColor: isCourt ? "var(--color-flag)" : "var(--color-ink)" }}
      >
        {sending ? "Sending" : isCourt ? "Summon them" : "Send it"}
      </button>
    </div>
  );
}
