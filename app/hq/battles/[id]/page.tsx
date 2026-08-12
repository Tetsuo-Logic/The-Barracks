import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSquads } from "@/lib/queries";
import { gameById } from "@/lib/games";
import { Panel, Dot, Tag, Row, PageHead, Nil, Proto } from "@/components/hq/Kit";
import { BattleConsole } from "@/components/hq/battle/BattleConsole";
import { LobbyKey } from "@/components/hq/battle/LobbyKey";
import { CaptureSources } from "@/components/hq/battle/CaptureSources";
import { VoicePanel } from "@/components/hq/battle/VoicePanel";
import { BattleChat } from "@/components/hq/battle/BattleChat";
import { battleById, orgById, rosterFor, stageIndex, type NetworkOperative } from "@/lib/hq/future/network";
import { presenceFor } from "@/lib/hq/future/systems";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = battleById(id);
  const org = b ? orgById(b.org) : null;
  return { title: b ? `Battle room · The Barracks vs ${org?.name ?? "Unknown"}` : "Battle room" };
}

// ── THE BATTLE ROOM ────────────────────────────────────────────────────────
// One screen for the whole engagement: who's playing, where the lobby is, what
// the score is, what the system thinks happened and — the bit that decides it —
// what the two Captains sign. Our roster is real (squads/profiles); everything
// on the other side of the fixture is the network prototype.
export default async function BattleRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const battle = battleById(id);
  if (!battle) notFound();

  const org = orgById(battle.org);
  if (!org) notFound();

  const profile = await requireProfile();
  const supabase = await createClient();
  const [squads, { data: profs }] = await Promise.all([
    getSquads(profile.id),
    supabase.from("profiles").select("id, name, nickname, is_president"),
  ]);

  const game = gameById(battle.game);

  // Our side is real: the squad that plays this game, else the whole Barracks.
  const squad = squads.find((s) => s.squad.game === battle.game) ?? null;
  const ourRoster: { id: string; name: string; role: string; captain: boolean }[] = squad
    ? squad.members.map((m) => ({
        id: m.profile.id,
        name: m.profile.nickname || m.profile.name,
        role: m.is_captain ? "Captain" : "Operative",
        captain: m.is_captain,
      }))
    : ((profs ?? []) as { id: string; name: string; nickname: string | null; is_president: boolean }[])
        .slice(0, 7)
        .map((p) => ({
          id: p.id,
          name: p.nickname || p.name,
          role: p.is_president ? "President · acting Captain" : "Operative",
          captain: p.is_president,
        }));

  const theirRoster: NetworkOperative[] = rosterFor(battle.org);
  const ourCaptain = ourRoster.find((m) => m.captain)?.name ?? "Unassigned";

  const idx = stageIndex(battle.stage);
  const roomOpen = idx >= stageIndex("room_open");
  const callsign = profile.nickname || profile.name;

  return (
    <div>
      <PageHead
        eyebrow={`Battle room // ${battle.stage.replace(/_/g, " ")}`}
        title={`The Barracks vs ${org.name}`}
        right={
          <>
            <Proto />
            <Link
              href={`/hq/rivals#${org.id}`}
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              Rivalry
            </Link>
            <Link
              href="/hq/battles"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              ← All battles
            </Link>
          </>
        }
      >
        {game.emoji} {game.name.toUpperCase()} {"//"} {battle.format.toUpperCase()} · {battle.scheduled} ·
        lobby hosted by <span className="text-ink">{battle.lobby.host}</span>
      </PageHead>

      <BattleConsole
        battle={battle}
        us={{ name: "The Barracks", tag: "BRK" }}
        them={{ name: org.name, tag: org.tag }}
      />

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        {/* ── Left: who is in the room ──────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Panel
              i={5}
              label="The Barracks"
              status={<Dot tone="live" pulse />}
              right={<Tag tone="live">{ourRoster.length} on the sheet</Tag>}
            >
              {ourRoster.length === 0 ? (
                <Nil>No roster — form a squad first</Nil>
              ) : (
                <ul className="flex flex-col">
                  {ourRoster.map((m, i) => {
                    const state = presenceFor(m.id, i);
                    const present = state === "ready" || state === "deployed" || state === "online";
                    return (
                      <li key={m.id} className="flex items-center gap-2.5 border-b border-rule/50 py-1.5 last:border-0">
                        <Dot tone={present ? "live" : "idle"} pulse={state === "deployed"} />
                        <span className="min-w-0 flex-1 truncate text-[13px]">
                          {m.name}
                          <span className="hq-mono ml-2 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                            {m.role}
                          </span>
                        </span>
                        {m.captain && <Tag tone="warn" solid>Captain</Tag>}
                        <span className="hq-mono w-16 shrink-0 text-right text-[10px] uppercase tracking-[0.1em]"
                          style={{ color: present ? "var(--color-moss)" : "var(--color-ink-soft)" }}>
                          {present ? "Present" : "Awaiting"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="hq-mono mt-3 border-t border-rule/60 pt-2 text-[10px] uppercase tracking-[0.08em] text-ink-soft">
                Captain: {ourCaptain} · signs the result on our behalf
              </p>
            </Panel>

            <Panel
              i={6}
              label={org.name}
              status={<Dot tone="alert" />}
              right={<Tag tone="alert">{theirRoster.length || org.operatives} operatives</Tag>}
            >
              {theirRoster.length === 0 ? (
                <Nil>Roster not shared until the room opens</Nil>
              ) : (
                <ul className="flex flex-col">
                  {theirRoster.map((m, i) => (
                    <li key={m.name} className="flex items-center gap-2.5 border-b border-rule/50 py-1.5 last:border-0">
                      <Dot tone={i < 5 ? "warn" : "idle"} />
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {m.name}
                        <span className="hq-mono ml-2 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                          {m.role}
                        </span>
                      </span>
                      {m.captain && <Tag tone="warn" solid>Captain</Tag>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="hq-mono mt-3 border-t border-rule/60 pt-2 text-[10px] uppercase tracking-[0.08em] text-ink-soft">
                {org.tag} · {org.region} · {org.timezone} · {org.platform} · {org.temper}
              </p>
            </Panel>
          </div>

          <Panel i={7} label="Briefing" right={<Proto />}>
            {!battle.briefing ? (
              <Nil>No briefing issued</Nil>
            ) : (
              <>
                <p className="text-[15px] leading-snug">{battle.briefing.objective}</p>
                {battle.note && (
                  <p className="hq-mono mt-1.5 text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--color-sand)" }}>
                    {battle.note}
                  </p>
                )}
                <div className="mt-4 grid gap-4 md:grid-cols-[1.4fr_1fr]">
                  <div>
                    <p className="hq-label mb-1.5">Rules of engagement</p>
                    <ul className="flex flex-col gap-1">
                      {battle.briefing.rules.map((r) => (
                        <li key={r} className="flex gap-2 text-[13px] text-ink-soft">
                          <span style={{ color: "var(--color-moss)" }}>·</span>
                          <span className="min-w-0">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="hq-label mb-1.5">Rotation</p>
                    <div className="flex flex-wrap gap-1.5">
                      {battle.briefing.maps.map((m) => (
                        <Tag key={m} tone="info">{m}</Tag>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </Panel>

          <BattleChat i={8} callsign={callsign} them={org.name} />
        </div>

        {/* ── Right: the machinery ──────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel
            i={9}
            label="Lobby"
            status={<Dot tone={roomOpen ? "live" : "idle"} pulse={roomOpen} />}
            right={<Tag tone={roomOpen ? "live" : "idle"}>{roomOpen ? "Published" : "Sealed"}</Tag>}
          >
            {roomOpen ? (
              <>
                <Row k="Host" v={battle.lobby.host} tone="warn" />
                <Row k="Lobby name" v={battle.lobby.name} />
                <LobbyKey value={battle.lobby.key} />
                <Row k="Region" v={battle.lobby.region} />
                <Row k="Join by" v={battle.lobby.join ?? battle.scheduled} tone="warn" />
                <p className="hq-mono mt-3 border-t border-rule/60 pt-2 text-[10px] uppercase leading-[1.6] tracking-[0.08em] text-ink-soft">
                  The key is visible to rostered participants of this battle only —
                  {" "}{ourRoster.length + (theirRoster.length || org.operatives)} operatives across both Barracks.
                </p>
              </>
            ) : (
              <Nil>Lobby details publish when the room opens</Nil>
            )}
          </Panel>

          <CaptureSources i={10} game={game.name} />

          <VoicePanel i={11} />

          <Panel
            i={12}
            label="Watch"
            status={<Dot tone={battle.stream?.live ? "live" : "idle"} pulse={battle.stream?.live} />}
            right={<Proto />}
          >
            {battle.stream?.live ? (
              <>
                <div
                  className="mb-3 flex h-24 items-center justify-center rounded-[3px] border border-rule"
                  style={{ background: "linear-gradient(140deg, rgba(61,220,132,0.09), rgba(0,0,0,0.35))" }}
                >
                  <span className="hq-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--color-moss)" }}>
                    ● Live feed
                  </span>
                </div>
                <Row k="Channel" v={battle.stream.platform} />
                <Row k="Caster" v={battle.stream.caster} tone="warn" />
                <Row k="Watching" v={`${battle.stream.viewers} operatives`} tone="live" />
                <p className="hq-mono mt-3 text-[10px] uppercase tracking-[0.08em] text-ink-soft">
                  Anyone in the Barracks can watch a room they are not playing in.
                </p>
              </>
            ) : (
              <Nil>No stream on this battle</Nil>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
