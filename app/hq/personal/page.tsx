import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getRadar, getSquads } from "@/lib/queries";
import { computeService } from "@/lib/service";
import { gameById, compHeading } from "@/lib/games";
import { heroDate, shortTime, shortDate } from "@/lib/dates";
import { Panel, PageHead, Stat, Tag, Row, Dot, Nil, Proto } from "@/components/hq/Kit";
import type { Competition, Rsvp } from "@/lib/types";

export const metadata = { title: "Personal · Barracks HQ" };

// The account, not the Barracks. A User exists independently and may hold 0..n
// memberships — this is where that's visible. Deliberately NOT a universal
// Steam/PSN stat tracker: official history only ever comes from Barracks
// activity, so everything here is either your membership or your own service.
export default async function PersonalPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: comps }, { data: myRsvps }, radar, squads] = await Promise.all([
    supabase.from("competitions").select("*").order("date", { ascending: true }),
    supabase.from("rsvps").select("*").eq("player_id", profile.id),
    getRadar(profile.id),
    getSquads(profile.id),
  ]);

  const allComps = (comps ?? []) as Competition[];
  const mine = (myRsvps ?? []) as Rsvp[];
  const service = computeService(mine, allComps);

  const today = new Date().toISOString().slice(0, 10);
  const rsvpById = new Map(mine.map((r) => [r.competition_id, r]));
  const upcoming = allComps.filter((c) => c.status === "upcoming" && c.date >= today).slice(0, 8);
  const mySquads = squads.filter((s) => s.mine);
  const myRadar = radar.items.filter((r) => r.mine);

  // Memberships: only the live one is wired — the rest are the multi-Barracks
  // shape (lib/hq/future). A Barracks never sees another Barracks' data.
  const memberships = [
    { name: "The Barracks", tag: "BRK", role: profile.is_president ? "President" : profile.is_admin ? "CO" : "Operative", live: true, ops: service.operations },
    { name: "Work Lads", tag: "WRK", role: "Operative", live: false, ops: 4 },
    { name: "Old School", tag: "OSC", role: "Captain", live: false, ops: 11 },
  ];

  return (
    <div>
      <PageHead
        eyebrow="Account"
        title={profile.nickname || profile.name}
        right={
          <Link
            href={`/hq/personnel/${profile.id}`}
            className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
          >
            Full service record →
          </Link>
        }
      >
        Your account across every Barracks you belong to.
      </PageHead>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Panel i={0}><Stat value={memberships.length} label="Barracks" sub="Memberships" /></Panel>
        <Panel i={1}><Stat value={service.operations} label="Operations attended" tone="live" /></Panel>
        <Panel i={2}><Stat value={service.hours} label="Hours deployed" /></Panel>
        <Panel i={3}><Stat value={mySquads.length} label="Squads" /></Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* Memberships */}
          <Panel i={4} label="Your Barracks" right={<Proto>Multi-Barracks</Proto>}>
            <ul className="flex flex-col gap-2">
              {memberships.map((m) => (
                <li
                  key={m.name}
                  className="flex items-center gap-3 rounded-[3px] border border-rule px-3 py-2.5"
                  style={m.live ? { borderColor: "color-mix(in srgb, var(--color-sand) 35%, transparent)" } : undefined}
                >
                  <span
                    className="hq-mono flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] text-[10px] font-bold"
                    style={{
                      backgroundColor: m.live ? "var(--color-sand)" : "var(--color-rule)",
                      color: m.live ? "#0b100e" : "var(--color-ink-soft)",
                    }}
                  >
                    {m.tag}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-ink">{m.name}</span>
                    <span className="hq-label">{m.role} · {m.ops} operations</span>
                  </span>
                  {m.live ? <Tag tone="live" solid>Commanding</Tag> : <Tag tone="idle">Switch</Tag>}
                </li>
              ))}
            </ul>
            <p className="hq-label mt-3 opacity-60">
              Each Barracks is isolated — none can see another&apos;s activity.
            </p>
          </Panel>

          {/* Personal calendar across memberships */}
          <Panel i={5} label="Your calendar" right={<Link href="/hq/calendar" className="hq-label hover:text-ink">Full calendar →</Link>}>
            {upcoming.length === 0 ? (
              <Nil>Nothing on your board</Nil>
            ) : (
              <ul className="flex flex-col">
                {upcoming.map((c) => {
                  const g = gameById(c.game);
                  const hd = heroDate(c.date);
                  const r = rsvpById.get(c.id);
                  return (
                    <li key={c.id} className="flex items-center gap-3 border-b border-rule/60 py-2 last:border-0">
                      <span className="hq-mono w-14 shrink-0 text-xs uppercase text-ink-soft">
                        {hd.dow} {hd.day}
                      </span>
                      <span className="w-5 shrink-0 text-center">{g.emoji}</span>
                      <Link href={`/hq/operations/${c.id}`} className="min-w-0 flex-1 truncate text-[13px] hover:text-sand">
                        {compHeading(c)}
                      </Link>
                      <span className="hq-mono shrink-0 text-[11px] text-ink-soft">
                        {shortTime(c.tee_time) || "—"}
                      </span>
                      {r ? (
                        <Tag tone={r.status === "in" ? "live" : r.status === "maybe" ? "warn" : "idle"}>
                          {r.status}
                        </Tag>
                      ) : (
                        <Tag tone="alert">Answer</Tag>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* Invites */}
          <Panel i={6} label="Invitations" right={<Proto />}>
            <div className="flex items-center gap-3 rounded-[3px] border border-dashed border-rule px-3 py-3">
              <Dot tone="warn" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-ink">The Shed</span>
                <span className="hq-label">Invited by Baz · COD squad</span>
              </span>
              <span className="hq-label rounded-[3px] border border-rule px-2 py-1">Accept</span>
              <span className="hq-label rounded-[3px] border border-rule px-2 py-1">Decline</span>
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          {/* Service summary */}
          <Panel i={7} label="Service">
            <Row k="Joined" v={shortDate(profile.created_at.slice(0, 10))} />
            <Row k="Operations attended" v={service.operations} tone="live" />
            <Row k="Games played" v={service.games} />
            <Row k="Hours deployed" v={`${service.hours}h`} />
            <Row k="No-shows" v={service.noShows} tone={service.noShows ? "alert" : "info"} />
            <Row k="Role" v={profile.is_president ? "President" : profile.is_admin ? "CO" : "Operative"} tone="warn" />
          </Panel>

          {/* Squads */}
          <Panel i={8} label="Your squads">
            {mySquads.length === 0 ? (
              <Nil>Not in a squad</Nil>
            ) : (
              <ul className="flex flex-col gap-2">
                {mySquads.map((s) => {
                  const g = gameById(s.squad.game);
                  const cap = s.captainId === profile.id;
                  return (
                    <li key={s.squad.id}>
                      <Link
                        href={`/hq/squads/${s.squad.id}`}
                        className="flex items-center gap-2.5 rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft"
                      >
                        <span>{g.emoji}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px]">
                          {s.squad.clan_tag && (
                            <span className="hq-mono mr-1.5 text-[10px]" style={{ color: "var(--color-sand)" }}>
                              [{s.squad.clan_tag}]
                            </span>
                          )}
                          {s.squad.name || g.name}
                        </span>
                        {cap && <Tag tone="warn">Captain</Tag>}
                        <span className="hq-mono text-[11px] text-ink-soft">{s.members.length}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* Radar interests */}
          <Panel i={9} label="Your radar" right={<Link href="/hq/radar" className="hq-label hover:text-ink">Radar →</Link>}>
            {myRadar.length === 0 ? (
              <Nil>No contacts marked</Nil>
            ) : (
              <ul className="flex flex-col">
                {myRadar.slice(0, 6).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 border-b border-rule/60 py-2 last:border-0">
                    <Dot tone="live" />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{r.title}</span>
                    <span className="hq-mono shrink-0 text-[11px] text-ink-soft">
                      {r.release_date ? shortDate(r.release_date) : "TBA"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Cross-Barracks conflicts */}
          <Panel i={10} label="Conflicts across Barracks" right={<Proto />}>
            <div className="rounded-[3px] border px-3 py-2.5" style={{ borderColor: "color-mix(in srgb, var(--color-flag) 40%, transparent)" }}>
              <p className="hq-label mb-1" style={{ color: "var(--color-flag)" }}>Double-booked</p>
              <p className="text-[13px] text-ink">Friday 20:30</p>
              <p className="hq-mono text-[11px] text-ink-soft">
                THE BARRACKS — COD · WORK LADS — FIFA
              </p>
            </div>
            <p className="hq-label mt-3 opacity-60">
              Your account sees across memberships. Neither Barracks sees the other.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
