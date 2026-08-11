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
// No muster → Captain calls one (nights + a kick-off window). Open → members say
// which nights + their window each night; the Captain reads the overlap and
// proposes. Proposed → President approves & deploys (or sends back).

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
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}
function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
// Hourly slots across a window, inclusive of both ends.
function slots(from: string | null, to: string | null): string[] {
  if (!from || !to) return [];
  const a = toMin(from);
  const b = toMin(to);
  if (b <= a) return [from];
  const out: string[] = [];
  for (let t = a; t <= b; t += 60) out.push(toHHMM(t));
  return out;
}

export function Muster({
  squadId,
  muster,
  iAmCaptain,
  isAdmin,
  canCall,
  mine,
  memberCount,
}: {
  squadId: string;
  muster: MusterView | null;
  iAmCaptain: boolean;
  isAdmin: boolean;
  canCall: boolean; // may start a muster — the Captain, or the CO if there's no Captain
  mine: boolean;
  memberCount: number;
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const [busy, setBusy] = useState(false);

  // Call-a-muster form
  const [calling, setCalling] = useState(false);
  const [pickDates, setPickDates] = useState<Set<string>>(new Set(nextDays(7)));
  const [winFrom, setWinFrom] = useState("18:00");
  const [winTo, setWinTo] = useState("22:00");
  const [note, setNote] = useState("");

  // Member response — nights I can do, each with my own window.
  const [myAvail, setMyAvail] = useState<Map<string, { from: string; to: string }>>(() => {
    const map = new Map<string, { from: string; to: string }>();
    const r = muster?.myResponse;
    if (r) r.available_dates.forEach((iso, i) => map.set(iso, { from: r.from_times[i] ?? "", to: r.to_times[i] ?? "" }));
    return map;
  });

  // Propose / approve
  const [proposeDate, setProposeDate] = useState("");
  const [proposeTime, setProposeTime] = useState("");
  const [apprDate, setApprDate] = useState(muster?.muster.chosen_date ?? "");
  const [apprTime, setApprTime] = useState(muster?.muster.chosen_time ?? "");

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
    if (!canCall) return null;
    if (!calling) {
      return (
        <div className="mt-3">
          <button
            onClick={() => {
              setPickDates(new Set(nextDays(7)));
              setWinFrom("18:00");
              setWinTo("22:00");
              setNote("");
              setCalling(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-[3px] border border-sand/50 px-3 py-1.5 font-narrow text-xs font-semibold uppercase tracking-[0.08em] text-sand transition-colors hover:bg-sand/10"
          >
            📆 Call a Muster
          </button>
          <p className="mt-1 text-xs text-ink-soft">
            Set up this week&apos;s night — pick the nights + a window, the squad says when they&apos;re free.
          </p>
        </div>
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
          Kick-off window
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="time"
            value={winFrom}
            onChange={(e) => setWinFrom(e.target.value)}
            className="w-full max-w-full rounded-[3px] border border-rule bg-card px-3 py-2.5 text-ink outline-none focus:border-ink"
          />
          <input
            type="time"
            value={winTo}
            onChange={(e) => setWinTo(e.target.value)}
            className="w-full max-w-full rounded-[3px] border border-rule bg-card px-3 py-2.5 text-ink outline-none focus:border-ink"
          />
        </div>
        <p className="mt-1 text-xs text-ink-soft">The squad picks their hours inside this.</p>

        <p className="mb-1 mt-3 font-narrow text-[11px] uppercase tracking-[0.06em] text-ink-soft">Note (optional)</p>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Stake, mode…"
          className="block w-full max-w-full rounded-[3px] border border-rule bg-card px-3 py-2.5 text-ink outline-none focus:border-ink"
        />

        <div className="mt-3 flex gap-2">
          <button onClick={() => setCalling(false)} className="rounded-[3px] border border-rule px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink-soft">
            Cancel
          </button>
          <button
            onClick={() => {
              const dates = [...pickDates].sort();
              const wf = winFrom && winTo && toMin(winTo) > toMin(winFrom) ? winFrom : undefined;
              const wt = wf ? winTo : undefined;
              run(
                () => openMuster({ squadId, dates, windowFrom: wf, windowTo: wt, note }),
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
  const windowSlots = slots(m.window_from, m.window_to);
  const hasWindow = windowSlots.length > 1;

  // Per-night: how many can play + the window everyone available overlaps.
  function overlapFor(iso: string): { count: number; from: string; to: string } {
    const avail = muster!.responses.filter((r) => r.available_dates.includes(iso));
    let maxFrom = -Infinity;
    let minTo = Infinity;
    let anyTimes = false;
    for (const r of avail) {
      const idx = r.available_dates.indexOf(iso);
      const f = r.from_times[idx];
      const t = r.to_times[idx];
      if (f && t) {
        anyTimes = true;
        maxFrom = Math.max(maxFrom, toMin(f));
        minTo = Math.min(minTo, toMin(t));
      }
    }
    if (!anyTimes || maxFrom >= minTo) return { count: avail.length, from: "", to: "" };
    return { count: avail.length, from: toHHMM(maxFrom), to: toHHMM(minTo) };
  }

  const tally = m.dates
    .map((iso) => ({ iso, ...overlapFor(iso) }))
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
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={apprDate}
                onChange={(e) => setApprDate(e.target.value)}
                className="w-full max-w-full rounded-[3px] border border-rule bg-card px-3 py-2.5 text-ink outline-none focus:border-ink"
              />
              <input
                type="time"
                value={apprTime}
                onChange={(e) => setApprTime(e.target.value)}
                className="w-full max-w-full rounded-[3px] border border-rule bg-card px-3 py-2.5 text-ink outline-none focus:border-ink"
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

  const proposeSel = proposeDate || bestDate;
  const proposeTimeVal = proposeTime || overlapFor(proposeSel).from || m.window_from || "";

  // ── Open: collecting availability ──
  return (
    <div className="mt-3 rounded-[3px] border border-rule bg-paper p-3">
      <p className="label mb-2" style={{ color: "var(--color-sand)" }}>📆 Muster · which nights can you play?</p>
      {m.note && <p className="mb-2 text-sm text-ink-soft">“{m.note}”</p>}
      {hasWindow && (
        <p className="mb-2 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
          Window: {shortTime(m.window_from)}–{shortTime(m.window_to)}
        </p>
      )}

      {/* Member's own availability — a night + their hours that night */}
      {mine && (
        <>
          <ul className="flex flex-col gap-2">
            {m.dates.map((iso) => {
              const avail = myAvail.get(iso);
              const on = !!avail;
              return (
                <li key={iso} className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      setMyAvail((prev) => {
                        const next = new Map(prev);
                        if (next.has(iso)) next.delete(iso);
                        else next.set(iso, { from: m.window_from ?? "", to: m.window_to ?? "" });
                        return next;
                      })
                    }
                    className="w-20 shrink-0 rounded-[3px] border px-2 py-1.5 font-narrow text-xs font-semibold uppercase tracking-[0.04em]"
                    style={{
                      backgroundColor: on ? "var(--color-moss)" : "transparent",
                      borderColor: on ? "var(--color-moss)" : "var(--color-rule)",
                      color: on ? "var(--color-paper)" : "var(--color-ink-soft)",
                    }}
                  >
                    {dateChip(iso)}
                  </button>
                  {on && hasWindow && avail ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={avail.from}
                        onChange={(e) =>
                          setMyAvail((prev) => {
                            const next = new Map(prev);
                            const cur = next.get(iso);
                            if (cur) next.set(iso, { ...cur, from: e.target.value });
                            return next;
                          })
                        }
                        className="rounded-[3px] border border-rule bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
                      >
                        {windowSlots.slice(0, -1).map((t) => (
                          <option key={t} value={t}>{shortTime(t)}</option>
                        ))}
                      </select>
                      <span className="text-ink-soft">–</span>
                      <select
                        value={avail.to}
                        onChange={(e) =>
                          setMyAvail((prev) => {
                            const next = new Map(prev);
                            const cur = next.get(iso);
                            if (cur) next.set(iso, { ...cur, to: e.target.value });
                            return next;
                          })
                        }
                        className="rounded-[3px] border border-rule bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
                      >
                        {windowSlots
                          .filter((t) => toMin(t) > toMin(avail.from))
                          .map((t) => (
                            <option key={t} value={t}>{shortTime(t)}</option>
                          ))}
                      </select>
                    </div>
                  ) : on ? (
                    <span className="font-narrow text-xs uppercase tracking-[0.06em] text-moss">Any time</span>
                  ) : (
                    <span className="font-narrow text-xs uppercase tracking-[0.06em] text-ink-soft">Can&apos;t make it</span>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            onClick={() => {
              const dates = [...myAvail.keys()].sort();
              const froms = dates.map((d) => myAvail.get(d)!.from);
              const tos = dates.map((d) => myAvail.get(d)!.to);
              run(() => respondMuster(m.id, dates, froms, tos), "Nights saved ✋");
            }}
            disabled={busy}
            className="mt-2 rounded-[3px] bg-ink px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
          >
            Save my nights
          </button>
        </>
      )}

      {/* Tally + propose — the Captain (or the CO only when there's no Captain).
          The President doesn't propose to themselves; they approve what comes up. */}
      {canCall && (
        <div className="mt-3 border-t border-rule pt-3">
          <p className="label mb-2">Tally · overlap</p>
          <ul className="flex flex-col gap-1.5">
            {tally.map(({ iso, count, from, to }) => (
              <li key={iso} className="flex items-center gap-2 text-sm">
                <span className="w-16 shrink-0 font-narrow font-semibold text-ink">{dateChip(iso)}</span>
                <span className="w-10 shrink-0 font-narrow tabular-nums text-ink-soft">
                  {count}/{memberCount}
                </span>
                <span className="font-narrow text-xs font-semibold uppercase tracking-[0.04em]" style={{ color: from ? "var(--color-moss)" : "var(--color-ink-soft)" }}>
                  {count === 0 ? "—" : from && to ? `${shortTime(from)}–${shortTime(to)}` : hasWindow ? "no overlap" : "any time"}
                </span>
              </li>
            ))}
          </ul>

          <p className="label mb-1 mt-3">Propose a night</p>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={proposeSel}
              onChange={(e) => {
                setProposeDate(e.target.value);
                setProposeTime("");
              }}
              className="w-full rounded-[3px] border border-rule bg-card px-3 py-2.5 text-ink outline-none focus:border-ink"
            >
              {m.dates.map((iso) => (
                <option key={iso} value={iso}>
                  {dateChip(iso)}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={proposeTimeVal}
              onChange={(e) => setProposeTime(e.target.value)}
              className="w-full max-w-full rounded-[3px] border border-rule bg-card px-3 py-2.5 text-ink outline-none focus:border-ink"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() =>
                run(() => proposeMuster(m.id, proposeSel, proposeTimeVal || undefined), "Sent up to the President ⚑")
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
