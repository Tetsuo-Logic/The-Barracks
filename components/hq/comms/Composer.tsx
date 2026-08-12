"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBroadcast } from "@/app/actions/broadcasts";
import { heroDate } from "@/lib/dates";
import { Tag } from "@/components/hq/Kit";
import type { BroadcastKind } from "@/lib/types";

// The transmitter. Wired to the real `createBroadcast` action — the same rows
// the phone reads, sent from the command surface.

const KINDS: { key: BroadcastKind; label: string; hint: string }[] = [
  { key: "announce", label: "Notice", hint: "Tell the Barracks. No answer expected." },
  { key: "yesno", label: "Yes / No", hint: "A tally comes back — in or out." },
  { key: "ask", label: "Question", hint: "Open replies from the ranks." },
  { key: "dates", label: "Dates poll", hint: "Offer nights; everyone marks what they can do." },
];

function nextDays(n: number): string[] {
  const base = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
}

export function Composer({ canSend, callsign }: { canSend: boolean; callsign: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<BroadcastKind>("announce");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dates, setDates] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  // "Today" is a client fact — the server may sit in another timezone. Fill the
  // chips after mount so the first render matches what the server sent.
  const [week, setWeek] = useState<string[]>([]);
  useEffect(() => setWeek(nextDays(10)), []);

  const active = KINDS.find((k) => k.key === kind)!;

  async function send() {
    setBusy(true);
    setMsg(null);
    const res = await createBroadcast({
      kind,
      title: title || undefined,
      body,
      optionDates: kind === "dates" ? [...dates].sort() : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setMsg({ tone: "bad", text: res.error.toUpperCase() });
      return;
    }
    setMsg({ tone: "ok", text: "SIGNAL SENT · BARRACKS NOTIFIED" });
    setTitle("");
    setBody("");
    setDates(new Set());
    router.refresh();
  }

  if (!canSend) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="hq-readout text-[16px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-flag)" }}>
          Transmitter locked
        </p>
        <p className="hq-mono mt-2 text-[11px] uppercase leading-relaxed tracking-[0.1em] text-ink-soft">
          Command clearance required.
          <br />
          {callsign} may answer signals, not send them.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Kind */}
      <div className="grid grid-cols-2 gap-1.5">
        {KINDS.map((k) => {
          const on = k.key === kind;
          return (
            <button
              key={k.key}
              onClick={() => setKind(k.key)}
              className="hq-mono rounded-[3px] border px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
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
      <p className="hq-mono text-[11px] leading-relaxed text-ink-soft">{active.hint}</p>

      <div>
        <label className="hq-label mb-1 block">Subject</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Optional heading"
          className="hq-mono w-full rounded-[3px] border border-rule bg-[rgba(0,0,0,0.25)] px-3 py-2 text-[13px] text-ink outline-none transition-colors focus:border-sand"
        />
      </div>

      <div>
        <label className="hq-label mb-1 block">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Transmit to all operatives…"
          className="hq-mono w-full resize-none rounded-[3px] border border-rule bg-[rgba(0,0,0,0.25)] px-3 py-2 text-[13px] leading-relaxed text-ink outline-none transition-colors focus:border-sand"
        />
      </div>

      {kind === "dates" && (
        <div>
          <label className="hq-label mb-1.5 block">Nights on offer</label>
          <div className="flex flex-wrap gap-1.5">
            {week.map((iso) => {
              const on = dates.has(iso);
              const hd = heroDate(iso);
              return (
                <button
                  key={iso}
                  onClick={() =>
                    setDates((prev) => {
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
        </div>
      )}

      <button
        onClick={send}
        disabled={busy || !body.trim() || (kind === "dates" && dates.size === 0)}
        className="hq-label rounded-[3px] px-3 py-2.5 font-semibold transition-opacity disabled:opacity-40"
        style={{ backgroundColor: "var(--color-flag)", color: "#0b100e" }}
      >
        {busy ? "Transmitting…" : "▲ Transmit signal"}
      </button>

      {msg && (
        <p
          className="hq-mono text-center text-[11px] uppercase tracking-[0.14em]"
          style={{ color: msg.tone === "ok" ? "var(--color-moss)" : "var(--color-flag)" }}
        >
          {msg.text}
        </p>
      )}

      <div className="mt-1 flex items-center justify-between border-t border-rule pt-2.5">
        <span className="hq-label">Channel</span>
        <span className="flex items-center gap-1.5">
          <Tag tone="live">All operatives</Tag>
          <Tag>Push</Tag>
        </span>
      </div>
    </div>
  );
}
