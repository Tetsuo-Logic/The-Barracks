import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCourtData } from "@/lib/hq/overview";
import { compHeading } from "@/lib/games";
import { shortDate, relativeTime } from "@/lib/dates";
import { Avatar } from "@/components/Avatar";
import { Panel, Stat, Dot, Tag, Row, Meter, PageHead, Nil } from "@/components/hq/Kit";
import type { Competition, Complaint, Mutiny, Profile, Trial } from "@/lib/domain";

export const metadata = { title: "The Court · Barracks HQ" };

// ── THE COURT ──────────────────────────────────────────────────────────────
// A tribunal that takes itself extremely seriously about extremely small
// things. Everything here is real: complaints before the President, court
// martials with verdicts and penalties, motions against command, and the
// strikes and warnings that fall out of them. Case numbers are assigned by the
// register in the order things were filed — CASE #001 upward, forever.

type CaseRow =
  | { no: number; kind: "complaint"; at: string; open: boolean; c: Complaint }
  | { no: number; kind: "trial"; at: string; open: boolean; t: Trial }
  | { no: number; kind: "mutiny"; at: string; open: boolean; m: Mutiny };

const caseNo = (n: number) => `CASE #${String(n).padStart(3, "0")}`;

function stamp(iso: string): string {
  const d = iso.slice(0, 10);
  return `${shortDate(d)} ${d.slice(2, 4)}`;
}

