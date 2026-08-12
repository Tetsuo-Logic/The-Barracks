"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { respondBroadcast, postBroadcastMessage } from "@/app/actions/broadcasts";
import { heroDate } from "@/lib/dates";
import type { BroadcastKind } from "@/lib/types";

// Answering from the command surface — the same `broadcast_responses` row the
// phone writes, and the same append-only reply thread.

export function RespondBar({
  broadcastId,
  kind,
  myAnswer,
  myComment,
  optionDates,
  myDates,
}: {
  broadcastId: string;
  kind: BroadcastKind;
  myAnswer: "yes" | "no" | null;
  myComment: string | null;
  optionDates: string[];
  myDates: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [reply, setReply] = useState(myComment ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set(myDates));
  const [msg, setMsg] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, ok: string) {
    setBusy(true);
    setMsg(null);
    const res = await fn();
    setBusy(false);
    setMsg(res.ok ? ok : res.error.toUpperCase());
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {kind === "yesno" && (
        <div>
          <p className="hq-label mb-1.5">Your answer</p>
          <div className="flex gap-2">
            {(["yes", "no"] as const).map((a) => {
              const on = myAnswer === a;
              const c = a === "yes" ? "var(--color-moss)" : "var(--color-flag)";
              return (
                <button
                  key={a}
                  disabled={busy}
                  onClick={() => run(() => respondBroadcast(broadcastId, a), `LOGGED · ${a.toUpperCase()}`)}
                  className="hq-label flex-1 rounded-[3px] border px-3 py-2.5 font-semibold transition-colors disabled:opacity-50"
                  style={{
                    borderColor: on ? c : "var(--color-rule)",
                    backgroundColor: on ? c : "transparent",
                    color: on ? "#0b100e" : c,
                  }}
                >
                  {a === "yes" ? "✓ In" : "✕ Out"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {kind === "ask" && (
        <div>
          <p className="hq-label mb-1.5">Your reply</p>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            placeholder="Answer the question…"
            className="hq-mono w-full resize-none rounded-[3px] border border-rule bg-[rgba(0,0,0,0.25)] px-3 py-2 text-[13px] text-ink outline-none focus:border-sand"
          />
          <button
            disabled={busy || !reply.trim()}
            onClick={() => run(() => respondBroadcast(broadcastId, null, reply), "REPLY LOGGED")}
            className="hq-label mt-2 rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-sand hover:text-ink disabled:opacity-40"
          >
            Send reply
          </button>
        </div>
      )}

      {kind === "dates" && optionDates.length > 0 && (
        <div>
          <p className="hq-label mb-1.5">Nights you can do</p>
          <div className="flex flex-wrap gap-1.5">
            {optionDates.map((iso) => {
              const on = picked.has(iso);
              const hd = heroDate(iso);
              return (
                <button
                  key={iso}
                  onClick={() =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (next.has(iso)) next.delete(iso);
                      else next.add(iso);
                      return next;
                    })
                  }
                  className="hq-mono rounded-[3px] border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors"
                  style={{
                    borderColor: on ? "var(--color-moss)" : "var(--color-rule)",
                    backgroundColor: on ? "color-mix(in srgb, var(--color-moss) 14%, transparent)" : "transparent",
                    color: on ? "var(--color-moss)" : "var(--color-ink-soft)",
                  }}
                >
                  {hd.dow} {hd.day}
                </button>
              );
            })}
          </div>
          <button
            disabled={busy}
            onClick={() => {
              const sorted = [...picked].sort();
              run(
                () => respondBroadcast(broadcastId, null, undefined, sorted, sorted.map(() => "")),
                "AVAILABILITY LOGGED",
              );
            }}
            className="hq-label mt-2 rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-sand hover:text-ink disabled:opacity-40"
          >
            Send my nights
          </button>
        </div>
      )}

      <div className="border-t border-rule pt-3">
        <p className="hq-label mb-1.5">Add to thread</p>
        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Message the Barracks…"
            className="hq-mono min-w-0 flex-1 rounded-[3px] border border-rule bg-[rgba(0,0,0,0.25)] px-3 py-2 text-[13px] text-ink outline-none focus:border-sand"
          />
          <button
            disabled={busy || !note.trim()}
            onClick={() =>
              run(() => postBroadcastMessage(broadcastId, note), "MESSAGE POSTED").then(() => setNote(""))
            }
            className="hq-label shrink-0 rounded-[3px] px-3 py-2 font-semibold disabled:opacity-40"
            style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
          >
            Post
          </button>
        </div>
      </div>

      {msg && (
        <p className="hq-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--color-moss)" }}>
          {msg}
        </p>
      )}
    </div>
  );
}
