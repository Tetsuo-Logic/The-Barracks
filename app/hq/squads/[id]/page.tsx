import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { resolveViewRole, realRoleOf } from "@/lib/hq/role";
import { createClient } from "@/lib/supabase/server";
import { getSquads } from "@/lib/data/queries";
import { gameById, compHeading } from "@/lib/games";
import { todayISO, heroDate, shortDate, shortTime, relativeTime } from "@/lib/dates";
import { Panel, Stat, Dot, Tag, Row, Meter, PageHead, Nil, Proto } from "@/components/hq/Kit";
import { Avatar } from "@/components/Avatar";
import { GamePanel, PANEL_LABEL, panelKind } from "@/components/hq/squad/GamePanel";
import { RequestNight } from "@/components/hq/squad/RequestNight";
import { LeaveSquad } from "@/components/hq/squad/LeaveSquad";
import { callsign, squadRecord } from "@/components/hq/squad/proto";
import type { Competition, Rsvp, Score, Squad } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("squads")
    .select("name, game")
    .eq("id", id)
    .maybeSingle();
  const sq = data as Pick<Squad, "name" | "game"> | null;
  const label = sq ? sq.name || `${gameById(sq.game).name} Squad` : "Squad";
  return { title: `${label} · Barracks HQ` };
}

