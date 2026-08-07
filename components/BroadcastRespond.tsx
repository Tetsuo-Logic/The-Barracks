"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { respondBroadcast } from "@/app/actions/broadcasts";
import { heroDate } from "@/lib/dates";
import type { Broadcast, BroadcastResponse } from "@/lib/types";

// The recipient's answer surface. Yes/No poll, tick-the-dates poll, a reply
// box for a question, or a simple acknowledge for a plain notice.
export function BroadcastRespond({
  broadcast,
  mine,
}: {
  broadcast: Broadcast;
  mine: BroadcastResponse | null;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState<"yes" | "no" | null>(mine?.answer ?? null);
  const [comment, setComment] = useState(mine?.comment ?? "");
  const [dates, setDates] = useState<string[]>(mine?.available_dates ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(mine));
  const [error, setError] = useState<string | null>(null);

  async function submit(nextAnswer: "yes" | "no" | null) {
    setSaving(true);
    setError(null);
    setAnswer(nextAnswer);
    const res = await respondBroadcast(
      broadcast.id,
      nextAnswer,
      comment,
      broadcast.kind === "dates" ? dates : undefined,
    );
    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }
    setSaved(true);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="rounded-[3px] border border-rule bg-card p-4">
      <p className="label mb-3">Your answer</p>

      {broadcast.kind === "dates" && (
        <div className="mb-3">
          <p className="mb-2 text-sm text-ink-soft">Tap the days you can play:</p>
          <div className="flex flex-wrap gap-2">
            {(broadcast.option_dates ?? []).map((d) => {
              const on = dates.includes(d);
              const { dow, day, mon } = heroDate(d);
              return (
                <button
                  key={d}
                  onClick={() =>
                    setDates((ds) => (on ? ds.filter((x) => x !== d) : [...ds, d]))
                  }
                  className="flex w-[4.2rem] flex-col items-center rounded-[3px] border py-2 leading-none"
                  style={{
                    borderColor: on ? "var(--color-moss)" : "var(--color-rule)",
                    backgroundColor: on ? "var(--color-moss)" : "transparent",
                    color: on ? "var(--color-paper)" : "var(--color-ink)",
                  }}
                >
                  <span className="font-narrow text-[10px] font-semibold uppercase tracking-[0.08em]">{dow}</span>
                  <span className="my-0.5 font-narrow text-[22px] font-bold tabular-nums">{day}</span>
                  <span className="font-narrow text-[10px] font-semibold uppercase tracking-[0.08em]">{mon}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {broadcast.kind === "yesno" && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(["yes", "no"] as const).map((v) => {
            const active = answer === v;
            return (
              <button
                key={v}
                onClick={() => submit(v)}
                disabled={saving}
                className="rounded-[3px] border py-3 font-narrow text-[15px] font-semibold uppercase tracking-[0.08em]"
                style={{
                  backgroundColor: active ? (v === "yes" ? "var(--color-moss)" : "var(--color-flag)") : "transparent",
                  borderColor: active ? (v === "yes" ? "var(--color-moss)" : "var(--color-flag)") : "var(--color-rule)",
                  color: active ? "var(--color-paper)" : "var(--color-ink)",
                }}
              >
                {v}
              </button>
            );
          })}
        </div>
      )}

      {broadcast.kind !== "announce" && (
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder={broadcast.kind === "ask" ? "Your reply" : "Add a comment (optional)"}
          className="w-full resize-none rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
        />
      )}

      <button
        onClick={() => submit(answer)}
        disabled={saving || (broadcast.kind === "ask" && !comment.trim())}
        className="mt-3 w-full rounded-[3px] bg-ink px-4 py-2.5 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
      >
        {saving ? "Saving" : broadcast.kind === "announce" ? "Got it" : saved ? "Update" : "Send"}
      </button>

      {error ? (
        <p className="mt-2 text-sm text-flag">{error}</p>
      ) : saved ? (
        <p className="mt-2 text-sm text-ink-soft">Saved.</p>
      ) : null}
    </div>
  );
}
