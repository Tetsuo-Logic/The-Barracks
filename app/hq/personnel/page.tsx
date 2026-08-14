import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getServiceRoster, getSquads } from "@/lib/data";
import { resolveViewRole, realRoleOf } from "@/lib/hq/role";
import { gameById } from "@/lib/games";
import { relativeTime } from "@/lib/dates";
import { Avatar } from "@/components/Avatar";
import { Dot, Tag, PageHead, Nil } from "@/components/hq/Kit";
import { FilterSelect } from "@/components/hq/FilterSelect";
import { EnlistLink } from "@/components/hq/personnel/EnlistLink";
import type { Profile, Competition, Rsvp } from "@/lib/types";
import type { Service } from "@/lib/service";

export const metadata = { title: "Personnel · Barracks HQ" };

// ── THE PERSONNEL REGISTER ─────────────────────────────────────────────────
// A service register, NOT a ladder. The Barracks does not rank its people by
// skill and never will — these columns are participation, assignment and
// conduct.
//
// Deliberately one thing: search, sort, and the register. No stat cards, no
// side panels, no dashboard widgets. Depth lives behind the operative, on
// their record — the register only has to be scannable.

const PAGE_WIDTH = 1180;

type SortKey = "name" | "joined" | "service" | "games" | "hours" | "noshows" | "marks";

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
  "grid grid-cols-[2.1rem_minmax(180px,1.6fr)_6.5rem_minmax(150px,1.25fr)_4rem_4rem_4.5rem_4.5rem_5.5rem_7rem] items-center gap-3";

