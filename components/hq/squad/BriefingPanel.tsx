import Link from "next/link";
import { Panel, Row, Tag, Dot, Proto } from "@/components/hq/Kit";
import { Terminal } from "@/components/hq/squad/Terminal";
import {
  callsign,
  loadoutFor,
  mapRotation,
  OBJECTIVES,
  operationName,
  squadRecord,
} from "@/components/hq/squad/proto";
import { compHeading } from "@/lib/games";
import { heroDate, shortTime } from "@/lib/dates";
import type { Competition, Profile } from "@/lib/types";

// BRIEFING // OPERATION [name] — the shooter surface, and the fallback for any
// game without a specialised panel. The roster and the deployment are real;
// roles, loadouts, maps and objectives are a prototype.

type Member = { profile: Profile; is_captain: boolean };

const STATE_TONE = { played: "idle", live: "live", queued: "warn" } as const;

export function BriefingPanel({
  squadId,
  gameName,
  members,
  fixtures,
}: {
  squadId: string;
  gameName: string;
  members: Member[];
  fixtures: Competition[];
}) {
  const op = operationName(squadId);
  const maps = mapRotation(squadId);
  const rec = squadRecord(squadId);
  const next = fixtures[0] ?? null;
  const ordered = [...members].sort((a, b) => Number(b.is_captain) - Number(a.is_captain));

  return (
    <Panel
      i={14}
      sweep
      label={`Briefing // Operation ${op}`}
      status={<Dot tone="alert" pulse />}
      right={
        <>
          <Tag tone="alert">Classified</Tag>
          <Proto />
        </>
      }
    >
      <Terminal
        lines={[
          { t: "»", m: "ESTABLISHING SECURE CHANNEL...", tone: "info" },
          { t: "»", m: `BRIEFING // OPERATION ${op}`, tone: "alert" },
          {
            t: "»",
            m: `ROSTER CONFIRMED — ${members.length} OPERATIVE${members.length === 1 ? "" : "S"} · ${gameName.toUpperCase()}`,
            tone: "live",
          },
        ]}
      />

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        {/* ── Roster, roles, loadouts ─────────────────────────────────── */}
        <div>
          <p className="hq-label mb-2" style={{ color: "var(--color-sand)" }}>
            Assignments
          </p>
          <div className="overflow-x-auto rounded-[3px] border border-rule">
            <table className="hq-mono w-full min-w-[560px] text-[12px]">
              <thead>
                <tr className="border-b border-rule text-left">
                  {["Operative", "Role", "Primary", "Secondary", "Perk"].map((h) => (
                    <th key={h} className="hq-label px-2 py-1.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordered.map((m, i) => {
                  const lo = loadoutFor(squadId, i);
                  return (
                    <tr
                      key={m.profile.id}
                      className="border-b border-rule/50 transition-colors last:border-0 hover:bg-[rgba(255,255,255,0.03)]"
                    >
                      <td className="px-2 py-1.5">
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-3.5 w-[3px] rounded-[1px]"
                            style={{ backgroundColor: m.profile.colour }}
                          />
                          <span className="font-semibold tracking-[0.08em]">
                            {callsign(m.profile.name, m.profile.nickname)}
                          </span>
                          {m.is_captain && <Tag tone="warn">Capt</Tag>}
                        </span>
                      </td>
                      <td className="px-2 py-1.5" style={{ color: "var(--color-moss)" }}>
                        {lo.role}
                      </td>
                      <td className="px-2 py-1.5">{lo.primary}</td>
                      <td className="px-2 py-1.5 text-ink-soft">{lo.secondary}</td>
                      <td className="px-2 py-1.5 text-ink-soft">{lo.perk}</td>
                    </tr>
                  );
                })}
                {ordered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="hq-label px-2 py-6 text-center">
                      No operatives assigned
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="hq-label mb-2 mt-4" style={{ color: "var(--color-sand)" }}>
            Objectives
          </p>
          <ol className="flex flex-col">
            {OBJECTIVES.map((o, i) => (
              <li
                key={o}
                className="flex items-start gap-3 border-b border-rule/60 py-1.5 last:border-0"
              >
                <span className="hq-mono shrink-0 text-[11px] text-ink-soft">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[13px]">{o}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* ── Map rotation, deployment, record ────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="hq-label mb-2" style={{ color: "var(--color-sand)" }}>
              Map rotation
            </p>
            <ul className="flex flex-col rounded-[3px] border border-rule">
              {maps.map((m, i) => (
                <li
                  key={m.map}
                  className="flex items-center gap-3 border-b border-rule/50 px-3 py-2 last:border-0"
                >
                  <span className="hq-mono w-5 shrink-0 text-[11px] text-ink-soft">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Dot tone={STATE_TONE[m.state]} pulse={m.state === "live"} />
                  <span
                    className="hq-mono min-w-0 flex-1 truncate text-[12px] font-semibold tracking-[0.08em]"
                    style={{ opacity: m.state === "played" ? 0.55 : 1 }}
                  >
                    {m.map}
                  </span>
                  <span className="hq-mono shrink-0 text-[11px] text-ink-soft">{m.mode}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="hq-label mb-2" style={{ color: "var(--color-sand)" }}>
              Next deployment
            </p>
            {next ? (
              <Link
                href={`/hq/operations/${next.id}`}
                className="flex items-center gap-3 rounded-[3px] border border-rule px-3 py-2.5 transition-colors hover:border-sand"
              >
                <span className="text-center">
                  <span className="hq-label block">{heroDate(next.date).dow}</span>
                  <span
                    className="hq-readout block text-[24px] font-bold leading-none"
                    style={{ color: "var(--color-flag)" }}
                  >
                    {heroDate(next.date).day}
                  </span>
                  <span className="hq-label block">{heroDate(next.date).mon}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{compHeading(next)}</span>
                  <span className="hq-mono block text-[11px] text-ink-soft">
                    {shortTime(next.tee_time) || "time TBC"}
                    {next.stake ? ` · ${next.stake}` : ""}
                  </span>
                </span>
              </Link>
            ) : (
              <p className="hq-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                Nothing on the board
              </p>
            )}
          </div>

          <div>
            <p className="hq-label mb-2" style={{ color: "var(--color-sand)" }}>
              Combat record <span className="opacity-60">· prototype</span>
            </p>
            <Row k="Engagements" v={rec.played} />
            <Row k="Won / Lost" v={`${rec.won} — ${rec.lost}`} tone="live" />
            <Row k="Win rate" v={`${rec.pct}%`} />
            <Row k="Streak" v={rec.streak} tone={rec.streak.startsWith("W") ? "live" : "alert"} />
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
              Rules of engagement
            </p>
            <Row k="Comms" v="Mandatory · squad channel" />
            <Row k="Roll call" v="15 minutes before kick-off" />
            <Row k="Evidence" v="Screenshot the final board" />
            <Row k="Conduct" v="Court applies. Behave." tone="alert" />
          </div>
        </div>
      </div>
    </Panel>
  );
}