export default async function CourtPage() {
  const me = await requireProfile();
  const supabase = await createClient();

  const [court, { data: warnRows }, { data: strikeRows }, { data: voteRows }, { data: compRows }] =
    await Promise.all([
      getCourtData(),
      supabase.from("warnings").select("id, player_id, reason, trial_id, created_at"),
      supabase.from("strikes").select("id, player_id, reason, created_at"),
      supabase.from("trial_votes").select("trial_id, vote, penalty"),
      supabase.from("competitions").select("*"),
    ]);

  const { complaints, trials, mutinies, profiles } = court;
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const president = profiles.find((p) => p.is_president) ?? null;
  const compById = new Map(((compRows ?? []) as Competition[]).map((c) => [c.id, c]));

  const warnings = (warnRows ?? []) as {
    id: string;
    player_id: string | null;
    reason: string | null;
    trial_id: string | null;
    created_at: string;
  }[];
  const strikes = (strikeRows ?? []) as {
    id: string;
    player_id: string | null;
    reason: string | null;
    created_at: string;
  }[];
  const votes = (voteRows ?? []) as {
    trial_id: string;
    vote: string;
    penalty: string | null;
  }[];

  const votesByTrial = new Map<string, { guilty: number; not: number }>();
  for (const v of votes) {
    const t = votesByTrial.get(v.trial_id) ?? { guilty: 0, not: 0 };
    if (v.vote === "guilty") t.guilty++;
    else t.not++;
    votesByTrial.set(v.trial_id, t);
  }

  // ── The register: one running case number across every kind of case ──────
  const register: CaseRow[] = [
    ...complaints.map((c) => ({
      kind: "complaint" as const,
      at: c.created_at,
      open: c.status === "open",
      c,
    })),
    ...trials.map((t) => ({
      kind: "trial" as const,
      at: t.created_at,
      open: t.status === "open",
      t,
    })),
    ...mutinies.map((m) => ({
      kind: "mutiny" as const,
      at: m.created_at,
      open: m.status === "voting",
      m,
    })),
  ]
    .sort((a, b) => (a.at < b.at ? -1 : 1))
    .map((row, i) => ({ ...row, no: i + 1 }) as CaseRow);

  const byNewest = [...register].sort((a, b) => (a.at < b.at ? 1 : -1));
  const active = byNewest.filter((r) => r.open);
  const archived = byNewest.filter((r) => !r.open);

  const openTrials = register.filter(
    (r): r is Extract<CaseRow, { kind: "trial" }> => r.kind === "trial" && r.open,
  );
  const openComplaints = register.filter(
    (r): r is Extract<CaseRow, { kind: "complaint" }> => r.kind === "complaint" && r.open,
  );
  const liveMutinies = register.filter(
    (r): r is Extract<CaseRow, { kind: "mutiny" }> => r.kind === "mutiny",
  );

  const decided = trials.filter((t) => t.verdict);
  const guilty = decided.filter((t) => t.verdict === "guilty").length;
  const guiltyRate = decided.length ? Math.round((guilty / decided.length) * 100) : 0;

  // Marks by person — the standing conduct ledger the court keeps.
  const ledger = profiles
    .map((p) => ({
      profile: p,
      warnings: warnings.filter((w) => w.player_id === p.id),
      strikes: strikes.filter((s) => s.player_id === p.id),
    }))
    .filter((r) => r.warnings.length + r.strikes.length > 0)
    .sort(
      (a, b) =>
        b.strikes.length * 3 + b.warnings.length - (a.strikes.length * 3 + a.warnings.length),
    );

  return (
    <div>
      <PageHead
        eyebrow="Barracks judiciary"
        title="The Court"
        right={
          <>
            <Link
              href="/board"
              className="hq-label rounded-[3px] px-3 py-2 font-semibold"
              style={{ backgroundColor: "var(--color-flag)", color: "#0b100e" }}
            >
              ⚖ File a complaint
            </Link>
            <Link
              href="/trial"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              Courtroom
            </Link>
          </>
        }
      >
        {president ? (
          <>
            <span className="text-ink">{president.name}</span> presides ·{" "}
            {active.length} case{active.length === 1 ? "" : "s"} before the bench ·{" "}
            {register.length} on the register
          </>
        ) : (
          <>No President appointed — the bench is empty · {register.length} on the register</>
        )}
      </PageHead>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-6">
        <Panel i={0}>
          <div className="flex items-center gap-2">
            <Dot tone={active.length ? "alert" : "live"} pulse={active.length > 0} />
            <span className="hq-label">Bench</span>
          </div>
          <p
            className="hq-readout mt-2 text-[20px] font-bold uppercase"
            style={{ color: active.length ? "var(--color-flag)" : "var(--color-moss)" }}
          >
            {active.length ? "IN SESSION" : "ADJOURNED"}
          </p>
        </Panel>
        <Panel i={1}>
          <Stat value={register.length} label="Cases on the register" />
        </Panel>
        <Panel i={2}>
          <Stat
            value={openComplaints.length}
            label="Before the President"
            tone={openComplaints.length ? "warn" : undefined}
          />
        </Panel>
        <Panel i={3}>
          <Stat
            value={openTrials.length}
            label="Court martials open"
            tone={openTrials.length ? "alert" : undefined}
          />
        </Panel>
        <Panel i={4}>
          <Stat
            value={`${guilty}/${decided.length}`}
            label="Guilty verdicts"
            sub={decided.length ? `${guiltyRate}% conviction rate` : "No verdicts yet"}
          />
        </Panel>
        <Panel i={5}>
          <Stat
            value={strikes.length}
            label="Strikes issued"
            tone={strikes.length ? "alert" : undefined}
            sub={`${warnings.length} warnings on file`}
          />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        {/* ── Left: the cases ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel
            i={6}
            sweep
            label="Active cases"
            status={<Dot tone={active.length ? "alert" : "idle"} pulse={active.length > 0} />}
            right={<span className="hq-mono text-[11px] text-ink-soft">{active.length} live</span>}
          >
            {active.length === 0 ? (
              <Nil>No cases before the bench — a peaceful reign</Nil>
            ) : (
              <div className="flex flex-col gap-3">
                {active.map((row, i) => (
                  <CaseFile
                    key={`${row.kind}-${row.no}`}
                    row={row}
                    byId={byId}
                    president={president}
                    compById={compById}
                    votes={row.kind === "trial" ? votesByTrial.get(row.t.id) : undefined}
                    meId={me.id}
                    i={i}
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            i={7}
            label="The docket"
            pad={false}
            right={
              <span className="hq-mono text-[11px] text-ink-soft">
                Numbered in order of filing
              </span>
            }
          >
            <div className="grid grid-cols-[5.5rem_7.5rem_minmax(160px,1.4fr)_minmax(140px,1fr)_7rem_6rem] items-center gap-3 border-b border-rule px-4 py-2">
              <span className="hq-label">Case</span>
              <span className="hq-label">Type</span>
              <span className="hq-label">Matter</span>
              <span className="hq-label">Parties</span>
              <span className="hq-label">Outcome</span>
              <span className="hq-label text-right">Filed</span>
            </div>
            {byNewest.length === 0 ? (
              <Nil>The register is empty. Nobody has done anything wrong. Yet.</Nil>
            ) : (
              byNewest.map((row, i) => {
                const d = describe(row, byId);
                return (
                  <div
                    key={`${row.kind}-${row.no}`}
                    className="hq-rise grid grid-cols-[5.5rem_7.5rem_minmax(160px,1.4fr)_minmax(140px,1fr)_7rem_6rem] items-center gap-3 border-b border-rule/50 px-4 py-2 last:border-0"
                    style={{ ["--i" as string]: Math.min(i, 12) }}
                  >
                    <span
                      className="hq-mono text-[11px] font-semibold tracking-[0.08em]"
                      style={{ color: row.open ? "var(--color-flag)" : "var(--color-ink-soft)" }}
                    >
                      {caseNo(row.no)}
                    </span>
                    <span>
                      <Tag tone={d.typeTone}>{d.type}</Tag>
                    </span>
                    <span className="truncate text-[13px] text-ink">{d.matter}</span>
                    <span className="hq-mono truncate text-[11px] text-ink-soft">{d.parties}</span>
                    <span>
                      <Tag tone={d.outcomeTone}>{d.outcome}</Tag>
                    </span>
                    <span className="hq-mono text-right text-[11px] text-ink-soft">
                      {stamp(row.at)}
                    </span>
                  </div>
                );
              })
            )}
          </Panel>

          <Panel
            i={8}
            label="Archive"
            right={<span className="hq-mono text-[11px] text-ink-soft">{archived.length} closed</span>}
          >
            {archived.length === 0 ? (
              <Nil>Nothing settled yet — justice is slow here</Nil>
            ) : (
              <div className="flex flex-col gap-3">
                {archived.slice(0, 8).map((row, i) => (
                  <CaseFile
                    key={`${row.kind}-${row.no}`}
                    row={row}
                    byId={byId}
                    president={president}
                    compById={compById}
                    votes={row.kind === "trial" ? votesByTrial.get(row.t.id) : undefined}
                    meId={me.id}
                    i={i}
                    compact
                  />
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* ── Right: the bench, motions, ledger ───────────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel i={9} label="The bench">
            {president ? (
              <div className="mb-3 flex items-center gap-3">
                <Avatar
                  name={president.name}
                  avatarUrl={president.avatar_url}
                  colour={president.colour}
                  size={40}
                />
                <div className="min-w-0">
                  <p className="hq-readout truncate text-[17px] font-bold uppercase leading-none">
                    {president.name}
                  </p>
                  <p className="hq-mono mt-1 text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                    Presiding · rules on complaints
                  </p>
                </div>
              </div>
            ) : (
              <Nil>No President — nobody may rule</Nil>
            )}
            <Row k="Cases heard" v={decided.length} />
            <Row k="Guilty" v={guilty} tone={guilty ? "alert" : "idle"} />
            <Row k="Not guilty" v={decided.length - guilty} tone="live" />
            <Row k="Motions faced" v={mutinies.length} tone={mutinies.length ? "warn" : "idle"} />
            <p className="hq-mono mt-3 text-[10px] uppercase leading-relaxed tracking-[0.1em] text-ink-soft">
              A ruler never sits in judgement on themselves. A case about the President goes to
              the ranks — quietly.
            </p>
          </Panel>

          <Panel
            i={10}
            label="Motions against command"
            status={<Dot tone={liveMutinies.some((r) => r.open) ? "alert" : "idle"} pulse={liveMutinies.some((r) => r.open)} />}
            right={<span className="hq-mono text-[11px] text-ink-soft">🏴</span>}
          >
            {liveMutinies.length === 0 ? (
              <Nil>No motions on the record — command is safe</Nil>
            ) : (
              <ul className="flex flex-col gap-3">
                {liveMutinies.map((row) => {
                  const m = row.m;
                  const raiser = m.raised_by ? byId.get(m.raised_by) : null;
                  const target = m.target_id ? byId.get(m.target_id) : null;
                  const cast = m.agree_count + m.against_count;
                  const pct = m.eligible_count ? Math.round((cast / m.eligible_count) * 100) : 0;
                  const tone =
                    m.status === "carried" ? "alert" : m.status === "voting" ? "warn" : "idle";
                  return (
                    <li key={m.id} className="rounded-[3px] border border-rule p-3">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="hq-mono text-[11px] font-semibold tracking-[0.08em] text-ink-soft">
                          {caseNo(row.no)}
                        </span>
                        <Tag tone={tone} solid={m.status === "carried"}>
                          {m.status === "voting"
                            ? "Before the ranks"
                            : m.status === "carried"
                              ? "Carried"
                              : "Failed"}
                        </Tag>
                      </div>
                      <p className="text-[13px] text-ink">“{m.reason}”</p>
                      <p className="hq-mono mt-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                        {raiser?.name ?? "Someone"} moved against {target?.name ?? "the President"} ·{" "}
                        {relativeTime(m.created_at)}
                      </p>
                      <div className="mt-2">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="hq-mono text-[11px]">
                            <span style={{ color: "var(--color-flag)" }}>{m.agree_count} for</span>
                            <span className="text-ink-soft"> · {m.against_count} against</span>
                          </span>
                          <span className="hq-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                            {cast}/{m.eligible_count} voted
                          </span>
                        </div>
                        <Meter pct={pct} tone={m.status === "carried" ? "alert" : "warn"} />
                      </div>
                      {m.judge_id && (
                        <p className="hq-mono mt-2 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--color-sand)" }}>
                          {byId.get(m.judge_id)?.name ?? "A judge"} presiding in the President&apos;s place
                        </p>
                      )}
                      {m.trial_id && (
                        <Link href={`/trial/${m.trial_id}`} className="hq-label mt-2 inline-block hover:text-ink">
                          Open case file →
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            i={11}
            label="Conduct ledger"
            right={<span className="hq-mono text-[11px] text-ink-soft">{strikes.length}S · {warnings.length}W</span>}
          >
            {ledger.length === 0 ? (
              <Nil>Not one mark on the record. Suspicious.</Nil>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {ledger.map((r) => (
                  <li key={r.profile.id} className="border-b border-rule/60 pb-2.5 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={r.profile.name}
                        avatarUrl={r.profile.avatar_url}
                        colour={r.profile.colour}
                        size={22}
                      />
                      <Link
                        href={`/hq/personnel/${r.profile.id}`}
                        className="min-w-0 flex-1 truncate text-[13px] text-ink hover:underline"
                      >
                        {r.profile.name}
                      </Link>
                      {r.strikes.length > 0 && <Tag tone="alert">{r.strikes.length} strike</Tag>}
                      {r.warnings.length > 0 && <Tag tone="warn">{r.warnings.length} warn</Tag>}
                    </div>
                    <ul className="mt-1 flex flex-col gap-0.5 pl-8">
                      {[...r.strikes.map((s) => ({ ...s, k: "STRIKE" })), ...r.warnings.map((w) => ({ ...w, k: "WARNING" }))]
                        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                        .slice(0, 3)
                        .map((m) => (
                          <li key={m.id} className="hq-mono truncate text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                            <span style={{ color: m.k === "STRIKE" ? "var(--color-flag)" : "var(--color-sand)" }}>
                              {m.k}
                            </span>{" "}
                            · {m.reason || "no reason entered"} · {stamp(m.created_at)}
                          </li>
                        ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel i={12} label="Standing orders">
            <Row k="File a complaint" v="Any operative" />
            <Row k="Ruled by" v="President / CO" tone="warn" />
            <Row k="Second opinion" v="Named by the bench" />
            <Row k="Referral to court" v="CO only" tone="warn" />
            <Row k="Verdict" v="Unanimous jury" tone="alert" />
            <Row k="Warnings per strike" v="3" tone="warn" />
            <p className="hq-mono mt-3 text-[10px] uppercase leading-relaxed tracking-[0.1em] text-ink-soft">
              Warnings stack. Three of them roll into a strike, and nobody has ever argued their
              way out of the third.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ── Docket summary line ───────────────────────────────────────────────────
function describe(
  row: CaseRow,
  byId: Map<string, Profile>,
): {
  type: string;
  typeTone: "alert" | "warn" | "info";
  matter: string;
  parties: string;
  outcome: string;
  outcomeTone: "alert" | "warn" | "live" | "idle" | "info";
} {
  if (row.kind === "complaint") {
    const c = row.c;
    const filer = c.filed_by ? byId.get(c.filed_by)?.name : null;
    const against = c.against_id ? byId.get(c.against_id)?.name : null;
    return {
      type: "Complaint",
      typeTone: "warn",
      matter: c.reason,
      parties: `${filer ?? "Someone"} v ${against ?? "no one in particular"}`,
      outcome: c.status === "open" ? "Pending" : "Ruled",
      outcomeTone: c.status === "open" ? "warn" : "live",
    };
  }
  if (row.kind === "trial") {
    const t = row.t;
    const def = byId.get(t.defendant_id)?.name ?? "Unknown";
    return {
      type: "Court martial",
      typeTone: "alert",
      matter: t.charge,
      parties: `The Barracks v ${def}`,
      outcome:
        t.status === "open"
          ? "In session"
          : t.verdict === "guilty"
            ? `Guilty · ${t.penalty ?? "penalty"}`
            : "Not guilty",
      outcomeTone:
        t.status === "open" ? "alert" : t.verdict === "guilty" ? "alert" : "live",
    };
  }
  const m = row.m;
  const raiser = m.raised_by ? byId.get(m.raised_by)?.name : null;
  const target = m.target_id ? byId.get(m.target_id)?.name : null;
  return {
    type: "Motion 🏴",
    typeTone: "alert",
    matter: m.reason,
    parties: `${raiser ?? "The ranks"} v ${target ?? "the President"}`,
    outcome: m.status === "voting" ? "Voting" : m.status === "carried" ? "Carried" : "Failed",
    outcomeTone: m.status === "carried" ? "alert" : m.status === "voting" ? "warn" : "idle",
  };
}

// ── One case, laid out like a file the clerk pulled ───────────────────────
function CaseFile({
  row,
  byId,
  president,
  compById,
  votes,
  meId,
  i,
  compact = false,
}: {
  row: CaseRow;
  byId: Map<string, Profile>;
  president: Profile | null;
  compById: Map<string, Competition>;
  votes?: { guilty: number; not: number };
  meId: string;
  i: number;
  compact?: boolean;
}) {
  const d = describe(row, byId);
  const who = (id: string | null | undefined) =>
    id ? (id === meId ? "You" : (byId.get(id)?.name ?? "Someone")) : null;

  return (
    <article
      className="hq-rise rounded-[3px] border p-4"
      style={{
        ["--i" as string]: Math.min(i, 10),
        borderColor: row.open ? "color-mix(in srgb, var(--color-flag) 40%, transparent)" : "var(--color-rule)",
        backgroundColor: row.open ? "rgba(255,91,59,0.035)" : "transparent",
      }}
    >
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className="hq-readout text-[15px] font-bold tracking-[0.06em]"
          style={{ color: row.open ? "var(--color-flag)" : "var(--color-ink-soft)" }}
        >
          {caseNo(row.no)}
        </span>
        <Tag tone={d.typeTone}>{d.type}</Tag>
        <Tag tone={d.outcomeTone} solid={row.kind === "trial" && !row.open}>
          {d.outcome}
        </Tag>
        <span className="hq-mono ml-auto text-[10px] uppercase tracking-[0.12em] text-ink-soft">
          Filed {stamp(row.at)} · {relativeTime(row.at)}
        </span>
      </header>

      {row.kind === "complaint" && (
        <>
          <Statement label="The accusation" body={row.c.reason} tone="flag" />
          {row.c.comment && (
            <p className="mt-1 text-[12px] italic text-ink-soft">“{row.c.comment}”</p>
          )}
          {row.c.action && (
            <p className="hq-mono mt-1.5 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--color-sand)" }}>
              Action sought — {row.c.action}
            </p>
          )}
          <Statement
            label={`Defence${who(row.c.against_id) ? ` — ${who(row.c.against_id)}` : ""}`}
            body={row.c.response}
            fallback="The accused has not yet spoken."
          />
          <Statement
            label={`Second opinion${who(row.c.second_opinion_by) ? ` — ${who(row.c.second_opinion_by)}` : ""}`}
            body={row.c.second_opinion}
            fallback={row.c.second_opinion_by ? "Opinion sought — still waiting." : "None sought."}
            tone="moss"
          />
          {row.c.second_opinion_to_court && (
            <p className="hq-mono mt-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--color-flag)" }}>
              Reckons it&apos;s one for the court
            </p>
          )}
          <Statement
            label="Ruling"
            body={row.c.ruling}
            fallback={row.c.status === "open" ? "Reserved — the bench has not ruled." : "Dismissed without comment."}
            tone="sand"
          />
        </>
      )}

      {row.kind === "trial" && (
        <>
          {row.t.competition_id && compById.get(row.t.competition_id) && (
            <p className="hq-mono mb-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-soft">
              Arising from {compHeading(compById.get(row.t.competition_id)!)} ·{" "}
              {shortDate(compById.get(row.t.competition_id)!.date)}
            </p>
          )}
          <Statement label="The charge" body={row.t.charge} tone="flag" />
          <Statement
            label={`Defence — ${who(row.t.defendant_id) ?? "the accused"}`}
            body={row.t.defence}
            fallback="Silence on the record."
          />
          {votes && (
            <p className="hq-mono mt-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-soft">
              Jury — {votes.guilty} guilty · {votes.not} not guilty
              {row.t.jury_opened ? " · jury consulted" : ""}
            </p>
          )}
          {row.t.note && (
            <Statement label="Note on the record" body={row.t.note} tone="sand" />
          )}
          {row.t.verdict ? (
            <p
              className="hq-readout mt-2 text-[17px] font-bold uppercase tracking-[0.04em]"
              style={{
                color: row.t.verdict === "guilty" ? "var(--color-flag)" : "var(--color-moss)",
              }}
            >
              {row.t.verdict === "guilty" ? "GUILTY" : "NOT GUILTY"}
              {row.t.penalty && (
                <span className="hq-mono ml-2 text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  penalty — {row.t.penalty}
                </span>
              )}
            </p>
          ) : (
            <p className="hq-mono mt-2 text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--color-flag)" }}>
              Verdict pending — the jury has not returned
            </p>
          )}
        </>
      )}

      {row.kind === "mutiny" && (
        <>
          <Statement label="The motion" body={row.m.reason} tone="flag" />
          <p className="hq-mono mt-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            {row.m.agree_count} for · {row.m.against_count} against · {row.m.eligible_count} eligible
            · votes are secret, forever
          </p>
        </>
      )}

      {!compact && (
        <footer className="mt-3 flex flex-wrap items-center gap-3 border-t border-rule/60 pt-2.5">
          <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            Parties — {d.parties}
          </span>
          <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            Bench —{" "}
            {row.kind === "trial" && row.t.judge_id
              ? (byId.get(row.t.judge_id)?.name ?? "Named judge")
              : row.kind === "complaint" && row.c.addressed_by
                ? (byId.get(row.c.addressed_by)?.name ?? "The President")
                : row.kind === "mutiny"
                  ? "The ranks"
                  : (president?.name ?? "Vacant")}
          </span>
          {row.kind === "trial" && (
            <Link href={`/trial/${row.t.id}`} className="hq-label ml-auto hover:text-ink">
              Open case file →
            </Link>
          )}
          {row.kind === "complaint" && (
            <Link href="/board" className="hq-label ml-auto hover:text-ink">
              Before the President →
            </Link>
          )}
        </footer>
      )}
    </article>
  );
}

/** A block of testimony. Empty is still a fact — the court says so. */
function Statement({
  label,
  body,
  fallback,
  tone = "rule",
}: {
  label: string;
  body?: string | null;
  fallback?: string;
  tone?: "rule" | "flag" | "moss" | "sand";
}) {
  const colour =
    tone === "flag"
      ? "var(--color-flag)"
      : tone === "moss"
        ? "var(--color-moss)"
        : tone === "sand"
          ? "var(--color-sand)"
          : "var(--color-rule)";
  if (!body && !fallback) return null;
  return (
    <div className="mt-2 border-l-2 pl-3" style={{ borderColor: colour }}>
      <p
        className="hq-mono text-[9px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: tone === "rule" ? "var(--color-ink-soft)" : colour }}
      >
        {label}
      </p>
      <p className={`text-[13px] ${body ? "text-ink" : "text-ink-soft"}`}>{body || fallback}</p>
    </div>
  );
}