type Line = {
  profile: Profile;
  service: Service;
  squads: { name: string; captain: boolean }[];
  captaincies: number;
  warnings: number;
  strikes: number;
  /** Actually in a room that's open right now. Never inferred. */
  deployed: boolean;
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
  searchParams: Promise<{ sort?: string; q?: string; as?: string }>;
}) {
  const me = await requireProfile();
  const sp = await searchParams;
  const key: SortKey = (SORTS.find((s) => s.key === sp.sort)?.key ?? "name") as SortKey;
  const query = (sp.q ?? "").trim().toLowerCase();
  const isPresident = resolveViewRole(sp.as, await realRoleOf(me)) === "president";

  const supabase = await createClient();
  const [roster, squads, { data: warnRows }, { data: strikeRows }, { data: compRows }, { data: rsvpRows }] =
    await Promise.all([
      getServiceRoster(),
      getSquads(me.id),
      supabase.from("warnings").select("player_id"),
      supabase.from("strikes").select("player_id"),
      // Rooms that are actually open — started and not yet closed.
      supabase.from("competitions").select("id, started_at, finished_at, status"),
      supabase.from("rsvps").select("competition_id, player_id, status"),
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

  // ── Who is actually deployed ─────────────────────────────────────────────
  // The only presence state we can state as fact: a room somebody opened is
  // still open, and this operative said they were in it. ONLINE/OFFLINE would
  // need a Realtime presence channel, which doesn't exist — so it isn't shown
  // rather than guessed at. Everyone else gets their last sign of life, which
  // is real: when they last opened their inbox.
  const openRooms = new Set(
    ((compRows ?? []) as Pick<Competition, "id" | "started_at" | "finished_at" | "status">[])
      .filter((c) => c.started_at != null && c.finished_at == null && c.status !== "cancelled")
      .map((c) => c.id),
  );
  const deployedIds = new Set(
    ((rsvpRows ?? []) as Pick<Rsvp, "competition_id" | "player_id" | "status">[])
      .filter((r) => r.status === "in" && openRooms.has(r.competition_id))
      .map((r) => r.player_id),
  );

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
      deployed: deployedIds.has(r.profile.id),
    };
  });

  const found = query
    ? lines.filter((l) =>
        `${l.profile.name} ${l.profile.nickname ?? ""} ${l.squads.map((s) => s.name).join(" ")}`
          .toLowerCase()
          .includes(query),
      )
    : lines;

  const byName = (a: Line, b: Line) => a.profile.name.localeCompare(b.profile.name);
  const sorted = [...found].sort((a, b) => {
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
        return b.strikes * 3 + b.warnings - (a.strikes * 3 + a.warnings) || byName(a, b);
      case "joined":
        return a.profile.created_at < b.profile.created_at ? -1 : 1;
      default:
        return byName(a, b);
    }
  });

  const squadCount = squads.length;
  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const base: Record<string, string | undefined> = { as: sp.as, q: sp.q, sort: sp.sort };
    for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/hq/personnel?${s}` : "/hq/personnel";
  };

  /** A sortable numeric column heading. */
  const Head = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <Link
      href={href({ sort: k === "name" ? null : k })}
      scroll={false}
      className="hq-label text-right transition-colors hover:text-ink"
      style={key === k ? { color: "var(--color-sand)" } : undefined}
    >
      {children}
      {key === k && <span className="ml-1">▾</span>}
    </Link>
  );

  return (
    <div className="mx-auto w-full" style={{ maxWidth: PAGE_WIDTH }}>
      <PageHead
        eyebrow="Barracks"
        title="Personnel register"
        right={isPresident ? <EnlistLink /> : undefined}
      >
        {lines.length} on strength · {squadCount} squad{squadCount === 1 ? "" : "s"}
      </PageHead>

      {/* ── Search and sort ──────────────────────────────────────────────
          Two controls, not a row of seven buttons. The columns are sortable
          too, for anyone who'd rather click the number they're looking at. */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form action="/hq/personnel" className="flex min-w-0 flex-1 items-center gap-2">
          {sp.as && <input type="hidden" name="as" value={sp.as} />}
          {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search personnel…"
            className="hq-mono w-full max-w-[320px] rounded-[3px] border px-3 py-2 text-[12px] uppercase tracking-[0.1em] outline-none transition-colors focus:border-sand"
            style={{ borderColor: "color-mix(in srgb, var(--color-sand) 45%, transparent)" }}
          />
          {query && (
            <Link href={href({ q: null })} className="hq-label hover:text-ink">
              Clear ✕
            </Link>
          )}
        </form>

        <span className="flex shrink-0 items-center gap-2">
          <span className="hq-label">Sort</span>
          {/* FilterSelect clears the param on "all", which is exactly what the
              default sort wants — by name, with no query string. */}
          <FilterSelect
            param="sort"
            allLabel="Name"
            value={key === "name" ? "all" : key}
            options={SORTS.filter((s) => s.key !== "name").map((s) => ({
              value: s.key,
              label: s.label,
            }))}
            width={150}
          />
        </span>
      </div>

      {/* ── The register ─────────────────────────────────────────────────
          Ends where its contents end. Two operatives should look like two
          operatives, not two rows adrift in a full-height container. */}
      <section className="hq-panel hq-rise">
        <header className="hq-panel-head">
          <h2 className="hq-label truncate">
            Service register — {sorted.length} record{sorted.length === 1 ? "" : "s"}
            {query && <span className="text-ink-soft"> of {lines.length}</span>}
          </h2>
        </header>

        {sorted.length === 0 ? (
          <Nil>{query ? "No operative matches that" : "Nobody on strength"}</Nil>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 940 }}>
              <div
                className={`${COLS} border-b border-rule px-4 py-2`}
                style={{ background: "rgba(255,255,255,0.022)" }}
              >
                <span className="hq-label">#</span>
                <Link
                  href={href({ sort: null })}
                  scroll={false}
                  className="hq-label transition-colors hover:text-ink"
                  style={key === "name" ? { color: "var(--color-sand)" } : undefined}
                >
                  Operative{key === "name" && <span className="ml-1">▾</span>}
                </Link>
                <span className="hq-label">Callsign</span>
                <span className="hq-label">Assignment</span>
                <Head k="service">Ops</Head>
                <Head k="games">Gms</Head>
                <Head k="hours">Hrs</Head>
                <Head k="noshows">N/S</Head>
                <Head k="marks">Conduct</Head>
                <span className="hq-label text-right">Status</span>
              </div>

              {sorted.map((l, i) => {
                const rank = rankOf(l);
                const clean = l.strikes === 0 && l.warnings === 0;
                const seen = l.profile.inbox_seen_at;
                return (
                  <Link
                    key={l.profile.id}
                    href={`/hq/personnel/${l.profile.id}`}
                    className={`${COLS} border-b border-rule/60 px-4 py-2.5 transition-colors last:border-0 hover:bg-[rgba(255,255,255,0.03)]`}
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
                        <span className="block truncate text-[13px]">
                          {l.profile.name}
                          {l.profile.id === me.id && (
                            <span className="hq-mono ml-1.5 text-[10px] text-ink-soft">(you)</span>
                          )}
                        </span>
                        <span
                          className="hq-mono block text-[10px] uppercase tracking-[0.12em]"
                          style={{
                            color:
                              rank.tone === "warn"
                                ? "var(--color-sand)"
                                : rank.tone === "live"
                                  ? "var(--color-moss)"
                                  : "var(--color-ink-soft)",
                          }}
                        >
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

                    <span className="hq-mono text-right text-[13px]">{l.service.operations}</span>
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

                    {/* Deployed is a fact. Anything else is the last thing we
                        genuinely know about them, not a presence guess. */}
                    <span className="flex items-center justify-end gap-1.5">
                      {l.deployed ? (
                        <>
                          <Dot tone="live" pulse />
                          <span
                            className="hq-mono text-[10px] uppercase tracking-[0.1em]"
                            style={{ color: "var(--color-moss)" }}
                          >
                            Deployed
                          </span>
                        </>
                      ) : (
                        <span
                          className="hq-mono truncate text-[10px] uppercase tracking-[0.1em] text-ink-soft"
                          title={seen ? "Last opened their inbox" : "Never opened their inbox"}
                        >
                          {seen ? relativeTime(seen) : "—"}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <p className="hq-mono border-t border-rule px-4 py-2.5 text-[10px] uppercase leading-relaxed tracking-[0.12em] text-ink-soft">
          Register of service — participation, assignment and conduct. The Barracks does not rank
          its people by skill; there is no ladder here and never will be.
        </p>
      </section>
    </div>
  );
}
