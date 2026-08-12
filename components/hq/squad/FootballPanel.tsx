import Link from "next/link";
import { Panel, Row, Tag, Dot, Proto } from "@/components/hq/Kit";
import { Terminal } from "@/components/hq/squad/Terminal";
import { callsign, FORMATION_4231, TACTICS, squadRecord } from "@/components/hq/squad/proto";
import { compHeading } from "@/lib/games";
import { heroDate, shortTime } from "@/lib/dates";
import type { Competition, Profile } from "@/lib/types";

// FIFA SQUAD // MATCH COMMAND — the football squad's specialised surface.
// Members and fixtures are real; the shape, the tactics and the record are a
// prototype until team sheets have a schema.

type Member = { profile: Profile; is_captain: boolean };

export function FootballPanel({
  squadId,
  squadName,
  members,
  fixtures,
}: {
  squadId: string;
  squadName: string;
  members: Member[];
  fixtures: Competition[];
}) {
  const slots = FORMATION_4231.slots;
  // Captain takes the armband slot he'd actually want — centre of the park.
  const ordered = [...members].sort((a, b) => Number(b.is_captain) - Number(a.is_captain));
  const xi = slots.map((slot, i) => ({ slot, member: ordered[i] ?? null }));
  const named = xi.filter((s) => s.member).length;
  const bench = ordered.slice(slots.length);
  const rec = squadRecord(squadId);

  return (
    <Panel
      i={14}
      sweep
      label="FIFA squad // Match command"
      status={<Dot tone="live" pulse />}
      right={
        <>
          <Tag tone="warn">{FORMATION_4231.name}</Tag>
          <Proto />
        </>
      }
    >
      <Terminal
        lines={[
          { t: "»", m: "LOADING TEAM SHEET...", tone: "info" },
          { t: "»", m: `FORMATION CONFIRMED // ${FORMATION_4231.name}`, tone: "live" },
          {
            t: "»",
            m: `STARTING XI LOCKED — ${named} NAMED · ${11 - named} SLOTS OPEN`,
            tone: named === 11 ? "live" : "warn",
          },
        ]}
      />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(300px,400px)_1fr]">
        {/* ── The pitch ───────────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-[3px] border border-rule"
          style={{
            aspectRatio: "3 / 4",
            background:
              "linear-gradient(180deg, rgba(61,220,132,0.09), rgba(11,16,14,0.55) 55%, rgba(61,220,132,0.05))",
          }}
        >
          <PitchLines />
          {xi.map(({ slot, member }, i) => (
            <div
              key={`${slot.code}-${i}`}
              className="absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            >
              <span
                className="hq-mono flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold"
                style={
                  member
                    ? {
                        backgroundColor: member.is_captain
                          ? "var(--color-sand)"
                          : "color-mix(in srgb, var(--color-moss) 22%, transparent)",
                        border: `1px solid ${member.is_captain ? "var(--color-sand)" : "var(--color-moss)"}`,
                        color: member.is_captain ? "#0b100e" : "var(--color-moss)",
                      }
                    : {
                        border: "1px dashed var(--color-rule)",
                        color: "var(--color-ink-soft)",
                        opacity: 0.7,
                      }
                }
              >
                {i + 1}
              </span>
              <span
                className="hq-mono w-full truncate text-center text-[9px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: member ? "var(--color-ink)" : "var(--color-ink-soft)" }}
                title={member ? member.profile.name : `${slot.role} — vacant`}
              >
                {member ? callsign(member.profile.name, member.profile.nickname) : slot.code}
              </span>
              {member?.is_captain && (
                <span
                  className="hq-mono text-[8px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "var(--color-sand)" }}
                >
                  © Capt
                </span>
              )}
            </div>
          ))}
          <p className="hq-label absolute bottom-2 left-0 right-0 text-center opacity-50">
            Attacking ↑ · {squadName}
          </p>
        </div>

        {/* ── Team sheet, bench, fixtures, tactics ────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="hq-label mb-2" style={{ color: "var(--color-sand)" }}>
              Starting XI
            </p>
            <ul className="flex flex-col">
              {xi.map(({ slot, member }, i) => (
                <li
                  key={`sheet-${slot.code}-${i}`}
                  className="flex items-center gap-2.5 border-b border-rule/60 py-1 last:border-0"
                >
                  <span className="hq-mono w-5 shrink-0 text-[11px] text-ink-soft">{i + 1}</span>
                  <span
                    className="hq-mono w-10 shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: "var(--color-moss)" }}
                  >
                    {slot.code}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate text-[13px]"
                    style={{ color: member ? "var(--color-ink)" : "var(--color-ink-soft)" }}
                  >
                    {member ? member.profile.name : "— slot open —"}
                  </span>
                  {member?.is_captain && <Tag tone="warn">Captain</Tag>}
                </li>
              ))}
            </ul>

            <p className="hq-label mb-2 mt-4">Bench</p>
            {bench.length === 0 ? (
              <p className="hq-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                No substitutes named
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {bench.map((m) => (
                  <li key={m.profile.id}>
                    <Tag tone="idle">{callsign(m.profile.name, m.profile.nickname)}</Tag>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <p className="hq-label mb-2" style={{ color: "var(--color-sand)" }}>
                Fixtures
              </p>
              {fixtures.length === 0 ? (
                <p className="hq-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                  No fixtures on the board
                </p>
              ) : (
                <ul className="flex flex-col">
                  {fixtures.slice(0, 5).map((c) => {
                    const hd = heroDate(c.date);
                    return (
                      <li key={c.id}>
                        <Link
                          href={`/hq/operations/${c.id}`}
                          className="flex items-center gap-3 border-b border-rule/60 py-1.5 last:border-0 transition-colors hover:bg-[rgba(255,255,255,0.025)]"
                        >
                          <span className="hq-mono w-14 shrink-0 text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                            {hd.dow} {hd.day}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px]">
                            {compHeading(c)}
                          </span>
                          <span className="hq-mono shrink-0 text-[11px] text-ink-soft">
                            {shortTime(c.tee_time) || "—"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div>
              <p className="hq-label mb-2" style={{ color: "var(--color-sand)" }}>
                Team record <span className="opacity-60">· prototype</span>
              </p>
              <Row k="Played" v={rec.played} />
              <Row k="Won / Lost" v={`${rec.won} — ${rec.lost}`} tone="live" />
              <Row k="Win rate" v={`${rec.pct}%`} />
              <Row
                k="Form"
                v={rec.form.map((f, i) => (
                  <span
                    key={i}
                    className="ml-1 inline-block"
                    style={{ color: f === "W" ? "var(--color-moss)" : "var(--color-flag)" }}
                  >
                    {f}
                  </span>
                ))}
              />
            </div>

            <div>
              <p className="hq-label mb-2" style={{ color: "var(--color-sand)" }}>
                Briefing
              </p>
              {TACTICS.map((t) => (
                <Row key={t.k} k={t.k} v={t.v} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** Pitch markings — drawn, not an image, so they inherit the palette. */
function PitchLines() {
  const line = "1px solid color-mix(in srgb, var(--color-ink) 13%, transparent)";
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-3 rounded-[2px]" style={{ border: line }} />
      <div className="absolute left-3 right-3 top-1/2" style={{ borderTop: line }} />
      <div
        className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ border: line }}
      />
      {/* Penalty areas + six-yard boxes, both ends */}
      <div
        className="absolute left-1/2 top-3 h-[16%] w-[52%] -translate-x-1/2"
        style={{ border: line, borderTop: "none" }}
      />
      <div
        className="absolute left-1/2 top-3 h-[7%] w-[26%] -translate-x-1/2"
        style={{ border: line, borderTop: "none" }}
      />
      <div
        className="absolute bottom-3 left-1/2 h-[16%] w-[52%] -translate-x-1/2"
        style={{ border: line, borderBottom: "none" }}
      />
      <div
        className="absolute bottom-3 left-1/2 h-[7%] w-[26%] -translate-x-1/2"
        style={{ border: line, borderBottom: "none" }}
      />
    </div>
  );
}
