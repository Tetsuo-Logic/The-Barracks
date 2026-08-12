import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getServiceRoster, getSquads } from "@/lib/data";
import { gameById } from "@/lib/games";
import { shortDate } from "@/lib/dates";
import { Avatar } from "@/components/Avatar";
import { Panel, Stat, Dot, Tag, Row, PageHead, Nil, Proto } from "@/components/hq/Kit";
import { presenceFor, PRESENCE_TONE } from "@/lib/hq/future/systems";
import type { Profile } from "@/lib/domain";
import type { Service } from "@/lib/service";

export const metadata = { title: "Personnel · Barracks HQ" };

// ── The personnel register ─────────────────────────────────────────────────
// A service register, NOT a ladder. The Barracks does not rank its people by
// skill and never will — these columns are participation, assignment and
// conduct. Ordering is by name or by service, and the footer says so out loud.

type SortKey = "name" | "service" | "hours" | "games" | "noshows" | "marks" | "joined";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "joined", label: "Enlisted" },
  { key: "service", label: "Operations" },
  { key: "games", label: "Games" },
  { key: "hours", label: "Hours" },
  { key: "noshows", label: "No-shows" },
  { key: "marks", label: "Marks" },
];

// One dense grid template shared by the header and every row, so the columns
// stay welded together.
const COLS =
  "grid grid-cols-[2.1rem_minmax(180px,1.6fr)_6.5rem_minmax(150px,1.25fr)_4rem_4rem_4.5rem_4.5rem_5.5rem_6.5rem] items-center gap-3";

type Line = {
  profile: Profile;
  service: Service;
  squads: { name: string; captain: boolean }[];
  captaincies: number;
  warnings: number;
  strikes: number;
};

function rankOf(l: Line): { label: string; tone: "warn" | "live" | "info" } {
  if (l.profile.is_president) return { label: "President", tone: "warn" };
  if (l.captaincies > 0) return { label: "Captain", tone: "live" };
  if (l.profile.is_admin) return { label: "CO", tone: "warn" };
  return { label: "Operative", tone: "info" };
}