// One squad's dossier. The shell is identical for every squad — roster,
// operations, history, records — and the game only gets to be itself in the
// specialised panel at the foot of the page.
export default async function SquadDossierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const profile = await requireProfile();
  // Planning is a Captain/President surface — a member never sees a route into
  // it, here or anywhere else. Follows the dev role preview so it's testable.
  const viewRole = resolveViewRole(sp.as, await realRoleOf(profile));

  const squads = await getSquads(profile.id);
  const view = squads.find((s) => s.squad.id === id);
  if (!view) notFound();

  const supabase = await createClient();
  const { data: compRows } = await supabase
    .from("competitions")
    .select("*")
    .eq("squad_id", id)
    .order("date", { ascending: true });
  const comps = (compRows ?? []) as Competition[];
  const compIds = comps.map((c) => c.id);

  const [{ data: rsvpRows }, { data: scoreRows }] = compIds.length
    ? await Promise.all([
        supabase.from("rsvps").select("*").in("competition_id", compIds),
        supabase.from("scores").select("*").in("competition_id", compIds),
      ])
    : [{ data: [] }, { data: [] }];

  const rsvps = (rsvpRows ?? []) as Rsvp[];
  const scores = (scoreRows ?? []) as Score[];

  const { squad, members, captainId, mine, nightRequests, muster } = view;
  // Captaincy is per-squad. Running COD Squad grants nothing over FIFA Squad,
  // so the Captain's controls here are gated on captaining THIS one — being a
  // captain somewhere else is not a credential. RLS agrees; this only stops us
  // offering buttons that would fail.
  const canPlan = viewRole === "president" || captainId === profile.id;
  // A member's own asks, for the "where did it go?" panel.
  const myRequests = nightRequests.filter((r) => r.requester?.id === profile.id);
  const game = gameById(squad.game);
  const today = todayISO();
  const upcoming = comps.filter((c) => c.status === "upcoming" && c.date >= today);
  const history = [...comps]
    .filter((c) => c.status !== "upcoming" || c.date < today)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const run = comps.filter((c) => c.status === "played").length;
  const captain = members.find((m) => m.is_captain)?.profile ?? null;
  const rec = squadRecord(squad.id);
  const kind = panelKind(squad.game);

  // Roll call per operation, and each operative's service inside this squad.
  const rsvpsByComp = new Map<string, Rsvp[]>();
  for (const r of rsvps) {
    const arr = rsvpsByComp.get(r.competition_id) ?? [];
    arr.push(r);
    rsvpsByComp.set(r.competition_id, arr);
  }
  const service = new Map<string, { committed: number; present: number; noShow: number }>();
  for (const m of members) service.set(m.profile.id, { committed: 0, present: 0, noShow: 0 });
  for (const r of rsvps) {
    const s = service.get(r.player_id);
    if (!s || r.status !== "in") continue;
    s.committed++;
    if (r.attended === true) s.present++;
    if (r.attended === false) s.noShow++;
  }
  const totalCommitted = [...service.values()].reduce((n, s) => n + s.committed, 0);
  const totalNoShow = [...service.values()].reduce((n, s) => n + s.noShow, 0);
  const reliability = totalCommitted
    ? Math.round(((totalCommitted - totalNoShow) / totalCommitted) * 100)
    : 100;

  // Muster: per-candidate-night headcount, straight from the real responses.
  const musterNights =
    muster?.muster.dates.map((d) => ({
      date: d,
      on: muster.responses.filter((r) => r.available_dates.includes(d)).length,
    })) ?? [];
  const silent = muster
    ? members.filter((m) => !muster.responses.some((r) => r.user_id === m.profile.id))
    : [];

  const musterTone = muster
    ? muster.muster.status === "proposed"
      ? "alert"
      : "warn"
    : "idle";

  return (
    <div>
      <PageHead
        eyebrow={`${game.name} squad`}
        title={squad.name || `${game.name} Squad`}
        right={
          <>
            {/* The member's action, and the same flow the card launches — one
                behaviour, two entry points. */}
            {mine && (
              <RequestNight
                squadId={squad.id}
                squadName={squad.name || `${game.name} Squad`}
                gameName={game.name}
                captainName={captain?.name ?? null}
                squadHref={`/hq/squads/${squad.id}`}
                variant="inline"
              />
            )}
            {/* The Captain's, and only theirs. */}
            {canPlan && (
              <Link
                href="/squads"
                className="hq-label rounded-[3px] px-3 py-2 font-semibold"
                style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
              >
                Call a muster
              </Link>
            )}
            {/* Membership management belongs here, not in the directory. */}
            {mine && (
              <LeaveSquad
                squadId={squad.id}
                isCaptain={captainId === profile.id}
                memberCount={members.length}
              />
            )}
            <Link
              href="/hq/squads"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              ← All squads
            </Link>
          </>
        }
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] leading-none">{game.emoji}</span>
          {squad.clan_tag && (
            <span
              className="hq-mono rounded-[3px] border px-1.5 py-0.5 text-[11px] font-bold leading-none"
              style={{
                borderColor: "color-mix(in srgb, var(--color-sand) 45%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--color-sand) 11%, transparent)",
                color: "var(--color-sand)",
              }}
            >
              [{squad.clan_tag}]
            </span>
          )}
          <span>
            {members.length} operative{members.length === 1 ? "" : "s"} ·{" "}
            {captain ? (
              <>
                commanded by <span className="text-ink">{captain.name}</span>
              </>
            ) : (
              "no Captain appointed"
            )}
          </span>
          {mine && <Tag tone="live">You serve here</Tag>}
        </span>
      </PageHead>

      {/* ── Status strip ─────────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-6">
        <Panel i={0}>
          <Stat value={members.length} label="Operatives" sub={captain ? "Captain appointed" : "No captain"} />
        </Panel>
        <Panel i={1}>
          <Stat value={run} label="Operations run" />
        </Panel>
        <Panel i={2}>
          <Stat
            value={upcoming.length}
            label="On the board"
            tone={upcoming.length > 0 ? "live" : undefined}
          />
        </Panel>
        <Panel i={3}>
          <Stat
            value={muster ? (muster.muster.status === "proposed" ? "PROP" : "OPEN") : "—"}
            label="Muster"
            tone={muster ? (muster.muster.status === "proposed" ? "alert" : "warn") : undefined}
            sub={muster ? `${muster.responses.length}/${members.length} answered` : "None running"}
          />
        </Panel>
        <Panel i={4}>
          <Stat
            value={nightRequests.length}
            label="Nights wanted"
            tone={nightRequests.length > 0 ? "alert" : undefined}
          />
        </Panel>
        <Panel i={5}>
          <Stat value={`${reliability}%`} label="Reliability" sub={`${totalNoShow} no-shows`} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        {/* ── Left column ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Roster */}
          <Panel
            i={6}
            sweep
            label="Roster"
            status={<Dot tone={members.length ? "live" : "idle"} pulse={members.length > 0} />}
            right={<span className="hq-mono text-xs text-ink-soft">{members.length}</span>}
          >
            {members.length === 0 ? (
              <Nil>No operatives assigned</Nil>
            ) : (
              <ul className="flex flex-col">
                {[...members]
                  .sort((a, b) => Number(b.is_captain) - Number(a.is_captain))
                  .map((m) => {
                    const s = service.get(m.profile.id) ?? { committed: 0, present: 0, noShow: 0 };
                    return (
                      <li
                        key={m.profile.id}
                        className="flex items-center gap-3 border-b border-rule/60 py-2 last:border-0"
                      >
                        <Avatar
                          name={m.profile.name}
                          avatarUrl={m.profile.avatar_url}
                          colour={m.profile.colour}
                          size={28}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-ink">
                            {m.profile.name}
                            {m.profile.id === profile.id && (
                              <span className="ml-2 text-ink-soft">(you)</span>
                            )}
                          </span>
                          <span className="hq-mono block text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                            {callsign(m.profile.name, m.profile.nickname)}
                            {m.profile.handicap != null && kind === "golf" && (
                              <> · HCP {m.profile.handicap}</>
                            )}
                          </span>
                        </span>
                        <span className="hq-mono shrink-0 text-[11px] text-ink-soft">
                          {s.committed} committed
                          {s.noShow > 0 && (
                            <span style={{ color: "var(--color-flag)" }}> · {s.noShow} no-show</span>
                          )}
                        </span>
                        {m.profile.is_president && <Tag tone="warn">President</Tag>}
                        {m.is_captain && (
                          <Tag tone="warn" solid>
                            Captain
                          </Tag>
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}
            {captainId == null && members.length > 0 && (
              <p className="hq-mono mt-3 text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--color-sand)" }}>
                No Captain appointed — the President commands this squad
              </p>
            )}
          </Panel>

          {/* Upcoming operations */}
          <Panel
            i={7}
            label="Upcoming operations"
            right={
              <Link href="/hq/operations" className="hq-label hover:text-ink">
                Operations →
              </Link>
            }
          >
            {upcoming.length === 0 ? (
              <Nil>Nothing scheduled for this squad</Nil>
            ) : (
              <ul className="flex flex-col">
                {upcoming.map((c) => {
                  const hd = heroDate(c.date);
                  const rc = rsvpsByComp.get(c.id) ?? [];
                  const inCount = rc.filter((r) => r.status === "in").length;
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/hq/operations/${c.id}`}
                        className="flex items-center gap-4 border-b border-rule/60 py-2.5 last:border-0 transition-colors hover:bg-[rgba(255,255,255,0.025)]"
                      >
                        <span className="hq-mono w-16 shrink-0 text-xs uppercase tracking-[0.08em] text-ink-soft">
                          {hd.dow} {hd.day} {hd.mon}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px]">
                          {compHeading(c)}
                        </span>
                        <span className="hq-mono shrink-0 text-xs text-ink-soft">
                          {shortTime(c.tee_time) || "—"}
                        </span>
                        <span className="hq-mono shrink-0 text-xs" style={{ color: "var(--color-moss)" }}>
                          {inCount}/{members.length} in
                        </span>
                        {c.started_at && !c.finished_at && <Tag tone="live">Room live</Tag>}
                        {c.for_cup && <Tag tone="warn">Cup</Tag>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* History */}
          <Panel
            i={8}
            label="Service history"
            right={
              <Link href="/hq/archives" className="hq-label hover:text-ink">
                Archives →
              </Link>
            }
          >
            {history.length === 0 ? (
              <Nil>No operations on record</Nil>
            ) : (
              <ul className="flex flex-col">
                {history.slice(0, 10).map((c, i) => {
                  const rc = rsvpsByComp.get(c.id) ?? [];
                  const present = rc.filter((r) => r.attended === true).length;
                  const noShow = rc.filter((r) => r.attended === false).length;
                  return (
                    <li
                      key={c.id}
                      className="hq-rise"
                      style={{ ["--i" as string]: i }}
                    >
                      <Link
                        href={`/hq/operations/${c.id}`}
                        className="flex items-center gap-3 border-b border-rule/50 py-2 last:border-0 transition-colors hover:bg-[rgba(255,255,255,0.025)]"
                      >
                        <Dot tone={c.status === "cancelled" ? "alert" : "live"} />
                        <span className="hq-mono w-14 shrink-0 text-[11px] text-ink-soft">
                          {shortDate(c.date)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px]">
                          {compHeading(c)}
                        </span>
                        {c.status === "cancelled" ? (
                          <Tag tone="alert">Cancelled</Tag>
                        ) : (
                          <span className="hq-mono shrink-0 text-[11px] text-ink-soft">
                            {present} present
                            {noShow > 0 && (
                              <span style={{ color: "var(--color-flag)" }}> · {noShow} absent</span>
                            )}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        {/* ── Right column ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Your open requests — the other half of "show where it went".
              A member who asked for a night can see it sitting with the
              Captain, and roughly what happens next. Real rows from
              squad_night_requests; no state is invented. */}
          {mine && myRequests.length > 0 && (
            <Panel
              i={8}
              label="Your open requests"
              status={<Dot tone="alert" pulse />}
              right={<span className="hq-label">{myRequests.length}</span>}
            >
              <ul className="flex flex-col">
                {myRequests.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule/60 py-2 last:border-0"
                  >
                    <span className="hq-readout shrink-0 text-[13px] font-bold uppercase tracking-[0.02em]">
                      {game.name} night
                    </span>
                    {r.note && (
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">
                        {r.note}
                      </span>
                    )}
                    <span className="hq-mono ml-auto shrink-0 text-[11px] uppercase tracking-[0.08em]">
                      {muster ? (
                        <span style={{ color: "var(--color-moss)" }}>
                          Muster called · {muster.responses.length}/{members.length} responded
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-sand)" }}>
                          Sent to {captain?.name ?? "Command"} · awaiting captain
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {/* Muster */}
          <Panel
            i={9}
            label="Muster"
            status={<Dot tone={musterTone} pulse={Boolean(muster)} />}
            right={
              canPlan ? (
                <Link href="/hq/availability" className="hq-label hover:text-ink">
                  Planning →
                </Link>
              ) : undefined
            }
          >
            {!muster ? (
              <Nil>No muster running</Nil>
            ) : (
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Tag tone={muster.muster.status === "proposed" ? "alert" : "warn"} solid>
                    {muster.muster.status === "proposed" ? "Night proposed" : "Open"}
                  </Tag>
                  {muster.muster.window_from && (
                    <Tag tone="idle">
                      Kick-off {muster.muster.window_from}–{muster.muster.window_to ?? "late"}
                    </Tag>
                  )}
                  <span className="hq-mono text-[11px] text-ink-soft">
                    {muster.responses.length}/{members.length} answered
                  </span>
                </div>

                {muster.muster.note && (
                  <p className="mb-3 text-[13px] text-ink-soft">“{muster.muster.note}”</p>
                )}

                <p className="hq-label mb-1.5">Candidate nights</p>
                <ul className="flex flex-col gap-2">
                  {musterNights.map((n) => {
                    const chosen = muster.muster.chosen_date === n.date;
                    return (
                      <li key={n.date}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span
                            className="hq-mono text-[12px]"
                            style={{ color: chosen ? "var(--color-sand)" : "var(--color-ink)" }}
                          >
                            {shortDate(n.date)}
                            {chosen && " · chosen"}
                          </span>
                          <span className="hq-mono text-[11px] text-ink-soft">
                            {n.on}/{members.length} on
                          </span>
                        </div>
                        <div className="mt-1">
                          <Meter
                            pct={members.length ? (n.on / members.length) * 100 : 0}
                            tone={chosen ? "warn" : "live"}
                          />
                        </div>
                      </li>
                    );
                  })}
                  {musterNights.length === 0 && (
                    <li className="hq-label">No nights offered</li>
                  )}
                </ul>

                {silent.length > 0 && (
                  <p className="hq-mono mt-3 text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                    Silent: {silent.map((m) => m.profile.name).join(", ")}
                  </p>
                )}
              </div>
            )}
          </Panel>

          {/* Night nudges */}
          <Panel
            i={10}
            label="Nights wanted"
            status={<Dot tone={nightRequests.length ? "alert" : "idle"} pulse={nightRequests.length > 0} />}
            right={
              <span
                className="hq-mono text-xs"
                style={{
                  color: nightRequests.length ? "var(--color-flag)" : "var(--color-ink-soft)",
                }}
              >
                {nightRequests.length}
              </span>
            }
          >
            {nightRequests.length === 0 ? (
              <Nil>No nudges to the Captain</Nil>
            ) : (
              <ul className="flex flex-col">
                {nightRequests.map((nr) => (
                  <li
                    key={nr.id}
                    className="flex items-start gap-2.5 border-b border-rule/60 py-2 last:border-0"
                  >
                    <Dot tone="warn" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-ink">
                        {nr.requester?.name ?? "Someone"}
                      </span>
                      {nr.note && (
                        <span className="hq-mono block truncate text-[11px] text-ink-soft">
                          “{nr.note}”
                        </span>
                      )}
                    </span>
                    <span className="hq-mono shrink-0 text-[10px] text-ink-soft">
                      {relativeTime(nr.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Records */}
          <Panel i={11} label="Records" right={<Proto>Record prototype</Proto>}>
            <Row k="Formed" v={shortDate(squad.created_at.slice(0, 10))} />
            <Row k="Game" v={game.name} />
            <Row k="Surface" v={PANEL_LABEL[kind]} tone="warn" />
            <Row k="Operations run" v={run} tone="live" />
            <Row k="Roll calls committed" v={totalCommitted} />
            <Row k="No-shows" v={totalNoShow} tone={totalNoShow > 0 ? "alert" : "live"} />
            <div className="mt-3 border-t border-rule/60 pt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="hq-label">Battle record</span>
                <span className="hq-mono text-[11px]">
                  {rec.form.map((f, k) => (
                    <span
                      key={k}
                      style={{
                        color: f === "W" ? "var(--color-moss)" : "var(--color-flag)",
                        marginLeft: k === 0 ? 0 : 3,
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </span>
              </div>
              <Meter pct={rec.pct} tone={rec.pct >= 50 ? "live" : "alert"} />
              <p className="hq-mono mt-1 text-[11px] text-ink-soft">
                {rec.played} played · {rec.won}W {rec.lost}L · streak {rec.streak}
              </p>
            </div>
          </Panel>

          {/* Chain of command */}
          <Panel i={12} label="Chain of command">
            <Row k="Captain" v={captain ? `⭐ ${captain.name}` : "Vacant"} tone={captain ? "warn" : "idle"} />
            <Row
              k="Clan tag"
              v={squad.clan_tag ? `[${squad.clan_tag}]` : "None set"}
              tone={squad.clan_tag ? "warn" : "idle"}
            />
            <Row k="Your standing" v={mine ? "Serving" : "Not assigned"} tone={mine ? "live" : "idle"} />
            <Link href="/hq/leadership" className="hq-label mt-3 block hover:text-ink">
              Leadership →
            </Link>
          </Panel>
        </div>
      </div>

      {/* ── The game gets to be itself ───────────────────────────────────── */}
      <div className="mt-4">
        <GamePanel
          squad={squad}
          gameName={game.name}
          members={members}
          comps={comps}
          fixtures={upcoming}
          scores={scores}
        />
      </div>
    </div>
  );
}
