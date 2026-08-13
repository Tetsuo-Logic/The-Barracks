"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBroadcast } from "@/app/actions/broadcasts";
import type { BroadcastKind } from "@/lib/types";

// TRANSMIT TO THE BARRACKS — the PA system, and nothing else.
//
// Four types, and only the fields that type actually needs on screen. Comms is
// meant to be the simplest area in the product; a form that shows everything at
// once is how it stopped being that.

type Kind = Extract<BroadcastKind, "announce" | "yesno" | "ask" | "poll">;

const KINDS: { key: Kind; label: string; hint: string }[] = [
  { key: "announce", label: "Notice", hint: "Information only. Nobody has to reply." },
  { key: "yesno", label: "Yes / No", hint: "A tally comes back — yes, no, silent." },
  { key: "ask", label: "Question", hint: "Open replies, in their own words." },
  { key: "poll", label: "Poll", hint: "Offer the options; everyone picks one." },
];

const field =
  "hq-mono w-full rounded-[3px] border border-rule bg-[rgba(0,0,0,0.25)] px-3 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-sand";

export function Transmitter({ callsign }: { callsign: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("announce");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const active = KINDS.find((k) => k.key === kind)!;
  const filled = options.map((o) => o.trim()).filter(Boolean);
  const ready = body.trim().length > 0 && (kind !== "poll" || filled.length >= 2);

  async function send() {
    setBusy(true);
    setMsg(null);
    const res = await createBroadcast({
      kind,
      title: title || undefined,
      body,
      options: kind === "poll" ? filled : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setMsg({ tone: "bad", text: res.error.toUpperCase() });
      return;
    }
    setMsg({ tone: "ok", text: "TRANSMITTED · BARRACKS NOTIFIED" });
    setTitle("");
    setBody("");
    setOptions(["", ""]);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Type — four buttons across, so the choice is the first thing read. */}
      <div className="grid gap-1.5 sm:grid-cols-4">
        {KINDS.map((k) => {
          const on = k.key === kind;
          return (
            <button
              key={k.key}
              onClick={() => setKind(k.key)}
              className="hq-mono rounded-[3px] border px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors"
              style={{
                borderColor: on ? "var(--color-sand)" : "var(--color-rule)",
                backgroundColor: on ? "rgba(245,182,61,0.1)" : "transparent",
                color: on ? "var(--color-sand)" : "var(--color-ink-soft)",
              }}
            >
              {k.label}
            </button>
          );
        })}
      </div>
      <p className="hq-mono -mt-1 text-[12px] text-ink-soft">{active.hint}</p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div>
          <label className="hq-label mb-1.5 block">Subject</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional heading"
            className={field}
          />
        </div>
        <div>
          <label className="hq-label mb-1.5 block">
            {kind === "ask" ? "What are you asking?" : kind === "poll" ? "The question" : "Message"}
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={kind === "announce" ? 4 : 2}
            placeholder={`Transmitting as ${callsign}…`}
            className={`${field} resize-none leading-relaxed`}
          />
        </div>
      </div>

      {/* Only polls need choices, so only polls show them. */}
      {kind === "poll" && (
        <div>
          <label className="hq-label mb-1.5 block">Options</label>
          <div className="flex flex-col gap-1.5">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="hq-mono w-5 shrink-0 text-[11px] text-ink-soft">{i + 1}</span>
                <input
                  value={o}
                  onChange={(e) =>
                    setOptions((prev) => prev.map((v, n) => (n === i ? e.target.value : v)))
                  }
                  placeholder={`Option ${i + 1}`}
                  className={field}
                />
                {options.length > 2 && (
                  <button
                    onClick={() => setOptions((prev) => prev.filter((_, n) => n !== i))}
                    className="hq-label shrink-0 px-2 py-1 hover:text-ink"
                    aria-label={`Remove option ${i + 1}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 6 && (
            <button
              onClick={() => setOptions((prev) => [...prev, ""])}
              className="hq-label mt-2 rounded-[3px] border border-rule px-2.5 py-1.5 transition-colors hover:text-ink"
            >
              + Add option
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-4">
        <button
          onClick={send}
          disabled={busy || !ready}
          className="hq-readout rounded-[3px] px-7 py-3.5 text-[15px] font-bold uppercase tracking-[0.1em] transition-opacity disabled:opacity-40"
          style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
        >
          {busy ? "Transmitting…" : "Transmit"}
        </button>
        <span className="hq-label opacity-70">To all operatives · push notification</span>
        {msg && (
          <span
            className="hq-mono ml-auto text-[11px] uppercase tracking-[0.14em]"
            style={{ color: msg.tone === "ok" ? "var(--color-moss)" : "var(--color-flag)" }}
          >
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
