import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { previewingAsPlayer } from "@/lib/preview";
import { effectiveAdmin } from "@/lib/permissions";
import { getCompetitionDetail } from "@/lib/data";
import { gameById, compHeading } from "@/lib/games";
import { heroDate, shortTime } from "@/lib/dates";
import { isClosed } from "@/lib/rsvp";
import { Panel, Stat, Dot, Tag, Row, PageHead, Nil, Proto } from "@/components/hq/Kit";
import { Countdown } from "@/components/hq/Countdown";
import { RoomRealtime } from "@/components/hq/room/RoomRealtime";
import { Elapsed } from "@/components/hq/room/Elapsed";
import { RollCall, type RosterEntry } from "@/components/hq/room/RollCall";
import { GamesConsole } from "@/components/hq/room/GamesConsole";
import { CloseOperation } from "@/components/hq/room/CloseOperation";
import { ActingCaptain } from "@/components/hq/room/ActingCaptain";
import { CommsPanel } from "@/components/hq/room/CommsPanel";
import { VoicePanel } from "@/components/hq/room/VoicePanel";
import { StreamPanel } from "@/components/hq/room/StreamPanel";
import { LINK } from "@/lib/hq/future/systems";

export const metadata = { title: "Operation Room · Barracks HQ" };

type RoomState = "OPEN" | "ROLL CALL" | "LIVE" | "CLOSING" | "ARCHIVED" | "SCRUBBED";

const STATE_TONE: Record<RoomState, "live" | "warn" | "alert" | "idle" | "info"> = {
  OPEN: "info",
  "ROLL CALL": "warn",
  LIVE: "live",
  CLOSING: "warn",
  ARCHIVED: "idle",
  SCRUBBED: "alert",
};

