"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  openMuster,
  respondMuster,
  proposeMuster,
  approveMuster,
  sendBackMuster,
  cancelMuster,
} from "@/app/actions/musters";
import { useAnnounce } from "@/components/Announce";
import { heroDate, shortTime } from "@/lib/dates";
import type { MusterView } from "@/lib/queries";

// One squad's Muster — the Captain's pre-week arrangement, all roles/states.
// No muster → Captain can call one. Open → members tick nights, Captain proposes.
// Proposed → President approves & deploys (or sends back).

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function nextDays(n: number): string[] {
  const base = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return isoLocal(d);
  });
}
function dateChip(iso: string): string {
  const { dow, day } = heroDate(iso);
  return `${dow} ${day}`;
}

export function Muster({
  squadId,
  muster,
  iAmCaptain,
  isAdmin,
  mine,
  memberCount,
}: {
  squadId: string;
  muster: MusterView | null;
  iAmCaptain: boolean;
  isAdmin: boolean;
  mine: boolean;
  memberCount: number;
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const [busy, setBusy] = useState(false);

  // Call-a-muster form
  const [calling, setCalling] = useState(false);
  const [pickDates, setPickDates] = useState<Set<string>>(new Set(nextDays(7)));
  const [times, setTimes] = useState<string[]>([]);
  const [timeInput, setTimeInput] = useState("");
  const [note, setNote] = useState("");

  // Member response
  const [myDates, setMyDates] = useState<Set<string>>(new Set(muster?.myResponse ?? []));

  // Propose / approve
  const [proposeDate, setProposeDate] = useState("");
  const [proposeTime, setProposeTime] = useState("");
  const [apprDate, setApprDate] = useState(muster?.muster.chosen_date ?? "");
  const [apprTime, setApprTime] = useState(muster?.muster.chosen_time ?? "");

  const canRun = iAmCaptain || isAdmin;

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      announce(res.error ?? "Something went wrong.");
      return;
    }
    if (ok) announce(ok);
    router.refresh();
  }

  // ── No active muster ───────────────────────────────────────────────────────
  if (!muster) {
    if (!canRun) return null;
    if (!calling) {
      return (
        <button
          onClick={() => {
            setPickDates(new Set(nextDays(7)));
            setTimes([]);
            setTimeInput("");
            setNote("");
            setCalling(true);
          }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-[3px] border border-sand/50 px-3 py-1.5 font-narrow text-xs font-semibold uppercase tracking-[0.08em] text-sand transition-colors hover:bg-sand/10"
        >
          📆 Call a Muster
        </button>
      );
    }
    const week = nextDays(7);
    return (
      <div className="mt-3 rounded-[3px] border border-rule bg-paper p-3">
        <p className="label mb-2" style={{ color: "var(--color-sand)" }}>
          📆 Call a Muster · week ahead
        </p>

        <p className="mb-1 font-narrow text-[11px] uppercase tracking-[0.06em] text-ink-soft">Nights on offer</p>
        <div className="flex flex-wrap gap-1.5">
          {week.map((iso) => {
            const on = pickDates.has(iso);
            return (
              <button
                key={iso}
                onClick={() =>
                  setPickDates((prev) => {
                    const next = new Set(prev);
                    if (next.has(iso)) next.delete(iso);
                    else next.add(iso);
                    return next;
                  })
                }
                className="rounded-[3px] border px-2.5 py-1.5 font-narrow text-xs font-semibold uppercase tracking-[0.04em]"
                style={{
                  backgroundColor: on ? "var(--color-ink)" : "transparent",
                  borderColor: on ? "var(--color-ink)" : "var(--color-rule)",
                  color: on ? "var(--color-paper)" : "var(--color-ink-soft)",
                }}
              >
                {dateChip(iso)}
              </button>
            );
          })}
        </div>

        <p className="mb-1 mt-3 font-narrow text-[11px] uppercase tracking-[0.06em] text-ink-soft">
          Proposed times (optional)
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {times.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-[3px] border border-rule bg-card px-2 py-1 font-narrow text-xs font-semibold text-ink"
            >
              {shortTime(t)}
              <button onClick={() => setTimes((ts) => ts.filter((x) => x !== t))} className="text-ink-soft hover:text-flag">
                ✕
              </button>
            </span>
          ))}
          <input
            type="time"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            className="rounded-[3px] border border-rule bg-card px-2 py-1 text-sm text-ink outline-none focus:border-ink"
          />
          <button
            onClick={() => {
              if (timeInput && !times.includes(timeInput)) setTimes((ts) => [...ts, timeInput].sort());
              setTimeInput("");
            }}
            className="rounded-[3px] border border-rule px-2.5 py-1 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft"
          >
            + Add
          </button>
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional) — stake, mode…"
          className="mt-3 w-full rounded-[3px] border border-rule bg-card px-3 py-2.5 text-ink outline-none focus:border-ink"
        />

        <div className="mt-3 flex gap-2">
          <button onClick={() => setCalling(false)} className="rounded-[3px] border border-rule px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink-soft">
            Cancel
          </button>
          <button
            onClick={() => {
              const dates = [...pickDates].sort();
              run(
                () => openMuster({ squadId, dates, times, note }),
                "Muster called · squad notified 📆",
              ).then(() => setCalling(false));
            }}
            disabled={busy || pickDates.size === 0}
            className="flex-1 rounded-[3px] bg-sand px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
          >
            Send to squad 📆
          </button>
        </div>
      </div>
    );
  }

  // ── Active muster ──────────────────────────────────────────────────────────
  const m = muster.muster;
  const tally = m.dates
    .map((iso) => ({ iso, count: muster.responses.filter((r) => r.available_dates.includes(iso)).length }))
    .sort((a, b) => b.count - a.count);
  const bestDate = tally[0]?.iso ?? m.dates[0] ?? "";

  // ── Proposed: with the President ──
  if (m.status === "proposed") {
    return (
      <div className="mt-3 rounded-[3px] border border-sand/40 bg-sand/5 p-3">
        <p className="label mb-1" style={{ color: "var(--color-sand)" }}>⚑ Night proposed</p>
        <p className="text-sm text-ink">
          {m.chosen_date ? dateChip(m.chosen_date) : "TBD"}
          {m.chosen_time ? ` · ${shortTime(m.chosen_time)}` : ""} — with the President.
        </p>

        {isAdmin ? (
          <div className="mt-3 border-t border-rule pt-3">
            <p className="label mb-2">Approve &amp; deploy</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={apprDate}
                onChange={(e) => setApprDate(e.target.value)}
                className="rounded-[3px] border border-rule bg-card px-3 py-2 text-ink outline-none focus:border-ink"
              />
              <input
                type="time"
                value={apprTime}
                onChange={(e) => setApprTime(e.target.value)}
                className="rounded-[3px] border border-rule bg-card px-3 py-2 text-ink outline-none focus:border-ink"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => run(() => approveMuster(m.id, apprDate, apprTime || undefined), "Deployed · squad notified 🎮")}
                disabled={busy || !apprDate}
                className="flex-1 rounded-[3px] bg-moss px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
              >
                Approve &amp; deploy
              </button>
              <button
                onClick={() => run(() => sendBackMuster(m.id), "Sent back to the Captain")}
                disabled={busy}
                className="rounded-[3px] border border-rule px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink-soft"
              >
                Send back
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-soft">Awaiting the President&apos;s approval.</p>
        )}

        {iAmCaptain && (
          <button
            onClick={() => run(() => cancelMuster(m.id), "Muster cancelled")}
            disabled={busy}
            className="mt-3 font-mono text-xs uppercase tracking-[0.06em] text-ink-soft hover:text-flag"
          >
            Cancel muster
          </button>
        )}
      </div>
    );
  }

  // ── Open: collecting availability ──
  return (
    <div className="mt-3 rounded-[3px] border border-rule bg-paper p-3">
      <p className="label mb-2" style={{ color: "var(--color-sand)" }}>📆 Muster · which nights can you play?</p>
      {m.note && <p className="mb-2 text-sm text-ink-soft">“{m.note}”</p>}
      {m.times.length > 0 && (
        <p className="mb-2 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
          Times: {m.times.map((t) => shortTime(t)).join(" · ")}
        </p>
      )}

      {/* Member's own availability tabs */}
      {mine && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {m.dates.map((iso) => {
              const on = myDates.has(iso);
              return (
                <button
                  key={iso}
                  onClick={() =>
                    setMyDates((prev) => {
                      const next = new Set(prev);
                      if (next.has(iso)) next.delete(iso);
                      else next.add(iso);
                      return next;
                    })
                  }
                  className="rounded-[3px] border px-2.5 py-1.5 font-narrow text-xs font-semibold uppercase tracking-[0.04em]"
                  style={{
                    backgroundColor: on ? "var(--color-moss)" : "transparent",
                    borderColor: on ? "var(--color-moss)" : "var(--color-rule)",
                    color: on ? "var(--color-paper)" : "var(--color-ink-soft)",
                  }}
                >
                  {dateChip(iso)}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => run(() => respondMuster(m.id, [...myDates]), "Nights saved ✋")}
            disabled={busy}
            className="mt-2 rounded-[3px] bg-ink px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
          >
            Save my nights
          </button>
        </>
      )}

      {/* Tally + propose (Captain / CO) */}
      {canRun && (
        <div className="mt-3 border-t border-rule pt-3">
          <p className="label mb-2">Tally</p>
          <ul className="flex flex-col gap-1">
            {tally.map(({ iso, count }) => (
              <li key={iso} className="flex items-center gap-2 text-sm">
                <span className="w-16 shrink-0 font-narrow font-semibold text-ink">{dateChip(iso)}</span>
                <span className="font-narrow tabular-nums text-ink-soft">
                  {count}/{memberCount}
                </span>
                <span
                  className="h-1.5 rounded-full bg-moss"
                  style={{ width: `${memberCount ? (count / memberCount) * 80 : 0}px` }}
                  aria-hidden
                />
              </li>
            ))}
          </ul>

          <p className="label mb-1 mt-3">Propose a night</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={proposeDate || bestDate}
              onChange={(e) => setProposeDate(e.target.value)}
              className="rounded-[3px] border border-rule bg-card px-3 py-2 text-ink outline-none focus:border-ink"
            >
              {m.dates.map((iso) => (
                <option key={iso} value={iso}>
                  {dateChip(iso)}
                </option>
              ))}
            </select>
            {m.times.length > 0 ? (
              <select
                value={proposeTime}
                onChange={(e) => setProposeTime(e.target.value)}
                className="rounded-[3px] border border-rule bg-card px-3 py-2 text-ink outline-none focus:border-ink"
              >
                <option value="">Time…</option>
                {m.times.map((t) => (
                  <option key={t} value={t}>
                    {shortTime(t)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="time"
                value={proposeTime}
                onChange={(e) => setProposeTime(e.target.value)}
                className="rounded-[3px] border border-rule bg-card px-3 py-2 text-ink outline-none focus:border-ink"
              />
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() =>
                run(() => proposeMuster(m.id, proposeDate || bestDate, proposeTime || undefined), "Sent up to the President ⚑")
              }
              disabled={busy}
              className="flex-1 rounded-[3px] bg-sand px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
            >
              Send to President ⚑
            </button>
            <button
              onClick={() => run(() => cancelMuster(m.id), "Muster cancelled")}
              disabled={busy}
              className="rounded-[3px] border border-rule px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink-soft"
            >
              Scrap
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
