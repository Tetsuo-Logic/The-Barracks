"use client";

import { useState } from "react";
import { Dot, Tag, Nil } from "@/components/hq/Kit";
import { Stepper } from "@/components/hq/battle/Stepper";
import {
  NIGHTS,
  STAGE_BLURB,
  type Challenge,
  type ChallengeStage,
  type SlotProposal,
} from "@/lib/hq/future/network";

// ── Challenge traffic ──────────────────────────────────────────────────────
// Everything before a battle exists: the challenge itself, the answer, and the
// negotiation over which night. Both Barracks put slots on the table; where the
// two agree, an overlap appears — and the overlap is what gets confirmed.

type OrgLite = { name: string; tag: string; region: string; timezone: string };

type Local = {
  stage: ChallengeStage;
  slots: SlotProposal[];
  agreed: string | null; // `${day} ${time}`
  declined: boolean;
};

const btn =
  "hq-mono rounded-[3px] border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors";

const TIMES = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30"];

export function ChallengeBoard({
  challenges,
  orgs,
  gameNames,
}: {
  challenges: Challenge[];
  orgs: Record<string, OrgLite>;
  gameNames: Record<string, string>;
}) {
  const [state, setState] = useState<Record<string, Local>>(() =>
    Object.fromEntries(
      challenges.map((c) => [
        c.id,
        { stage: c.stage, slots: c.slots ?? [], agreed: null, declined: false } satisfies Local,
      ]),
    ),
  );
  const [adding, setAdding] = useState<string | null>(null);
  const [day, setDay] = useState("Fri");
  const [time, setTime] = useState("20:30");

  function set(id: string, patch: Partial<Local>) {
    setState((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  }

  if (challenges.length === 0) return <Nil>No challenge traffic</Nil>;

  return (
    <div className="flex flex-col gap-3">
      {challenges.map((c) => {
        const l = state[c.id];
        const org = orgs[c.org];
        const overlaps = l.slots.filter((s) => s.ours && s.theirs);
        const answered = l.stage !== "challenge";

        return (
          <article key={c.id} className="rounded-[3px] border border-rule p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Dot tone={c.incoming ? "alert" : "warn"} pulse={l.stage === "challenge"} />
                  <span className="hq-readout text-[17px] font-bold uppercase leading-none">{org?.name}</span>
                  <Tag tone={c.incoming ? "alert" : "warn"}>{c.incoming ? "Inbound" : "Outbound"}</Tag>
                  <Tag tone="info">{gameNames[c.game] ?? c.game}</Tag>
                  <Tag tone="info">{c.format}</Tag>
                </div>
                <p className="hq-mono mt-1.5 text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                  {c.id.toUpperCase()} · issued {c.issued ?? "—"} · {org?.region} · {org?.timezone}
                </p>
                <p className="mt-1 text-[13px] text-ink-soft">{c.note}</p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {l.declined ? (
                  <>
                    <Tag tone="alert" solid>Declined</Tag>
                    <button
                      onClick={() => set(c.id, { declined: false })}
                      className={`${btn} border-rule text-ink-soft hover:text-ink`}
                    >
                      Undo
                    </button>
                  </>
                ) : !answered ? (
                  <>
                    <button
                      onClick={() => set(c.id, { stage: "accepted" })}
                      className={btn}
                      style={{ borderColor: "var(--color-moss)", backgroundColor: "var(--color-moss)", color: "#0b100e" }}
                    >
                      Accept challenge
                    </button>
                    <button
                      onClick={() => set(c.id, { declined: true })}
                      className={`${btn} border-rule text-ink-soft hover:border-flag hover:text-flag`}
                    >
                      Decline
                    </button>
                  </>
                ) : l.agreed ? (
                  <Tag tone="live" solid>Night agreed · {l.agreed}</Tag>
                ) : (
                  <button
                    onClick={() => {
                      setAdding(adding === c.id ? null : c.id);
                      set(c.id, { stage: "scheduling" });
                    }}
                    className={`${btn} border-sand text-sand hover:bg-[rgba(245,182,61,0.12)]`}
                  >
                    Propose a night
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3">
              <Stepper stage={l.stage} compact />
              <p className="hq-mono mt-1.5 text-[10px] uppercase tracking-[0.08em] text-ink-soft">
                {l.declined ? "Declined. The challenge is closed — they may issue another." : STAGE_BLURB[l.stage]}
              </p>
            </div>

            {answered && (
              <div className="mt-3 border-t border-rule/60 pt-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="hq-label">Nights on the table</span>
                  <span className="hq-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: overlaps.length ? "var(--color-moss)" : "var(--color-sand)" }}>
                    {overlaps.length ? `${overlaps.length} overlap${overlaps.length > 1 ? "s" : ""}` : "No overlap yet"}
                  </span>
                </div>

                {l.slots.length === 0 ? (
                  <p className="hq-mono py-2 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                    Nothing proposed. Put a night forward.
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {l.slots.map((s) => {
                      const key = `${s.day} ${s.time}`;
                      const overlap = s.ours && s.theirs;
                      const locked = l.agreed === key;
                      return (
                        <li
                          key={key}
                          className="flex flex-wrap items-center gap-3 border-b border-rule/50 py-1.5 last:border-0"
                          style={{ backgroundColor: overlap ? "rgba(61,220,132,0.05)" : undefined }}
                        >
                          <span className="hq-mono w-28 shrink-0 text-[12px] uppercase tracking-[0.08em]">
                            {s.day} {s.date}
                          </span>
                          <span className="hq-mono w-14 shrink-0 text-[13px]" style={{ color: overlap ? "var(--color-moss)" : "var(--color-ink)" }}>
                            {s.time}
                          </span>
                          <button
                            onClick={() =>
                              set(c.id, {
                                slots: l.slots.map((x) => (x.day === s.day && x.time === s.time ? { ...x, ours: !x.ours } : x)),
                              })
                            }
                            className={`${btn} w-24`}
                            style={{
                              borderColor: s.ours ? "var(--color-moss)" : "var(--color-rule)",
                              color: s.ours ? "var(--color-moss)" : "var(--color-ink-soft)",
                            }}
                          >
                            BRK {s.ours ? "✓" : "—"}
                          </button>
                          <span
                            className={`${btn} w-24 text-center`}
                            style={{
                              borderColor: s.theirs ? "var(--color-flag)" : "var(--color-rule)",
                              color: s.theirs ? "var(--color-flag)" : "var(--color-ink-soft)",
                            }}
                          >
                            {org?.tag} {s.theirs ? "✓" : "—"}
                          </span>
                          <span className="min-w-0 flex-1" />
                          {locked ? (
                            <Tag tone="live" solid>Confirmed</Tag>
                          ) : overlap ? (
                            <button
                              onClick={() => set(c.id, { agreed: key, stage: "confirmed" })}
                              className={`${btn} border-sand`}
                              style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
                            >
                              Agree this night
                            </button>
                          ) : (
                            <span className="hq-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                              {s.ours ? "Awaiting them" : "Their slot"}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {adding === c.id && !l.agreed && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={day}
                      onChange={(e) => setDay(e.target.value)}
                      className="hq-mono rounded-[3px] border border-rule bg-[rgba(0,0,0,0.3)] px-2 py-1 text-[11px] uppercase tracking-[0.1em] outline-none focus:border-sand"
                    >
                      {NIGHTS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <select
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="hq-mono rounded-[3px] border border-rule bg-[rgba(0,0,0,0.3)] px-2 py-1 text-[11px] tracking-[0.1em] outline-none focus:border-sand"
                    >
                      {TIMES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (l.slots.some((s) => s.day === day && s.time === time)) return;
                        set(c.id, {
                          slots: [...l.slots, { day, date: "", time, ours: true, theirs: false }],
                        });
                      }}
                      className={`${btn} border-moss text-moss hover:bg-[rgba(61,220,132,0.12)]`}
                    >
                      Put it forward
                    </button>
                    <span className="hq-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                      Sent to {org?.name} for marking
                    </span>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