function durationText(startIso: string, endIso: string) {
  const mins = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

const clock = (isoTs: string) =>
  new Date(isoTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// The Operation Room, widescreen. Same domain, same server actions and the same
// realtime channel as the phone — this one is built to sit open on a second
// monitor all night, so everything that moves is on screen at once.
export default async function OperationRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [profile, detail, previewing] = await Promise.all([
    requireProfile(),
    getCompetitionDetail(id),
    previewingAsPlayer(),
  ]);
  if (!detail) notFound();

  const { comp, roster, rsvps, profiles, squad, squadCaptainId, photos, comments } = detail;
  const g = gameById(comp.game);
  const isAdmin = effectiveAdmin(profile, previewing);
  // CO of this room = the President/organiser, or the squad's Captain, or a
  // stand-in Captain named for this one event (Sq-3). Mirrors /comp/[id].
  const isCO =
    isAdmin || squadCaptainId === profile.id || comp.acting_captain_id === profile.id;

  const started = comp.started_at != null;
  const finished = comp.finished_at != null;
  const scrubbed = comp.status === "cancelled";

  const rsvpByPlayer = new Map(rsvps.map((r) => [r.player_id, r]));
  const rollCall: RosterEntry[] = roster.map((p) => {
    const r = rsvpByPlayer.get(p.id);
    return {
      id: p.id,
      name: p.name,
      avatar_url: p.avatar_url,
      colour: p.colour,
      rsvp: (r?.status as "in" | "out" | "maybe" | undefined) ?? null,
      attended: r?.attended ?? null,
      captain: p.id === squadCaptainId,
      acting: p.id === comp.acting_captain_id,
    };
  });

  const expected = rollCall.filter((r) => r.rsvp === "in").length;
  const present = rollCall.filter((r) => r.attended === true).length;
  const noShow = rollCall.filter((r) => r.attended === false).length;

  // Kick-off, as wall-clock (never through UTC — §10).
  const scheduledIso = `${comp.date}T${(comp.tee_time ?? "20:00:00").slice(0, 8)}`;
  const scheduledMs = new Date(scheduledIso).getTime();
  const nearKickOff = Date.now() >= scheduledMs - 60 * 60 * 1000;

  const state: RoomState = scrubbed
    ? "SCRUBBED"
    : finished
      ? "ARCHIVED"
      : started
        ? "LIVE"
        : nearKickOff
          ? "ROLL CALL"
          : "OPEN";

  // Who has command tonight: the named stand-in, else the squad's Captain, else
  // the President (the whole-Barracks CO).
  const actingCaptain = comp.acting_captain_id
    ? profiles.find((p) => p.id === comp.acting_captain_id) ?? null
    : null;
  const squadCaptain = squadCaptainId ? profiles.find((p) => p.id === squadCaptainId) ?? null : null;
  const president = profiles.find((p) => p.is_president) ?? null;
  const commander = actingCaptain ?? squadCaptain ?? president;
  const commanderRole = actingCaptain
    ? "Acting Captain"
    : squadCaptain
      ? "Squad Captain"
      : president
        ? "President"
        : "Unassigned";

  const hd = heroDate(comp.date);
  const squadName = squad ? squad.name || gameById(squad.game).name : null;
  const rsvpClosed = isClosed(comp);

  return (
    <div>
      <RoomRealtime compId={comp.id} />

      <div className="mb-3 flex items-center gap-3">
        <Link href="/hq/operations" className="hq-label transition-colors hover:text-ink">
          ← Operations
        </Link>
        <span className="hq-mono text-[10px] text-ink-soft">/</span>
        <span className="hq-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
          {comp.id.slice(0, 8)}
        </span>
      </div>

      <PageHead
        eyebrow={`Operation Room // ${state}`}
        title={compHeading(comp)}
        right={
          <>
            <Tag tone={STATE_TONE[state]} solid={state === "LIVE"}>
              {state}
            </Tag>
            {comp.for_cup && <Tag tone="warn">Counts for the cup</Tag>}
            {squadName ? <Tag tone="warn">{squadName}</Tag> : <Tag tone="info">Whole Barracks</Tag>}
          </>
        }
      >
        {g.emoji} {g.name} · {hd.dow} {hd.day} {hd.mon}
        {shortTime(comp.tee_time) ? ` · ${shortTime(comp.tee_time)}` : ""} · CO{" "}
        <span className="text-ink">{commander?.name ?? "Vacant"}</span>{" "}
        <span className="hq-mono text-[11px] uppercase tracking-[0.1em]">({commanderRole})</span>
      </PageHead>

      {/* ── Header readout strip ─────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-6">
        <Panel i={0}>
          <div className="flex items-center gap-2">
            <Dot tone={STATE_TONE[state]} pulse={state === "LIVE"} />
            <span className="hq-label">Room</span>
          </div>
          <p
            className="hq-readout mt-2 text-[20px] font-bold"
            style={{
              color:
                state === "LIVE"
                  ? "var(--color-moss)"
                  : state === "SCRUBBED"
                    ? "var(--color-flag)"
                    : "var(--color-ink)",
            }}
          >
            {state}
          </p>
        </Panel>
        <Panel i={1}>
          <Stat value={`${present}/${expected}`} label="Present / expected" tone={present ? "live" : undefined} />
        </Panel>
        <Panel i={2}>
          <Stat value={noShow} label="No-shows" tone={noShow ? "alert" : undefined} />
        </Panel>
        <Panel i={3}>
          <Stat value={comp.games_count} label="Games logged" tone={started && !finished ? "live" : undefined} />
        </Panel>
        <Panel i={4}>
          <Stat
            value={shortTime(comp.tee_time) || "—"}
            label="Scheduled"
            sub={`${hd.dow} ${hd.day} ${hd.mon}`}
          />
        </Panel>
        <Panel i={5} className="col-span-2 xl:col-span-1">
          {started ? (
            <Elapsed
              from={comp.started_at!}
              to={comp.finished_at}
              label={finished ? "Total on station" : "Elapsed"}
              size={30}
            />
          ) : scrubbed ? (
            <Stat value="STOOD DOWN" label="Operation scrubbed" tone="alert" />
          ) : (
            <div className="scale-[0.72] origin-left">
              <Countdown iso={scheduledIso} label="Until kick-off" />
            </div>
          )}
        </Panel>
      </div>

      {scrubbed && (
        <Panel i={6} className="mb-4" label="Operation scrubbed" status={<Dot tone="alert" />}>
          <p className="text-[13px] text-ink-soft">
            {comp.cancel_reason || "This operation was called off. The record stays on the board."}
          </p>
        </Panel>
      )}

      {/* ── The room ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[1.05fr_1.15fr_0.95fr]">
        {/* Column 1 — the roster */}
        <div className="flex flex-col gap-4">
          <Panel
            i={7}
            label="Roster / roll call"
            status={<Dot tone={state === "ROLL CALL" ? "warn" : present ? "live" : "idle"} pulse={state === "ROLL CALL"} />}
            right={
              <span className="hq-mono text-[11px] text-ink-soft">
                {roster.length} on strength
              </span>
            }
          >
            {roster.length === 0 ? (
              <Nil>No roster — the squad is empty</Nil>
            ) : (
              <RollCall
                compId={comp.id}
                roster={rollCall}
                isCO={isCO}
                me={profile.id}
                locked={finished || scrubbed}
              />
            )}
            {rsvpClosed && !finished && (
              <p className="hq-mono mt-2 text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                Roll call locked — intent can no longer be changed
              </p>
            )}
          </Panel>

          {isCO && !finished && !scrubbed && (
            <Panel i={8} label="Command" status={<Dot tone="warn" />}>
              {comp.squad_id ? (
                <ActingCaptain
                  compId={comp.id}
                  value={comp.acting_captain_id}
                  people={profiles.map((p) => ({ id: p.id, name: p.name }))}
                  me={profile.id}
                />
              ) : (
                <p className="hq-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                  Whole-Barracks operation — the President holds command
                </p>
              )}
              {started && (
                <div className="mt-4 border-t border-rule pt-4">
                  <CloseOperation
                    compId={comp.id}
                    gamesCount={comp.games_count}
                    present={present}
                    startedAt={comp.started_at!}
                  />
                </div>
              )}
            </Panel>
          )}
        </div>

        {/* Column 2 — the night itself */}
        <div className="flex flex-col gap-4">
          <Panel
            i={9}
            label={finished ? "Games played" : "Live games count"}
            sweep={started && !finished}
            status={<Dot tone={started && !finished ? "live" : "idle"} pulse={started && !finished} />}
            right={
              started && (
                <span className="hq-mono text-[11px] text-ink-soft">
                  {finished
                    ? durationText(comp.started_at!, comp.finished_at!)
                    : `since ${clock(comp.started_at!)}`}
                </span>
              )
            }
          >
            <GamesConsole
              compId={comp.id}
              gamesCount={comp.games_count}
              started={started}
              finished={finished || scrubbed}
              isCO={isCO}
              expected={expected}
            />
            {finished && (
              <div className="mt-4 border-t border-rule pt-3">
                <Row k="Opened" v={clock(comp.started_at!)} />
                <Row k="Closed" v={clock(comp.finished_at!)} />
                <Row k="On station" v={durationText(comp.started_at!, comp.finished_at!)} tone="warn" />
                <Row k="Deployed" v={present} tone="live" />
              </div>
            )}
          </Panel>

          <Panel
            i={10}
            label="Briefing"
            right={<Proto>extras</Proto>}
          >
            {comp.notes ? (
              <p className="whitespace-pre-wrap text-[13px] leading-snug">{comp.notes}</p>
            ) : (
              <p className="hq-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                No orders written for this operation
              </p>
            )}
            <div className="mt-3 border-t border-rule pt-3">
              <Row k="Game" v={`${g.emoji} ${g.name}`} />
              <Row k="Squad" v={squadName ?? "Whole Barracks"} />
              {comp.stake && <Row k="Stake" v={comp.stake} tone="warn" />}
              {g.hasScorecard && <Row k="Format" v={`${comp.holes} holes · ${comp.format.toUpperCase()}`} />}
              {comp.course && <Row k="Course" v={comp.course} />}
            </div>
            {/* Prototype extras — maps and loadouts have no schema yet. */}
            <div className="mt-3 border-t border-dashed border-rule pt-3">
              <p className="hq-label mb-1.5">Map rotation / loadouts</p>
              <div className="flex flex-wrap gap-1.5">
                {["Rotation locked", "No killstreaks", "Party chat only", "First to 6"].map((t) => (
                  <span
                    key={t}
                    className="hq-mono rounded-[2px] border border-dashed px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em]"
                    style={{ borderColor: "#4b5a52", color: "#6d8076" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </Panel>

          <Panel
            i={11}
            label="Media"
            right={<span className="hq-mono text-[11px] text-ink-soft">{photos.length} captured</span>}
          >
            {photos.length === 0 ? (
              <Nil>No evidence captured</Nil>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {photos.slice(0, 12).map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.id}
                    src={p.url}
                    alt={p.caption ?? "Operation media"}
                    className="h-[74px] w-full rounded-[2px] border border-rule object-cover"
                  />
                ))}
              </div>
            )}
            <p className="hq-mono mt-2 text-[10px] uppercase tracking-[0.12em] text-ink-soft">
              {comments.length} message{comments.length === 1 ? "" : "s"} on the operation thread
            </p>
          </Panel>
        </div>

        {/* Column 3 — the future systems, clearly marked */}
        <div className="flex flex-col gap-4">
          <Panel
            i={12}
            label="Comms"
            status={<Dot tone="live" pulse />}
            right={<Proto />}
          >
            <CommsPanel
              names={roster.map((p) => p.name)}
              game={g.name}
              pinned={
                comp.notes?.trim() ||
                `${g.name} · ${hd.dow} ${hd.day} ${hd.mon}${shortTime(comp.tee_time) ? ` · ${shortTime(comp.tee_time)}` : ""}. ${expected} expected. Be on and ready.`
              }
            />
          </Panel>

          <Panel i={13} label="Voice" right={<Proto />}>
            <VoicePanel
              channel={`${(squadName ?? g.name).toUpperCase()} // DEPLOYMENT`}
            />
          </Panel>

          <Panel i={14} label="Stream" right={<Proto />}>
            <StreamPanel live={started && !finished} host={LINK.host} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