export default async function PersonnelPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const me = await requireProfile();
  const { sort } = await searchParams;
  const key: SortKey = (SORTS.find((s) => s.key === sort)?.key ?? "name") as SortKey;

  const supabase = await createClient();
  const [roster, squads, { data: warnRows }, { data: strikeRows }] = await Promise.all([
    getServiceRoster(),
    getSquads(me.id),
    supabase.from("warnings").select("player_id"),
    supabase.from("strikes").select("player_id"),
  ]);

  const countBy = (rows: { player_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (!r.player_id) continue;
      m.set(r.player_id, (m.get(r.player_id) ?? 0) + 1);
    }
    return m;
  };
  const warnCount = countBy((warnRows ?? []) as { player_id: string | null }[]);
  const strikeCount = countBy((strikeRows ?? []) as { player_id: string | null }[]);

  // Assignment: which squads each operative is posted to, and where they hold
  // the captaincy.
  const postings = new Map<string, { name: string; captain: boolean }[]>();
  for (const s of squads) {
    const name = s.squad.name || gameById(s.squad.game).name;
    for (const m of s.members) {
      const arr = postings.get(m.profile.id) ?? [];
      arr.push({ name, captain: m.is_captain });
      postings.set(m.profile.id, arr);
    }
  }

  const lines: Line[] = roster.map((r) => {
    const posts = postings.get(r.profile.id) ?? [];
    return {
      profile: r.profile,
      service: r.service,
      squads: posts,
      captaincies: posts.filter((p) => p.captain).length,
      warnings: warnCount.get(r.profile.id) ?? 0,
      strikes: strikeCount.get(r.profile.id) ?? 0,
    };
  });

  const byName = (a: Line, b: Line) => a.profile.name.localeCompare(b.profile.name);
  const sorted = [...lines].sort((a, b) => {
    switch (key) {
      case "service":
        return b.service.operations - a.service.operations || byName(a, b);
      case "games":
        return b.service.games - a.service.games || byName(a, b);
      case "hours":
        return b.service.hours - a.service.hours || byName(a, b);
      case "noshows":
        return b.service.noShows - a.service.noShows || byName(a, b);
      case "marks":
        return (
          b.strikes * 3 + b.warnings - (a.strikes * 3 + a.warnings) || byName(a, b)
        );
      case "joined":
        return a.profile.created_at < b.profile.created_at ? -1 : 1;
      default:
        return byName(a, b);
    }
  });

  const total = {
    operations: lines.reduce((n, l) => n + l.service.operations, 0),
    games: lines.reduce((n, l) => n + l.service.games, 0),
    hours: Math.round(lines.reduce((n, l) => n + l.service.hours, 0) * 10) / 10,
    noShows: lines.reduce((n, l) => n + l.service.noShows, 0),
    marks: lines.reduce((n, l) => n + l.warnings + l.strikes, 0),
  };

  const unblooded = lines.filter((l) => l.service.operations === 0);
  const flagged = lines
    .filter((l) => l.warnings + l.strikes > 0 || l.service.noShows > 0)
    .sort((a, b) => b.strikes * 3 + b.warnings - (a.strikes * 3 + a.warnings));

  return (
    <div>
      <PageHead
        eyebrow="Barracks"
        title="Personnel register"
        right={
          <>
            <span className="hq-label">Sort</span>
            {SORTS.map((s) => (
              <Link
                key={s.key}
                href={`/hq/personnel?sort=${s.key}`}
                className="hq-label rounded-[3px] border px-2 py-1.5 transition-colors"
                style={{
                  borderColor: key === s.key ? "var(--color-sand)" : "var(--color-rule)",
                  color: key === s.key ? "var(--color-sand)" : undefined,
                }}
              >
                {s.label}
              </Link>
            ))}
          </>
        }
      >
        {lines.length} on strength · {total.operations} operations attended ·{" "}
        {total.hours}h deployed
      </PageHead>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-6">
        <Panel i={0}>
          <Stat value={lines.length} label="On strength" sub={`${squads.length} squads`} />
        </Panel>
        <Panel i={1}>
          <Stat value={total.operations} label="Operations attended" />
        </Panel>
        <Panel i={2}>
          <Stat value={total.games} label="Games logged" />
        </Panel>
        <Panel i={3}>
          <Stat value={total.hours} label="Hours deployed" tone="live" />
        </Panel>
        <Panel i={4}>
          <Stat
            value={total.noShows}
            label="No-shows"
            tone={total.noShows > 0 ? "warn" : undefined}
          />
        </Panel>
        <Panel i={5}>
          <Stat
            value={total.marks}
            label="Marks on file"
            tone={total.marks > 0 ? "alert" : undefined}
            sub="Warnings + strikes"
          />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_330px]">
        {/* ── The register ─────────────────────────────────────────────── */}
        <Panel
          i={6}
          sweep
          label="Service register"
          status={<Dot tone="live" pulse />}
          pad={false}
          right={<span className="hq-mono text-[11px] text-ink-soft">{sorted.length} records</span>}
        >
          <div className={`${COLS} border-b border-rule px-4 py-2`}>
            <span className="hq-label">#</span>
            <HeadCell label="Operative" k="name" active={key} />
            <span className="hq-label">Callsign</span>
            <span className="hq-label">Assignment</span>
            <HeadCell label="Ops" k="service" active={key} right />
            <HeadCell label="Gms" k="games" active={key} right />
            <HeadCell label="Hrs" k="hours" active={key} right />
            <HeadCell label="N/S" k="noshows" active={key} right />
            <HeadCell label="Conduct" k="marks" active={key} right />
            <span className="hq-label text-right">
              Presence <Proto>P</Proto>
            </span>
          </div>

          {sorted.length === 0 ? (
            <Nil>No personnel on file</Nil>
          ) : (
            sorted.map((l, i) => {
              const rank = rankOf(l);
              const state = presenceFor(l.profile.id, i);
              const clean = l.warnings + l.strikes === 0;
              return (
                <Link
                  key={l.profile.id}
                  href={`/hq/personnel/${l.profile.id}`}
                  className={`${COLS} hq-rise border-b border-rule/50 px-4 py-2 transition-colors last:border-0 hover:bg-[rgba(255,255,255,0.028)]`}
                  style={{ ["--i" as string]: Math.min(i, 12) }}
                >
                  <span className="hq-mono text-[11px] text-ink-soft">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar
                      name={l.profile.name}
                      avatarUrl={l.profile.avatar_url}
                      colour={l.profile.colour}
                      size={26}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-ink">
                        {l.profile.name}
                        {l.profile.id === me.id && (
                          <span className="hq-mono ml-1.5 text-[10px] text-ink-soft">(you)</span>
                        )}
                      </span>
                      <span className="hq-mono block text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                        {rank.label}
                      </span>
                    </span>
                  </span>

                  <span className="hq-mono truncate text-[12px] uppercase tracking-[0.1em] text-ink-soft">
                    {l.profile.nickname || "—"}
                  </span>

                  <span className="flex min-w-0 flex-wrap items-center gap-1">
                    {l.squads.length === 0 ? (
                      <span className="hq-mono text-[11px] text-ink-soft">Unassigned</span>
                    ) : (
                      l.squads.slice(0, 3).map((s) => (
                        <Tag key={s.name} tone={s.captain ? "warn" : "info"}>
                          {s.captain ? `${s.name} · CPT` : s.name}
                        </Tag>
                      ))
                    )}
                    {l.squads.length > 3 && (
                      <span className="hq-mono text-[10px] text-ink-soft">
                        +{l.squads.length - 3}
                      </span>
                    )}
                  </span>

                  <span className="hq-mono text-right text-[13px] text-ink">
                    {l.service.operations}
                  </span>
                  <span className="hq-mono text-right text-[13px] text-ink-soft">
                    {l.service.games}
                  </span>
                  <span className="hq-mono text-right text-[13px] text-ink-soft">
                    {l.service.hours}
                  </span>
                  <span
                    className="hq-mono text-right text-[13px]"
                    style={{
                      color: l.service.noShows > 0 ? "var(--color-sand)" : "var(--color-ink-soft)",
                    }}
                  >
                    {l.service.noShows || "—"}
                  </span>

                  <span className="flex items-center justify-end gap-1">
                    {clean ? (
                      <span className="hq-mono text-[11px] text-ink-soft">Clean</span>
                    ) : (
                      <>
                        {l.strikes > 0 && <Tag tone="alert">{l.strikes}S</Tag>}
                        {l.warnings > 0 && <Tag tone="warn">{l.warnings}W</Tag>}
                      </>
                    )}
                  </span>

                  <span className="flex items-center justify-end gap-1.5">
                    <Dot tone={PRESENCE_TONE[state]} pulse={state === "deployed"} />
                    <span className="hq-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                      {state}
                    </span>
                  </span>
                </Link>
              );
            })
          )}

          <p className="hq-mono border-t border-rule px-4 py-2.5 text-[10px] uppercase leading-relaxed tracking-[0.12em] text-ink-soft">
            Register of service — participation, assignment and conduct. The Barracks does not
            rank its people by skill; there is no ladder here and never will be.
          </p>
        </Panel>

        {/* ── Right column ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel i={7} label="Order of battle">
            {squads.length === 0 ? (
              <Nil>No squads formed</Nil>
            ) : (
              squads.map((s) => {
                const cap = s.members.find((m) => m.is_captain)?.profile ?? null;
                return (
                  <Row
                    key={s.squad.id}
                    k={s.squad.name || gameById(s.squad.game).name}
                    v={`${s.members.length} posted · ${cap ? cap.name : "no captain"}`}
                    tone={cap ? "live" : "idle"}
                  />
                );
              })
            )}
            <Link href="/hq/squads" className="hq-label mt-3 block hover:text-ink">
              Squads →
            </Link>
          </Panel>

          <Panel
            i={8}
            label="Conduct watch"
            status={<Dot tone={flagged.length ? "alert" : "idle"} />}
          >
            {flagged.length === 0 ? (
              <Nil>Whole register clean — suspicious</Nil>
            ) : (
              <ul className="flex flex-col">
                {flagged.slice(0, 8).map((l) => (
                  <li
                    key={l.profile.id}
                    className="flex items-center gap-2 border-b border-rule/60 py-1.5 last:border-0"
                  >
                    <Link
                      href={`/hq/personnel/${l.profile.id}`}
                      className="min-w-0 flex-1 truncate text-[13px] hover:text-ink"
                    >
                      {l.profile.name}
                    </Link>
                    {l.strikes > 0 && <Tag tone="alert">{l.strikes} strike</Tag>}
                    {l.warnings > 0 && <Tag tone="warn">{l.warnings} warn</Tag>}
                    {l.service.noShows > 0 && (
                      <span className="hq-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                        {l.service.noShows} n/s
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/hq/court" className="hq-label mt-3 block hover:text-ink">
              The Court →
            </Link>
          </Panel>

          <Panel i={9} label="Awaiting first deployment">
            {unblooded.length === 0 ? (
              <Nil>Every operative blooded</Nil>
            ) : (
              <ul className="flex flex-col">
                {unblooded.map((l) => (
                  <li
                    key={l.profile.id}
                    className="flex items-center justify-between gap-2 border-b border-rule/60 py-1.5 last:border-0"
                  >
                    <Link
                      href={`/hq/personnel/${l.profile.id}`}
                      className="min-w-0 flex-1 truncate text-[13px] hover:text-ink"
                    >
                      {l.profile.name}
                    </Link>
                    <span className="hq-mono shrink-0 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                      enlisted {shortDate(l.profile.created_at.slice(0, 10))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** A column header that sorts the register. Server-rendered — it's just a link. */
function HeadCell({
  label,
  k,
  active,
  right = false,
}: {
  label: string;
  k: SortKey;
  active: SortKey;
  right?: boolean;
}) {
  const on = active === k;
  return (
    <Link
      href={`/hq/personnel?sort=${k}`}
      className={`hq-label transition-colors hover:text-ink ${right ? "text-right" : ""}`}
      style={{ color: on ? "var(--color-sand)" : undefined }}
    >
      {label}
      <span className="ml-1 opacity-70">{on ? "▾" : "·"}</span>
    </Link>
  );
}
