import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPlayerRecord, getSquads } from "@/lib/data";
import { gameById, compHeading } from "@/lib/games";
import { shortDate, relativeTime } from "@/lib/dates";
import { Avatar } from "@/components/Avatar";
import { Panel, Stat, Dot, Tag, Row, Meter, PageHead, Nil, Proto } from "@/components/hq/Kit";
import { MEDALS, ELECTION, presenceFor, PRESENCE_TONE } from "@/lib/hq/future/systems";
import type { Competition, Complaint, Mutiny, Profile, Trial } from "@/lib/domain";

export const metadata = { title: "Service record · Barracks HQ" };

// ── SERVICE RECORD ─────────────────────────────────────────────────────────
// A dossier, not a profile page. Everything here is drawn from the same rows
// the phone reads: attendance, assignment, conduct, court appearances — and a
// chronological service timeline assembled from real dates.

type Ev = {
  at: string; // ISO-ish, sorts lexicographically
  code: string;
  text: string;
  tone: "live" | "warn" | "alert" | "info" | "idle";
};

/** 12 AUG 26 — a stamp, not a date. */
function stamp(iso: string): string {
  const d = iso.slice(0, 10);
  return `${shortDate(d)} ${d.slice(2, 4)}`;
}

function serviceNumber(id: string): string {
  return `BRK-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export default async function ServiceRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireProfile();

  const record = await getPlayerRecord(id);
  if (!record) notFound();

  const supabase = await createClient();
  const [
    squads,
    { data: profileRows },
    { data: compRows },
    { data: rsvpRows },
    { data: memberRows },
    { data: warningRows },
    { data: strikeRows },
    { data: complaintRows },
    { data: trialRows },
    { data: mutinyRows },
  ] = await Promise.all([
    getSquads(me.id),
    supabase.from("profiles").select("*"),
    supabase.from("competitions").select("*"),
    supabase.from("rsvps").select("competition_id, status, attended, updated_at").eq("player_id", id),
    supabase.from("squad_members").select("squad_id, is_captain, created_at").eq("user_id", id),
    supabase.from("warnings").select("id, reason, trial_id, created_by, created_at").eq("player_id", id),
    supabase.from("strikes").select("id, reason, competition_id, created_by, created_at").eq("player_id", id),
    supabase
      .from("complaints")
      .select("*")
      .or(`filed_by.eq.${id},against_id.eq.${id},second_opinion_by.eq.${id}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("trials")
      .select("*")
      .or(`defendant_id.eq.${id},judge_id.eq.${id},created_by.eq.${id}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("mutinies")
      .select("*")
      .or(`raised_by.eq.${id},target_id.eq.${id},judge_id.eq.${id}`)
      .order("created_at", { ascending: false }),
  ]);

  const p = record.profile;
  const svc = record.serviceRecord;

  const profiles = (profileRows ?? []) as Profile[];
  const nameById = new Map(profiles.map((x) => [x.id, x.name]));
  const comps = (compRows ?? []) as Competition[];
  const compById = new Map(comps.map((c) => [c.id, c]));
  const rsvps = (rsvpRows ?? []) as {
    competition_id: string;
    status: string;
    attended: boolean | null;
    updated_at: string;
  }[];
  const members = (memberRows ?? []) as {
    squad_id: string;
    is_captain: boolean;
    created_at: string;
  }[];
  const warnings = (warningRows ?? []) as {
    id: string;
    reason: string | null;
    trial_id: string | null;
    created_by: string | null;
    created_at: string;
  }[];
  const strikes = (strikeRows ?? []) as {
    id: string;
    reason: string | null;
    competition_id: string | null;
    created_by: string | null;
    created_at: string;
  }[];
  const complaints = (complaintRows ?? []) as Complaint[];
  const trials = (trialRows ?? []) as Trial[];
  const mutinies = (mutinyRows ?? []) as Mutiny[];

  // ── Assignment ───────────────────────────────────────────────────────────
  const squadById = new Map(squads.map((s) => [s.squad.id, s]));
  const postings = members
    .map((m) => {
      const s = squadById.get(m.squad_id);
      return s
        ? {
            id: s.squad.id,
            name: s.squad.name || gameById(s.squad.game).name,
            game: s.squad.game,
            tag: s.squad.clan_tag,
            captain: m.is_captain,
            size: s.members.length,
            since: m.created_at,
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
  const captaincies = postings.filter((x) => x.captain);

  // Acting command — real: competitions.acting_captain_id.
  const actingFor = comps
    .filter((c) => c.acting_captain_id === id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  // ── Attendance ───────────────────────────────────────────────────────────
  const attended = rsvps
    .filter((r) => r.attended === true && compById.has(r.competition_id))
    .map((r) => compById.get(r.competition_id)!)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const missed = rsvps
    .filter((r) => r.attended === false && compById.has(r.competition_id))
    .map((r) => compById.get(r.competition_id)!)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const called = svc.operations + svc.noShows;
  const reliability = called > 0 ? Math.round((svc.operations / called) * 100) : 0;

  // ── The service timeline ─────────────────────────────────────────────────
  const events: Ev[] = [];
  events.push({
    at: p.created_at,
    code: "ENLISTED",
    text: `${p.name} enters the register${p.nickname ? ` under the callsign ${p.nickname.toUpperCase()}` : ""}.`,
    tone: "live",
  });

  if (attended[0]) {
    events.push({
      at: `${attended[0].date}T12:00:00`,
      code: "FIRST OPERATION",
      text: `Deployed — ${compHeading(attended[0])}. Blooded.`,
      tone: "live",
    });
  }

  for (const post of postings) {
    events.push({
      at: post.since,
      code: post.captain ? "APPOINTED CAPTAIN" : "POSTED",
      text: post.captain
        ? `Assumed command of ${post.name} squad.`
        : `Posted to ${post.name} squad.`,
      tone: post.captain ? "warn" : "info",
    });
  }

  for (const c of actingFor) {
    events.push({
      at: `${c.date}T11:00:00`,
      code: "ACTING CAPTAIN",
      text: `Command transferred for ${compHeading(c)} — command returned on close.`,
      tone: "warn",
    });
  }

  for (const c of missed) {
    events.push({
      at: `${c.date}T23:00:00`,
      code: "FAILED TO REPORT",
      text: `Answered the roll call, did not deploy — ${compHeading(c)}.`,
      tone: "warn",
    });
  }

  for (const c of complaints) {
    const against = c.against_id === id;
    events.push({
      at: c.created_at,
      code: against ? "COMPLAINT LODGED AGAINST" : c.filed_by === id ? "COMPLAINT FILED" : "SECOND OPINION SOUGHT",
      text: `“${c.reason}”${c.status === "addressed" ? ` — ruled on: ${c.ruling || "dismissed without comment"}` : " — before the President"}`,
      tone: against ? "alert" : "info",
    });
  }

  for (const t of trials) {
    const isDefendant = t.defendant_id === id;
    events.push({
      at: t.created_at,
      code: isDefendant ? "COURT MARTIAL" : t.judge_id === id ? "PRESIDED" : "CASE BROUGHT",
      text: isDefendant
        ? `Charged: ${t.charge}${t.verdict ? ` — ${t.verdict === "guilty" ? "GUILTY" : "NOT GUILTY"}` : " — case open"}`
        : `${t.charge}`,
      tone: t.verdict === "guilty" ? "alert" : isDefendant ? "warn" : "info",
    });
  }

  for (const m of mutinies) {
    const target = m.target_id === id;
    events.push({
      at: m.created_at,
      code: target ? "MOTION AGAINST COMMAND" : "MOTION RAISED",
      text: `${m.status === "carried" ? "Carried" : m.status === "failed" ? "Failed" : "Before the ranks"} — ${m.agree_count} for, ${m.against_count} against.`,
      tone: m.status === "carried" ? "alert" : "warn",
    });
  }

  for (const w of warnings) {
    events.push({
      at: w.created_at,
      code: "WARNING ENTERED",
      text: w.reason || "Entered on the record without comment.",
      tone: "warn",
    });
  }
  for (const s of strikes) {
    events.push({
      at: s.created_at,
      code: "STRIKE ENTERED",
      text: s.reason || "Entered on the record without comment.",
      tone: "alert",
    });
  }

  const last = attended[attended.length - 1];
  if (last && attended.length > 1) {
    events.push({
      at: `${last.date}T12:30:00`,
      code: "LAST DEPLOYMENT",
      text: `${compHeading(last)} — ${shortDate(last.date)}.`,
      tone: "info",
    });
  }

  events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  if (p.is_president) {
    events.push({
      at: "9999",
      code: "IN COMMAND",
      text: "Holds the presidency of The Barracks. Term start not on record.",
      tone: "warn",
    });
  }

  // Commendations — adapter. Matched on name, marked prototype.
  const medals = MEDALS.filter((m) => m.holders.includes(p.name));
  const medalTone = (t: "sand" | "moss" | "flag") =>
    t === "flag" ? "alert" : t === "moss" ? "live" : "warn";

  const presence = presenceFor(p.id, 0);
  const openCases =
    complaints.filter((c) => c.status === "open").length +
    trials.filter((t) => t.status === "open").length;

  return (
    <div>
      <PageHead
        eyebrow="Personnel"
        title="Service record"
        right={
          <>
            <Link
              href="/hq/personnel"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              ← Register
            </Link>
            <Link
              href={`/profile/${p.id}`}
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              Field view
            </Link>
          </>
        }
      >
        {serviceNumber(p.id)} · enlisted {stamp(p.created_at)} ·{" "}
        {called > 0 ? `${reliability}% reported for duty` : "never called"}
      </PageHead>

      {/* ── Identity header ────────────────────────────────────────────── */}
      <Panel i={0} sweep className="mb-4" pad={false}>
        <div className="flex flex-wrap items-center gap-6 p-5">
          <div className="relative shrink-0">
            <Avatar name={p.name} avatarUrl={p.avatar_url} colour={p.colour} size={84} />
            <span
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-[3px] border px-1.5 py-0.5"
              style={{
                borderColor: "var(--color-rule)",
                backgroundColor: "#0b100e",
              }}
            >
              <span className="hq-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
                {p.nickname || "—"}
              </span>
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="hq-readout text-[32px] font-bold uppercase leading-none">{p.name}</h2>
              {p.is_president && <Tag tone="warn" solid>President</Tag>}
              {p.is_admin && !p.is_president && <Tag tone="warn">Commanding officer</Tag>}
              {captaincies.length > 0 && <Tag tone="live">Squad captain</Tag>}
              {p.id === me.id && <Tag tone="info">This is you</Tag>}
            </div>
            <p className="hq-mono mt-2 text-[11px] uppercase tracking-[0.12em] text-ink-soft">
              {serviceNumber(p.id)} · {postings.length
                ? postings.map((x) => x.name).join(" / ")
                : "unassigned"}{" "}
              · {svc.operations} operations · {svc.hours}h deployed
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Dot tone={PRESENCE_TONE[presence]} pulse={presence === "deployed"} />
              <span className="hq-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                {presence}
              </span>
              <Proto />
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-2 border-l border-rule pl-6">
            <Row k="Enlisted" v={stamp(p.created_at)} />
            <Row k="Standing" v={openCases > 0 ? `${openCases} open case${openCases > 1 ? "s" : ""}` : "Good"} tone={openCases > 0 ? "alert" : "live"} />
            <Row k="Marks" v={`${record.strikes}S · ${record.warnings}W`} tone={record.strikes + record.warnings > 0 ? "warn" : "live"} />
            <Row k="Reliability" v={called > 0 ? `${reliability}%` : "—"} tone={reliability >= 80 ? "live" : reliability > 0 ? "warn" : "idle"} />
          </div>
        </div>
      </Panel>

      {/* ── Service statistics ─────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-6">
        <Panel i={1}>
          <Stat value={svc.operations} label="Operations attended" tone="live" />
        </Panel>
        <Panel i={2}>
          <Stat value={svc.games} label="Games played" />
        </Panel>
        <Panel i={3}>
          <Stat value={svc.hours} label="Hours deployed" />
        </Panel>
        <Panel i={4}>
          <Stat value={svc.noShows} label="No-shows" tone={svc.noShows > 0 ? "warn" : undefined} />
        </Panel>
        <Panel i={5}>
          <Stat value={captaincies.length} label="Captaincies" tone={captaincies.length ? "warn" : undefined} />
        </Panel>
        <Panel i={6}>
          <Stat
            value={record.strikes}
            label="Strikes"
            tone={record.strikes > 0 ? "alert" : undefined}
            sub={`${record.warnings} warnings on file`}
          />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        {/* ── Left column ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel
            i={7}
            label="Service timeline"
            status={<Dot tone="live" pulse />}
            right={<span className="hq-mono text-[11px] text-ink-soft">{events.length} entries</span>}
          >
            {events.length === 0 ? (
              <Nil>No service on record</Nil>
            ) : (
              <ol className="relative flex flex-col pl-4">
                <span
                  className="absolute bottom-2 left-[3px] top-2 w-px"
                  style={{ backgroundColor: "var(--color-rule)" }}
                  aria-hidden
                />
                {events.map((e, i) => (
                  <li
                    key={`${e.at}-${i}`}
                    className="hq-rise relative py-2"
                    style={{ ["--i" as string]: Math.min(i, 14) }}
                  >
                    <span className="absolute -left-4 top-[13px]">
                      <Dot tone={e.tone} />
                    </span>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span
                        className="hq-mono text-[10px] font-semibold uppercase tracking-[0.16em]"
                        style={{
                          color:
                            e.tone === "alert"
                              ? "var(--color-flag)"
                              : e.tone === "warn"
                                ? "var(--color-sand)"
                                : e.tone === "live"
                                  ? "var(--color-moss)"
                                  : "var(--color-ink-soft)",
                        }}
                      >
                        {e.code}
                      </span>
                      <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                        {e.at === "9999" ? "current" : stamp(e.at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink">{e.text}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel
            i={8}
            label="Court appearances"
            status={<Dot tone={openCases ? "alert" : "idle"} pulse={openCases > 0} />}
            right={
              <Link href="/hq/court" className="hq-label hover:text-ink">
                The Court →
              </Link>
            }
          >
            {complaints.length === 0 && trials.length === 0 && mutinies.length === 0 ? (
              <Nil>Never troubled the court</Nil>
            ) : (
              <div className="flex flex-col gap-2.5">
                {trials.map((t) => (
                  <div key={t.id} className="rounded-[3px] border border-rule p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Tag tone={t.defendant_id === id ? "alert" : "info"}>
                        {t.defendant_id === id ? "Defendant" : t.judge_id === id ? "Presiding" : "Brought by"}
                      </Tag>
                      <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                        Court martial · {stamp(t.created_at)}
                      </span>
                      {t.verdict && (
                        <Tag tone={t.verdict === "guilty" ? "alert" : "live"} solid>
                          {t.verdict === "guilty" ? "Guilty" : "Not guilty"}
                        </Tag>
                      )}
                      {t.penalty && <Tag tone="warn">{t.penalty}</Tag>}
                    </div>
                    <p className="text-[13px] text-ink">{t.charge}</p>
                    {t.defence && (
                      <p className="mt-1 border-l-2 border-rule pl-2.5 text-[12px] text-ink-soft">
                        Defence: “{t.defence}”
                      </p>
                    )}
                    <Link href={`/trial/${t.id}`} className="hq-label mt-2 inline-block hover:text-ink">
                      Open case file →
                    </Link>
                  </div>
                ))}

                {complaints.map((c) => (
                  <div key={c.id} className="rounded-[3px] border border-rule p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Tag tone={c.against_id === id ? "alert" : "info"}>
                        {c.against_id === id ? "Subject" : c.filed_by === id ? "Complainant" : "Second opinion"}
                      </Tag>
                      <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                        {c.status === "open" ? "Before the President" : "Ruled"} · {stamp(c.created_at)}
                      </span>
                      {c.action && <Tag tone="warn">Sought: {c.action}</Tag>}
                    </div>
                    <p className="text-[13px] text-ink">{c.reason}</p>
                    {c.response && (
                      <p className="mt-1 border-l-2 border-rule pl-2.5 text-[12px] text-ink-soft">
                        Response: “{c.response}”
                      </p>
                    )}
                    {c.ruling && (
                      <p
                        className="mt-1 border-l-2 pl-2.5 text-[12px]"
                        style={{ borderColor: "var(--color-sand)", color: "var(--color-ink)" }}
                      >
                        Ruling: {c.ruling}
                      </p>
                    )}
                  </div>
                ))}

                {mutinies.map((m) => (
                  <div key={m.id} className="rounded-[3px] border border-rule p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Tag tone="alert">🏴 {m.target_id === id ? "Motion against" : "Motion raised"}</Tag>
                      <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                        {m.status} · {stamp(m.created_at)}
                      </span>
                    </div>
                    <p className="text-[13px] text-ink">{m.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel i={9} label="Conduct record">
            {strikes.length === 0 && warnings.length === 0 ? (
              <Nil>No marks on this record</Nil>
            ) : (
              <ul className="flex flex-col">
                {[
                  ...strikes.map((s) => ({ ...s, kind: "strike" as const })),
                  ...warnings.map((w) => ({ ...w, kind: "warning" as const })),
                ]
                  .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                  .map((m) => (
                    <li
                      key={m.id}
                      className="flex items-start gap-3 border-b border-rule/60 py-2 last:border-0"
                    >
                      <Tag tone={m.kind === "strike" ? "alert" : "warn"} solid>
                        {m.kind}
                      </Tag>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-ink">
                          {m.reason || "No reason entered."}
                        </span>
                        <span className="hq-mono block text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                          {stamp(m.created_at)} ·{" "}
                          {(m.created_by && nameById.get(m.created_by)) || "the court"}
                        </span>
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>

          {record.notes.length > 0 && (
            <Panel i={10} label="Notes on file">
              <ul className="flex flex-col">
                {record.notes.map((n) => (
                  <li key={n.id} className="border-b border-rule/60 py-2 last:border-0">
                    <p className="text-[13px] text-ink">{n.note}</p>
                    <p className="hq-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                      {stamp(n.created_at)} · {relativeTime(n.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        {/* ── Right column ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel i={11} label="Deployment">
            <div className="mb-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="hq-label">Reported for duty</span>
                <span className="hq-mono text-xs">
                  <span style={{ color: "var(--color-moss)" }}>{svc.operations}</span>
                  <span className="text-ink-soft"> / {called || 0} called</span>
                </span>
              </div>
              <Meter pct={reliability} tone={reliability >= 80 ? "live" : "warn"} />
            </div>
            <Row k="Committed" v={record.played} />
            <Row k="Operations" v={svc.operations} />
            <Row k="Games" v={svc.games} />
            <Row k="Hours" v={`${svc.hours}h`} />
            <Row k="No-shows" v={svc.noShows} tone={svc.noShows ? "warn" : "live"} />
            <Row k="Evidence filed" v={`${record.photos.length} photos`} />
          </Panel>

          <Panel i={12} label="Assignment & command">
            {postings.length === 0 ? (
              <Nil>Unassigned — no squad</Nil>
            ) : (
              postings.map((post) => (
                <Row
                  key={post.id}
                  k={post.name}
                  v={
                    post.captain
                      ? `Captain · ${post.size} posted`
                      : `Operative · ${post.size} posted`
                  }
                  tone={post.captain ? "warn" : "info"}
                />
              ))
            )}
            <Row
              k="Presidency"
              v={p.is_president ? "In command" : "—"}
              tone={p.is_president ? "warn" : "idle"}
            />
            <Row k="Acting captaincies" v={actingFor.length || "—"} tone={actingFor.length ? "warn" : "idle"} />
            {actingFor.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {actingFor.slice(0, 4).map((c) => (
                  <li key={c.id} className="hq-mono text-[11px] text-ink-soft">
                    <span style={{ color: "var(--color-sand)" }}>TRANSFER</span>{" "}
                    {compHeading(c)} · {shortDate(c.date)}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/hq/leadership" className="hq-label mt-3 block hover:text-ink">
              Leadership →
            </Link>
          </Panel>

          <Panel i={13} label="Presidential terms" right={<Proto />}>
            {p.is_president ? (
              <Row k="Current term" v="Sitting President" tone="warn" />
            ) : (
              <Row k="Current term" v="Not in command" tone="idle" />
            )}
            {ELECTION.history.filter((h) => h.president === p.name).length === 0 ? (
              <p className="hq-mono mt-2 text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                No term history on record — the register predates elections.
              </p>
            ) : (
              ELECTION.history
                .filter((h) => h.president === p.name)
                .map((h) => <Row key={h.term} k={h.term} v={h.note} tone="warn" />)
            )}
          </Panel>

          <Panel i={14} label="Commendations" right={<Proto />}>
            {medals.length === 0 ? (
              <Nil>No commendations. Yet.</Nil>
            ) : (
              <ul className="flex flex-col gap-2">
                {medals.map((m) => (
                  <li key={m.key} className="flex items-start gap-2.5">
                    <Dot tone={medalTone(m.tone)} />
                    <span className="min-w-0">
                      <span
                        className="hq-mono block text-[11px] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          color:
                            m.tone === "flag"
                              ? "var(--color-flag)"
                              : m.tone === "moss"
                                ? "var(--color-moss)"
                                : "var(--color-sand)",
                        }}
                      >
                        {m.name}
                      </span>
                      <span className="block text-[12px] text-ink-soft">{m.blurb}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {record.lastRounds.length > 0 && (
            <Panel i={15} label="Recent cards">
              {record.lastRounds.map((r) => (
                <Row
                  key={`${r.compId}-${r.date}`}
                  k={`${shortDate(r.date)} · ${r.course || "Course"}`}
                  v={r.toPar == null ? "—" : r.toPar === 0 ? "LEVEL" : r.toPar > 0 ? `+${r.toPar}` : `${r.toPar}`}
                  tone={r.toPar != null && r.toPar <= 0 ? "live" : "info"}
                />
              ))}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
