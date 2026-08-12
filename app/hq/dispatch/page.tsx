import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { gameById, compHeading } from "@/lib/games";
import { shortDate, shortTime, todayISO } from "@/lib/dates";
import { Panel, Stat, Dot, Tag, Row, Meter, PageHead, Nil, Proto } from "@/components/hq/Kit";
import { dispatch, MEDALS } from "@/lib/hq/future/systems";
import type {
  Competition,
  Complaint,
  Mutiny,
  Muster,
  Photo,
  Profile,
  RadarGame,
  Rsvp,
  Squad,
  SquadMember,
  Trial,
} from "@/lib/types";

export const metadata = { title: "Dispatch · Barracks HQ" };

// ── The Barracks Dispatch ───────────────────────────────────────────────────
// The weekly field bulletin, auto-composed from the week's real rows and set
// like a classified newspaper. The only invented parts are the send action and
// the yearly DECLASSIFIED edition, both marked.

const DAY = 86_400_000;
const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

function hoursOf(c: Competition): number {
  if (!c.started_at || !c.finished_at) return 0;
  return Math.max(0, (new Date(c.finished_at).getTime() - new Date(c.started_at).getTime()) / 3_600_000);
}

/** A rubber stamp slapped on the page. */
function Stamp({
  children,
  tone = "flag",
  rotate = -8,
}: {
  children: React.ReactNode;
  tone?: "flag" | "sand" | "moss";
  rotate?: number;
}) {
  const c = `var(--color-${tone})`;
  return (
    <span
      className="hq-mono inline-block rounded-[2px] border-2 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em]"
      style={{
        borderColor: c,
        color: c,
        transform: `rotate(${rotate}deg)`,
        opacity: 0.85,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 25%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}

export default async function DispatchPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [
    { data: compRows },
    { data: rsvpRows },
    { data: profileRows },
    { data: squadRows },
    { data: memberRows },
    { data: radarRows },
    { data: trialRows },
    { data: complaintRows },
    { data: mutinyRows },
    { data: musterRows },
    { data: photoRows },
  ] = await Promise.all([
    supabase.from("competitions").select("*"),
    supabase.from("rsvps").select("*"),
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("squads").select("*"),
    supabase.from("squad_members").select("*"),
    supabase.from("radar_games").select("*"),
    supabase.from("trials").select("*"),
    supabase.from("complaints").select("*"),
    supabase.from("mutinies").select("*"),
    supabase.from("musters").select("*"),
    supabase.from("photos").select("id, competition_id, created_at"),
  ]);

  const comps = (compRows ?? []) as Competition[];
  const rsvps = (rsvpRows ?? []) as Rsvp[];
  const profiles = (profileRows ?? []) as Profile[];
  const squads = (squadRows ?? []) as Squad[];
  const members = (memberRows ?? []) as SquadMember[];
  const radar = (radarRows ?? []) as RadarGame[];
  const trials = (trialRows ?? []) as Trial[];
  const complaints = (complaintRows ?? []) as Complaint[];
  const mutinies = (mutinyRows ?? []) as Mutiny[];
  const musters = (musterRows ?? []) as Muster[];
  const photos = (photoRows ?? []) as Pick<Photo, "id" | "competition_id" | "created_at">[];

  const nameById = new Map(profiles.map((p) => [p.id, p.name]));
  const squadLabel = (id: string | null) => {
    const s = squads.find((x) => x.id === id);
    return s ? s.name || gameById(s.game).name : "the Barracks";
  };

  const today = todayISO();
  const weekAgoMs = Date.now() - 7 * DAY;
  const weekAgo = new Date(weekAgoMs).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * DAY).toISOString().slice(0, 10);
  const since = (iso: string | null) => Boolean(iso && new Date(iso).getTime() >= weekAgoMs);

  // ── The week ──────────────────────────────────────────────────────────────
  const weekOps = comps
    .filter((c) => c.status === "played" && c.date >= weekAgo && c.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const weekHours = weekOps.reduce((n, c) => n + hoursOf(c), 0);
  const weekGames = weekOps.reduce((n, c) => n + (c.games_count ?? 0), 0);
  const weekPhotos = photos.filter((p) => since(p.created_at)).length;

  const upcoming = comps
    .filter((c) => c.status === "upcoming" && c.date >= today && c.date <= nextWeek)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const turnout = new Map<string, number>();
  for (const r of rsvps)
    if (r.attended === true) turnout.set(r.competition_id, (turnout.get(r.competition_id) ?? 0) + 1);

  const weekAttendance = weekOps.reduce((n, c) => n + (turnout.get(c.id) ?? 0), 0);
  const lead = weekOps.map((c) => ({ c, n: turnout.get(c.id) ?? 0 })).sort((a, b) => b.n - a.n)[0];

  const newRadar = radar.filter((r) => since(r.created_at));
  const inbound = radar
    .filter((r) => r.release_date && r.release_date >= today)
    .sort((a, b) => (a.release_date! < b.release_date! ? -1 : 1))
    .slice(0, 3);

  const weekTrials = trials.filter((t) => since(t.created_at));
  const weekComplaints = complaints.filter((c) => since(c.created_at));
  const weekMutinies = mutinies.filter((m) => since(m.created_at));
  const weekMusters = musters.filter((m) => since(m.created_at));

  const president = profiles.find((p) => p.is_president) ?? null;
  const captains = squads.map((s) => ({
    label: s.name || gameById(s.game).name,
    captain: nameById.get(members.find((m) => m.squad_id === s.id && m.is_captain)?.user_id ?? "") ?? null,
    size: members.filter((m) => m.squad_id === s.id).length,
  }));

  // ── Composed by the Dispatch helper ───────────────────────────────────────
  const sections = dispatch({
    operations: weekOps.length,
    hours: Math.round(weekHours),
    upcoming: upcoming.map(
      (c) =>
        `${shortDate(c.date)} — ${compHeading(c)}${c.tee_time ? ` at ${shortTime(c.tee_time)}` : ""}${
          c.squad_id ? ` (${squadLabel(c.squad_id)} squad)` : ""
        }.`,
    ),
    radar: [
      ...newRadar.map(
        (r) =>
          `New contact logged: ${r.title}${r.release_date ? `, due ${shortDate(r.release_date)}` : ", no date given"}.`,
      ),
      ...inbound.map(
        (r) =>
          `${r.title} lands in ${Math.max(
            0,
            Math.round((new Date(r.release_date!).getTime() - new Date(today).getTime()) / DAY),
          )} days.`,
      ),
    ],
    court: [
      ...weekTrials.map(
        (t) =>
          `${nameById.get(t.defendant_id) ?? "An operative"} ${
            t.status === "closed"
              ? `was found ${t.verdict === "guilty" ? "guilty" : "not guilty"}`
              : "stands accused"
          } — ${t.charge}.`,
      ),
      ...weekComplaints.map(
        (c) =>
          `Complaint filed by ${(c.filed_by && nameById.get(c.filed_by)) || "an operative"}${
            c.against_id ? ` against ${nameById.get(c.against_id) ?? "another"}` : ""
          }: ${c.reason}.`,
      ),
      ...weekMutinies.map(
        (m) => `A motion against the President was ${m.status === "voting" ? "raised" : m.status}.`,
      ),
    ],
    squads: [
      ...weekMusters.map(
        (m) =>
          `${squadLabel(m.squad_id)} called a muster${
            m.chosen_date ? `, settling on ${shortDate(m.chosen_date)}` : " — nights still coming in"
          }.`,
      ),
      ...captains
        .filter((c) => !c.captain)
        .map((c) => `${c.label} squad still has no Captain — ${c.size} members waiting.`),
    ],
  });

  // Edition number = weeks elapsed this year. A bulletin needs a number on it.
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const edition = Math.ceil(((now.getTime() - startOfYear.getTime()) / DAY + startOfYear.getDay() + 1) / 7);

  // ── Yearly DECLASSIFIED — real totals, prototype presentation ─────────────
  const year = String(now.getFullYear());
  const yearOps = comps.filter((c) => c.status === "played" && c.date.startsWith(year));
  const yearHours = yearOps.reduce((n, c) => n + hoursOf(c), 0);
  const yearGames = yearOps.reduce((n, c) => n + (c.games_count ?? 0), 0);
  const yearAttend = yearOps.reduce((n, c) => n + (turnout.get(c.id) ?? 0), 0);
  const yearByGame = new Map<string, number>();
  for (const c of yearOps) yearByGame.set(c.game, (yearByGame.get(c.game) ?? 0) + 1);
  const topGames = [...yearByGame.entries()]
    .map(([id, n]) => ({ game: gameById(id), n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
  const topGameMax = Math.max(1, ...topGames.map((g) => g.n));

  const noShowByPlayer = new Map<string, number>();
  for (const r of rsvps) if (r.attended === false) noShowByPlayer.set(r.player_id, (noShowByPlayer.get(r.player_id) ?? 0) + 1);
  const worstAttender = [...noShowByPlayer.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const latestKickoff = yearOps
    .filter((c) => c.tee_time)
    .sort((a, b) => (a.tee_time! < b.tee_time! ? 1 : -1))[0];
  const longestOp = yearOps.map((c) => ({ c, h: hoursOf(c) })).sort((a, b) => b.h - a.h)[0];
  const scrubbed = comps.filter((c) => c.status === "cancelled" && c.date.startsWith(year)).length;
  const firstEver = comps
    .filter((c) => c.status === "played")
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];

  return (
    <div>
      <PageHead
        eyebrow="Intelligence"
        title="Dispatch"
        right={
          <>
            <button
              type="button"
              className="hq-label rounded-[3px] px-3 py-2 font-semibold"
              style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
            >
              Send to Discord
            </button>
            <button
              type="button"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              Print bulletin
            </button>
            <Proto />
          </>
        }
      >
        Composed automatically every Sunday from the week&apos;s record. Read by everyone, written
        by no one.
      </PageHead>

      {/* ── The bulletin ─────────────────────────────────────────────────── */}
      <Panel i={0} pad={false} className="mb-4 overflow-hidden">
        {/* Masthead */}
        <div className="relative border-b-2 border-rule px-6 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <span className="hq-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
              Vol. {now.getFullYear() - 2023} · No. {edition}
            </span>
            <span className="hq-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
              Barracks internal circulation
            </span>
          </div>
          <div className="my-2 h-px w-full bg-[var(--color-rule)]" />
          <h2
            className="hq-readout text-center text-[46px] font-bold uppercase leading-none tracking-[0.06em]"
            style={{ color: "var(--color-ink)" }}
          >
            The Barracks Dispatch
          </h2>
          <div className="mt-2 h-px w-full bg-[var(--color-rule)]" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span className="hq-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--color-sand)" }}>
              {String(now.getDate()).padStart(2, "0")} {MONTHS[now.getMonth()]} {now.getFullYear()}
            </span>
            <span className="hq-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
              &ldquo;Nothing is forgotten. Everything is filed.&rdquo;
            </span>
            <span className="hq-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
              Compiled for {profile.nickname || profile.name}
            </span>
          </div>
          <div className="pointer-events-none absolute right-5 top-4">
            <Stamp tone="flag" rotate={9}>
              Classified
            </Stamp>
          </div>
        </div>

        {/* Lead */}
        <div className="grid gap-0 border-b border-rule lg:grid-cols-[1.5fr_1fr]">
          <div className="border-b border-rule px-6 py-5 lg:border-b-0 lg:border-r">
            <p className="hq-label mb-2" style={{ color: "var(--color-flag)" }}>
              Lead · week ending {shortDate(today)}
            </p>
            {lead ? (
              <>
                <h3 className="hq-readout text-[30px] font-bold uppercase leading-[1.02]">
                  {gameById(lead.c.game).emoji} {compHeading(lead.c)} draws {lead.n} to the field
                </h3>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
                  <span
                    className="hq-readout float-left mr-2 text-[38px] font-bold leading-[0.8]"
                    style={{ color: "var(--color-sand)" }}
                  >
                    {weekOps.length}
                  </span>
                  operations were run this week, totalling {Math.round(weekHours)} hours deployed
                  and {weekGames} games played. The headline engagement was{" "}
                  <span className="text-ink">{compHeading(lead.c)}</span> on{" "}
                  {shortDate(lead.c.date)}
                  {lead.c.squad_id ? `, fielded by the ${squadLabel(lead.c.squad_id)} squad` : ""} —{" "}
                  {lead.n} present at roll call
                  {lead.c.games_count ? `, ${lead.c.games_count} games logged` : ""}.
                  {weekPhotos > 0 ? ` ${weekPhotos} pieces of evidence were filed.` : ""}
                </p>
              </>
            ) : (
              <>
                <h3 className="hq-readout text-[30px] font-bold uppercase leading-[1.02]">
                  No operations run — the Barracks was silent
                </h3>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
                  Not a single Operation was completed this week. The board shows{" "}
                  {upcoming.length} scheduled for the days ahead. Command notes that a quiet week is
                  a week nobody has to answer for.
                </p>
              </>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Stamp tone="moss" rotate={-4}>
                Filed
              </Stamp>
              <span className="hq-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                {weekAttendance} attendances recorded across {weekOps.length} operations
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 px-6 py-5">
            <Stat value={weekOps.length} label="Operations" tone={weekOps.length ? "live" : "idle"} />
            <Stat value={Math.round(weekHours)} label="Hours deployed" tone="warn" />
            <Stat value={weekGames} label="Games played" />
            <Stat value={upcoming.length} label="On the board" />
            <Stat value={newRadar.length} label="New contacts" />
            <Stat
              value={weekTrials.length + weekComplaints.length + weekMutinies.length}
              label="Court activity"
              tone={weekTrials.length + weekComplaints.length + weekMutinies.length ? "alert" : "idle"}
            />
          </div>
        </div>

        {/* Columns */}
        <div className="px-6 py-5">
          <div style={{ columnCount: 3, columnGap: 30 }} className="[&>section]:break-inside-avoid">
            {sections.map((s) => (
              <section key={s.heading} className="mb-5 inline-block w-full align-top">
                <h4 className="hq-readout mb-1 text-[15px] font-bold uppercase tracking-[0.06em]">
                  {s.heading}
                </h4>
                <div className="mb-2 h-px w-full" style={{ backgroundColor: "var(--color-sand)", opacity: 0.5 }} />
                <ul className="flex flex-col gap-1.5">
                  {s.lines.map((l, i) => (
                    <li key={i} className="text-[12.5px] leading-relaxed text-ink-soft">
                      {l}
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <section className="mb-5 inline-block w-full align-top">
              <h4 className="hq-readout mb-1 text-[15px] font-bold uppercase tracking-[0.06em]">
                Standing orders
              </h4>
              <div className="mb-2 h-px w-full" style={{ backgroundColor: "var(--color-sand)", opacity: 0.5 }} />
              <ul className="flex flex-col gap-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                <li>
                  {president ? (
                    <>
                      <span className="text-ink">{president.name}</span> holds command of The
                      Barracks.
                    </>
                  ) : (
                    "The presidency is vacant. Command is held by consensus, which is to say by nobody."
                  )}
                </li>
                {captains.map((c) => (
                  <li key={c.label}>
                    {c.label} squad — {c.captain ? `Capt. ${c.captain}` : "no Captain appointed"} ·{" "}
                    {c.size} on strength.
                  </li>
                ))}
                {captains.length === 0 && <li>No squads formed. Every operation is Barracks-wide.</li>}
              </ul>
            </section>

            <section className="mb-5 inline-block w-full align-top">
              <h4 className="hq-readout mb-1 text-[15px] font-bold uppercase tracking-[0.06em]">
                Notices
              </h4>
              <div className="mb-2 h-px w-full" style={{ backgroundColor: "var(--color-sand)", opacity: 0.5 }} />
              <ul className="flex flex-col gap-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                <li>
                  {profiles.length} operatives are on strength across {squads.length} squads.
                </li>
                <li>
                  {weekPhotos > 0
                    ? `${weekPhotos} photographs were entered into the archive.`
                    : "No photographic evidence was filed this week."}
                </li>
                <li>
                  Roll call remains compulsory. Absence without notice is a matter for the Court.
                </li>
              </ul>
            </section>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-4">
            <div className="flex items-center gap-4">
              <Stamp tone="sand" rotate={-6}>
                Distribution: all ranks
              </Stamp>
              <span className="hq-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                Auto-composed · no editor · no appeals
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="hq-label rounded-[3px] border border-dashed border-rule px-3 py-2 text-ink-soft transition-colors hover:border-sand hover:text-ink"
              >
                Send to #announcements
              </button>
              <Proto />
            </div>
          </div>
        </div>
      </Panel>

      {/* ── Wire copy ────────────────────────────────────────────────────── */}
      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Panel i={1} label="On the board" right={<Link href="/hq/calendar" className="hq-label hover:text-ink">Calendar →</Link>}>
          {upcoming.length === 0 ? (
            <Nil>Nothing scheduled in the next seven days</Nil>
          ) : (
            upcoming.map((c) => (
              <Row
                key={c.id}
                k={shortDate(c.date)}
                v={`${gameById(c.game).emoji} ${compHeading(c)}${c.tee_time ? ` · ${shortTime(c.tee_time)}` : ""}`}
              />
            ))
          )}
        </Panel>
        <Panel i={2} label="Radar movement" right={<Link href="/hq/radar" className="hq-label hover:text-ink">Radar →</Link>}>
          {radar.length === 0 ? (
            <Nil>Radar clear</Nil>
          ) : (
            [...newRadar, ...inbound]
              .filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i)
              .slice(0, 6)
              .map((r) => (
                <Row
                  key={r.id}
                  k={r.title}
                  v={r.release_date ? shortDate(r.release_date) : "No date"}
                  tone={since(r.created_at) ? "live" : undefined}
                />
              ))
          )}
        </Panel>
        <Panel
          i={3}
          label="Court report"
          status={<Dot tone={weekTrials.length || weekComplaints.length ? "alert" : "idle"} />}
          right={<Link href="/hq/court" className="hq-label hover:text-ink">Court →</Link>}
        >
          {weekTrials.length + weekComplaints.length + weekMutinies.length === 0 ? (
            <Nil>No cases this week — a peaceful reign</Nil>
          ) : (
            <>
              {weekTrials.map((t) => (
                <Row
                  key={t.id}
                  k={nameById.get(t.defendant_id) ?? "Unknown"}
                  v={t.status === "closed" ? (t.verdict === "guilty" ? "Guilty" : "Acquitted") : "Awaiting verdict"}
                  tone={t.verdict === "guilty" ? "alert" : "warn"}
                />
              ))}
              {weekComplaints.map((c) => (
                <Row
                  key={c.id}
                  k={(c.filed_by && nameById.get(c.filed_by)) || "Someone"}
                  v={`Complaint · ${c.status}`}
                  tone="warn"
                />
              ))}
            </>
          )}
        </Panel>
      </div>

      {/* ── The yearly edition ───────────────────────────────────────────── */}
      <Panel
        i={4}
        pad={false}
        label="Barracks 2027 // Declassified"
        status={<Dot tone="warn" pulse />}
        right={
          <>
            <Tag tone="warn">Yearly edition</Tag>
            <Proto />
          </>
        }
        className="overflow-hidden"
      >
        <div
          className="border-b border-rule px-6 py-6"
          style={{
            backgroundImage:
              "radial-gradient(700px 260px at 10% 0%, rgba(245,182,61,0.09), transparent 62%), radial-gradient(600px 300px at 90% 100%, rgba(255,91,59,0.07), transparent 60%)",
          }}
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="hq-label" style={{ color: "var(--color-flag)" }}>
                The year in review · shareable
              </p>
              <h3 className="hq-readout mt-1 text-[38px] font-bold uppercase leading-none tracking-[0.03em]">
                Barracks 2027 <span style={{ color: "var(--color-sand)" }}>{"// Declassified"}</span>
              </h3>
              <p className="mt-2 max-w-2xl text-[13px] text-ink-soft">
                A dry run of the yearly edition, compiled from real {year} rows to date. Come the
                turn of the year it posts itself: every hour deployed, every no-show, every medal.
              </p>
            </div>
            <Stamp tone="sand" rotate={6}>
              Declassified
            </Stamp>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6 xl:grid-cols-6">
            <Stat value={yearOps.length} label="Operations run" tone="live" />
            <Stat value={Math.round(yearHours)} label="Hours deployed" tone="warn" />
            <Stat value={yearGames} label="Games played" />
            <Stat value={yearAttend} label="Attendances" />
            <Stat value={scrubbed} label="Scrubbed" tone={scrubbed ? "alert" : undefined} />
            <Stat value={profiles.length} label="Operatives" />
          </div>
        </div>

        <div className="grid gap-6 px-6 py-5 xl:grid-cols-3">
          <div>
            <p className="hq-label mb-3">Most active games</p>
            {topGames.length === 0 ? (
              <Nil>No operations this year</Nil>
            ) : (
              <div className="flex flex-col gap-3">
                {topGames.map((g) => (
                  <div key={g.game.id}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px]">
                        {g.game.emoji} {g.game.name}
                      </span>
                      <span className="hq-mono text-[12px] text-ink-soft">{g.n} ops</span>
                    </div>
                    <div className="mt-1.5">
                      <Meter pct={(g.n / topGameMax) * 100} tone={g.n === topGameMax ? "warn" : "live"} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="hq-label mb-3">Ridiculous statistics</p>
            <Row
              k="Latest kick-off"
              v={latestKickoff ? `${shortTime(latestKickoff.tee_time)} · ${compHeading(latestKickoff)}` : "—"}
              tone="warn"
            />
            <Row
              k="Longest sitting"
              v={longestOp && longestOp.h ? `${longestOp.h.toFixed(1)}h · ${compHeading(longestOp.c)}` : "—"}
            />
            <Row
              k="Most no-shows"
              v={worstAttender ? `${nameById.get(worstAttender[0]) ?? "Unknown"} · ${worstAttender[1]}` : "Nobody · spotless"}
              tone={worstAttender ? "alert" : "live"}
            />
            <Row k="Evidence filed" v={photos.length} />
            <Row k="Cases heard" v={trials.length} tone={trials.length ? "alert" : "idle"} />
            <Row k="Squads standing" v={squads.length} />
          </div>

          <div>
            <p className="hq-label mb-3">Major moments</p>
            <ul className="flex flex-col gap-2">
              {firstEver && (
                <li className="border-l pl-3 text-[12.5px] text-ink-soft" style={{ borderColor: "var(--color-moss)" }}>
                  <span className="text-ink">{shortDate(firstEver.date)}</span> — the first Operation
                  on the record: {compHeading(firstEver)}.
                </li>
              )}
              {squads.slice(0, 2).map((s) => (
                <li key={s.id} className="border-l border-rule pl-3 text-[12.5px] text-ink-soft">
                  <span className="text-ink">{shortDate(s.created_at.slice(0, 10))}</span> — the{" "}
                  {s.name || gameById(s.game).name} squad was formed.
                </li>
              ))}
              {trials[0] && (
                <li className="border-l pl-3 text-[12.5px] text-ink-soft" style={{ borderColor: "var(--color-flag)" }}>
                  <span className="text-ink">{shortDate(trials[0].created_at.slice(0, 10))}</span> —
                  the Court sat: {trials[0].charge}.
                </li>
              )}
              {lead && (
                <li className="border-l pl-3 text-[12.5px] text-ink-soft" style={{ borderColor: "var(--color-sand)" }}>
                  <span className="text-ink">{shortDate(lead.c.date)}</span> — biggest turnout of the
                  week: {lead.n} on the field.
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="border-t border-rule px-6 py-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="hq-label">Commendations</p>
            <Proto>Medals · not yet awarded in-platform</Proto>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {MEDALS.map((m) => (
              <div
                key={m.key}
                className="flex items-start gap-3 rounded-[3px] border border-rule px-3 py-2.5"
                style={{ borderLeftWidth: 2, borderLeftColor: `var(--color-${m.tone})` }}
              >
                <div className="min-w-0">
                  <p className="hq-readout truncate text-[14px] font-bold uppercase tracking-[0.04em]">
                    {m.name}
                  </p>
                  <p className="text-[12px] text-ink-soft">{m.blurb}</p>
                  <p className="hq-mono mt-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: `var(--color-${m.tone})` }}>
                    {m.holders.join(" · ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
