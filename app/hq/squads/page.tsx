import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSquads, getSquadRequests } from "@/lib/data/queries";
import { gameById, compHeading } from "@/lib/games";
import { todayISO, shortDate, shortTime, relativeTime } from "@/lib/dates";
import { Panel, Stat, Dot, Tag, Meter, PageHead, Nil, Proto } from "@/components/hq/Kit";
import { Avatar } from "@/components/Avatar";
import { squadRecord } from "@/components/hq/squad/proto";
import { PANEL_LABEL, panelKind } from "@/components/hq/squad/GamePanel";
import type { Competition } from "@/lib/types";

export const metadata = { title: "Squads · Barracks HQ" };

// Squads overview — every fighting unit in the Barracks on one board. Squads,
// members, captains, musters, night nudges and operations are all real; the
// battle record is the one prototype and is marked as such.
export default async function SquadsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [squads, requests, { data: compRows }] = await Promise.all([
    getSquads(profile.id),
    profile.is_admin ? getSquadRequests() : Promise.resolve([]),
    supabase.from("competitions").select("*").order("date", { ascending: true }),
  ]);

  const comps = (compRows ?? []) as Competition[];
  const today = todayISO();
  const bySquad = new Map<string, Competition[]>();
  for (const c of comps) {
    if (!c.squad_id) continue;
    const arr = bySquad.get(c.squad_id) ?? [];
    arr.push(c);
    bySquad.set(c.squad_id, arr);
  }

  const assigned = new Set(squads.flatMap((s) => s.members.map((m) => m.profile.id)));
  const mustersLive = squads.filter((s) => s.muster).length;
  const nightsWanted = squads.reduce((n, s) => n + s.nightRequests.length, 0);
  const scheduled = comps.filter(
    (c) => c.squad_id && c.status === "upcoming" && c.date >= today,
  ).length;
  const mine = squads.filter((s) => s.mine).length;

  return (
    <div>
      <PageHead
        eyebrow="Barracks"
        title="Squads"
        right={
          <>
            <Link
              href="/hq/availability"
              className="hq-label rounded-[3px] px-3 py-2 font-semibold"
              style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
            >
              Call a muster
            </Link>
            <Link
              href="/squads"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              Form / disband
            </Link>
          </>
        }
      >
        {squads.length} squad{squads.length === 1 ? "" : "s"} on strength ·{" "}
        <span className="text-ink">{assigned.size}</span> operatives assigned
        {mine > 0 && <> · you serve in {mine}</>}
      </PageHead>

      {/* ── Status strip ─────────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Panel i={0}>
          <Stat value={squads.length} label="Squads formed" />
        </Panel>
        <Panel i={1}>
          <Stat value={assigned.size} label="Operatives assigned" />
        </Panel>
        <Panel i={2}>
          <Stat
            value={mustersLive}
            label="Musters live"
            tone={mustersLive > 0 ? "warn" : undefined}
          />
        </Panel>
        <Panel i={3}>
          <Stat
            value={nightsWanted}
            label="Nights wanted"
            tone={nightsWanted > 0 ? "alert" : undefined}
          />
        </Panel>
        <Panel i={4}>
          <Stat
            value={scheduled}
            label="Squad operations"
            sub="On the board"
            tone={scheduled > 0 ? "live" : undefined}
          />
        </Panel>
      </div>

      {/* ── Formation requests awaiting the President ─────────────────────── */}
      {requests.length > 0 && (
        <div className="mb-4">
          <Panel
            i={5}
            label="Formation requests"
            status={<Dot tone="alert" pulse />}
            right={
              <Link href="/squads" className="hq-label hover:text-ink">
                Rule on them →
              </Link>
            }
          >
            <ul className="flex flex-col">
              {requests.map((r) => {
                const g = gameById(r.game);
                return (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 border-b border-rule/60 py-1.5 last:border-0"
                  >
                    <span className="w-6 shrink-0 text-center">{g.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {r.name || `${g.name} Squad`}
                      {r.clan_tag && <span className="ml-2 text-ink-soft">[{r.clan_tag}]</span>}
                    </span>
                    <span className="hq-mono shrink-0 text-[11px] text-ink-soft">
                      {r.requester?.name ?? "Someone"} · {relativeTime(r.created_at)}
                    </span>
                    <Tag tone="alert">Awaiting ruling</Tag>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      )}

      {/* ── The board ────────────────────────────────────────────────────── */}
      {squads.length === 0 ? (
        <Panel i={6}>
          <Nil>No squads formed — the Barracks fights as one</Nil>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {squads.map((s, i) => {
            const g = gameById(s.squad.game);
            const all = bySquad.get(s.squad.id) ?? [];
            const upcoming = all.filter((c) => c.status === "upcoming" && c.date >= today);
            const run = all.filter((c) => c.status === "played").length;
            const captain = s.members.find((m) => m.is_captain)?.profile ?? null;
            const rec = squadRecord(s.squad.id);
            const mu = s.muster?.muster ?? null;
            const answered = s.muster?.responses.length ?? 0;

            const musterTone = mu ? (mu.status === "proposed" ? "alert" : "warn") : "idle";
            const musterText = !mu
              ? "No muster running"
              : mu.status === "proposed"
                ? `Night proposed · ${mu.chosen_date ? shortDate(mu.chosen_date) : "TBC"}`
                : `Muster open · ${answered}/${s.members.length} answered`;

            return (
              <Link key={s.squad.id} href={`/hq/squads/${s.squad.id}`} className="group block">
                <Panel
                  i={7 + i}
                  className="h-full transition-shadow group-hover:shadow-[0_0_0_1px_var(--color-sand)]"
                >
                  {/* Head */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[18px] leading-none">{g.emoji}</span>
                        {s.squad.clan_tag && (
                          <span
                            className="hq-mono rounded-[3px] border px-1.5 py-0.5 text-[11px] font-bold leading-none"
                            style={{
                              borderColor: "color-mix(in srgb, var(--color-sand) 45%, transparent)",
                              backgroundColor: "color-mix(in srgb, var(--color-sand) 11%, transparent)",
                              color: "var(--color-sand)",
                            }}
                          >
                            [{s.squad.clan_tag}]
                          </span>
                        )}
                        <h2 className="hq-readout truncate text-[18px] font-bold uppercase leading-none">
                          {s.squad.name || `${g.name} Squad`}
                        </h2>
                      </div>
                      <p className="hq-mono mt-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                        {g.name} · {PANEL_LABEL[panelKind(s.squad.game)]}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {s.mine && <Tag tone="live">Yours</Tag>}
                      {s.nightRequests.length > 0 && (
                        <Tag tone="alert" solid>
                          {s.nightRequests.length} night{s.nightRequests.length === 1 ? "" : "s"} wanted
                        </Tag>
                      )}
                    </div>
                  </div>

                  {/* Roster */}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex shrink-0 items-center">
                      {s.members.slice(0, 6).map((m, idx) => (
                        <span
                          key={m.profile.id}
                          className="rounded-full"
                          style={{
                            marginLeft: idx === 0 ? 0 : -7,
                            boxShadow: "0 0 0 2px #0b100e",
                            outline: m.is_captain ? "1px solid var(--color-sand)" : "none",
                            outlineOffset: 1,
                            borderRadius: 99,
                          }}
                          title={`${m.profile.name}${m.is_captain ? " · Captain" : ""}`}
                        >
                          <Avatar
                            name={m.profile.name}
                            avatarUrl={m.profile.avatar_url}
                            colour={m.profile.colour}
                            size={24}
                          />
                        </span>
                      ))}
                      {s.members.length > 6 && (
                        <span className="hq-mono ml-2 text-[11px] text-ink-soft">
                          +{s.members.length - 6}
                        </span>
                      )}
                      {s.members.length === 0 && (
                        <span className="hq-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                          No operatives
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-right">
                      <p className="hq-label">Captain</p>
                      <p
                        className="hq-mono truncate text-[12px]"
                        style={{ color: captain ? "var(--color-sand)" : "var(--color-ink-soft)" }}
                      >
                        {captain ? captain.name : "Vacant"}
                      </p>
                    </div>
                  </div>

                  {/* Muster */}
                  <div className="mt-3 flex items-center gap-2 border-t border-rule/60 pt-2.5">
                    <Dot tone={musterTone} pulse={mu?.status === "proposed"} />
                    <span className="hq-mono min-w-0 flex-1 truncate text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                      {musterText}
                    </span>
                  </div>

                  {/* Upcoming operations */}
                  <div className="mt-2.5">
                    <p className="hq-label mb-1">Upcoming operations</p>
                    {upcoming.length === 0 ? (
                      <p className="hq-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft opacity-70">
                        Nothing on the board
                      </p>
                    ) : (
                      <ul className="flex flex-col">
                        {upcoming.slice(0, 2).map((c) => (
                          <li key={c.id} className="flex items-center gap-2.5 py-0.5">
                            <span className="hq-mono w-14 shrink-0 text-[11px] text-ink-soft">
                              {shortDate(c.date)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[12px]">
                              {compHeading(c)}
                            </span>
                            <span className="hq-mono shrink-0 text-[11px] text-ink-soft">
                              {shortTime(c.tee_time) || "—"}
                            </span>
                          </li>
                        ))}
                        {upcoming.length > 2 && (
                          <li className="hq-mono py-0.5 text-[11px] text-ink-soft">
                            +{upcoming.length - 2} more
                          </li>
                        )}
                      </ul>
                    )}
                  </div>

                  {/* Record — prototype */}
                  <div className="mt-3 border-t border-rule/60 pt-2.5">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="hq-label">Battle record</span>
                      <span className="flex items-center gap-2">
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
                        <Proto />
                      </span>
                    </div>
                    <Meter pct={rec.pct} tone={rec.pct >= 50 ? "live" : "alert"} />
                    <div className="mt-1 flex items-center justify-between">
                      <span className="hq-mono text-[11px] text-ink-soft">
                        {rec.won}W · {rec.lost}L · {rec.pct}%
                      </span>
                      <span className="hq-mono text-[11px] text-ink-soft">
                        {run} operation{run === 1 ? "" : "s"} run
                      </span>
                    </div>
                  </div>

                  <p className="hq-label mt-3 text-right opacity-60 transition-opacity group-hover:opacity-100">
                    Open dossier →
                  </p>
                </Panel>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
