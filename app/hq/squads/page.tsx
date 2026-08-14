import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { resolveViewRole, realRoleOf } from "@/lib/hq/role";
import { createClient } from "@/lib/supabase/server";
import { getSquads, getSquadRequests } from "@/lib/data/queries";
import { gameById, GAMES } from "@/lib/games";
import { todayISO, shortDate, shortTime, relativeTime } from "@/lib/dates";
import { Panel, Dot, Tag, PageHead, Nil } from "@/components/hq/Kit";
import { RequestNight } from "@/components/hq/squad/RequestNight";
import { JoinSquad } from "@/components/hq/squad/JoinSquad";
import { RequestSquad } from "@/components/hq/squad/RequestSquad";
import { PANEL_LABEL, panelKind } from "@/components/hq/squad/GamePanel";
import type { Competition } from "@/lib/types";

export const metadata = { title: "Squads · Barracks HQ" };

// Squads overview — every fighting unit in the Barracks on one board. Squads,
// members, captains, musters, night nudges and operations are all real; the
// battle record is the one prototype and is marked as such.
export default async function SquadsPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; q?: string; view?: string }>;
}) {
  const [profile, sp] = await Promise.all([requireProfile(), searchParams]);
  // Forming a squad is a Barracks act, not a squad act: RLS only lets a group
  // admin insert into `squads`, so captaincy of one squad grants nothing here.
  // Everyone else asks the President instead.
  const isPresident = resolveViewRole(sp.as, await realRoleOf(profile)) === "president";

  const supabase = await createClient();

  const [squads, requests, { data: compRows }, { data: profileRows }] = await Promise.all([
    getSquads(profile.id),
    profile.is_admin ? getSquadRequests() : Promise.resolve([]),
    supabase.from("competitions").select("*").order("date", { ascending: true }),
    supabase.from("profiles").select("id, name").order("name"),
  ]);

  // For the request form: who could captain it, and what could it play.
  const people = ((profileRows ?? []) as { id: string; name: string }[]).map((p) => ({
    id: p.id,
    name: p.name,
  }));
  const gameOptions = GAMES.map((g) => ({ id: g.id, name: g.name }));

  // Cards by default — a squad is an object, and objects read better as cards.
  // The list is for when there are enough of them that scanning beats browsing.
  const asList = sp.view === "list";
  const query = (sp.q ?? "").trim().toLowerCase();
  const shown = query
    ? squads.filter((s) => {
        const g = gameById(s.squad.game);
        const cap = s.members.find((m) => m.is_captain)?.profile.name ?? "";
        return `${s.squad.name ?? ""} ${g.name} ${s.squad.clan_tag ?? ""} ${cap}`
          .toLowerCase()
          .includes(query);
      })
    : squads;
  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const base: Record<string, string | undefined> = { as: sp.as, q: sp.q, view: sp.view };
    for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) q.set(k, v);
    const qs = q.toString();
    return qs ? `/hq/squads?${qs}` : "/hq/squads";
  };

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
  const mine = squads.filter((s) => s.mine).length;

  return (
    <div>
      <PageHead
        eyebrow="Barracks"
        title="Squads"
        right={
          /* No page-level "call a muster": a muster belongs to one squad and
             is called from inside it. Forming a squad genuinely is a Barracks
             action — and only the President's. */
          isPresident ? (
            <Link
              href="/squads"
              className="hq-label rounded-[3px] px-3 py-2 font-semibold"
              style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
            >
              + Form squad
            </Link>
          ) : (
            <RequestSquad games={gameOptions} people={people} meId={profile.id} />
          )
        }
      >
        {squads.length} squad{squads.length === 1 ? "" : "s"} on strength ·{" "}
        <span className="text-ink">{assigned.size}</span> operatives assigned
        {mine > 0 && <> · you serve in {mine}</>}
      </PageHead>

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
                    {r.proposedCaptain && (
                      <span className="hq-mono shrink-0 text-[11px]" style={{ color: "var(--color-sand)" }}>
                        Captain: {r.proposedCaptain.name}
                      </span>
                    )}
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

      {/* ── Filter and view ──────────────────────────────────────────────
          Two controls, sitting where the eye already is after the count. */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form action="/hq/squads" className="flex min-w-0 flex-1 items-center gap-2">
          {sp.as && <input type="hidden" name="as" value={sp.as} />}
          {sp.view && <input type="hidden" name="view" value={sp.view} />}
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Filter squads…"
            className="hq-mono w-full max-w-[300px] rounded-[3px] border px-3 py-2 text-[12px] uppercase tracking-[0.1em] outline-none transition-colors focus:border-sand"
            style={{ borderColor: "var(--color-rule)" }}
          />
          {query && (
            <Link href={href({ q: null })} className="hq-label hover:text-ink">
              Clear ✕
            </Link>
          )}
        </form>

        <span className="flex shrink-0 items-center gap-1.5">
          {([["cards", null], ["list", "list"]] as [string, string | null][]).map(([label, v]) => {
            const on = (v === "list") === asList;
            return (
              <Link
                key={label}
                href={href({ view: v })}
                scroll={false}
                className="hq-mono rounded-[3px] border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                style={{
                  borderColor: on ? "var(--color-sand)" : "var(--color-rule)",
                  backgroundColor: on ? "rgba(245,182,61,0.12)" : "transparent",
                  color: on ? "var(--color-sand)" : "var(--color-ink-soft)",
                }}
              >
                {label}
              </Link>
            );
          })}
        </span>
      </div>

      {/* ── The board ────────────────────────────────────────────────────── */}
      {shown.length === 0 ? (
        <Panel i={6}>
          <Nil>{query ? "No squad matches that" : "No squads formed — the Barracks fights as one"}</Nil>
        </Panel>
      ) : asList ? (
        <section className="hq-panel hq-rise">
          <header className="hq-panel-head">
            <h2 className="hq-label">
              {shown.length} squad{shown.length === 1 ? "" : "s"}
            </h2>
          </header>
          <div className="flex flex-col">
            {shown.map((s) => {
              const g = gameById(s.squad.game);
              const captain = s.members.find((m) => m.is_captain)?.profile ?? null;
              const mu = s.muster?.muster ?? null;
              return (
                <div
                  key={s.squad.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule/60 px-4 py-3 last:border-0"
                >
                  <span className="w-6 shrink-0 text-center">{g.emoji}</span>
                  <span className="hq-readout min-w-0 flex-1 truncate text-[16px] font-bold uppercase tracking-[0.02em]">
                    {s.squad.name || `${g.name} Squad`}
                  </span>
                  {s.mine && <Tag tone="live">Yours</Tag>}
                  <span className="hq-mono w-[150px] shrink-0 truncate text-[12px] text-ink-soft">
                    {captain ? `CPT ${captain.name}` : "No captain"}
                  </span>
                  <span className="hq-mono w-[70px] shrink-0 text-[12px] text-ink-soft">
                    {s.members.length} op{s.members.length === 1 ? "" : "s"}
                  </span>
                  <span className="hq-mono w-[110px] shrink-0 text-[11px] uppercase tracking-[0.08em]" style={{ color: mu ? "var(--color-sand)" : undefined }}>
                    {mu ? (mu.status === "proposed" ? "Night proposed" : "Muster open") : "—"}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {s.mine ? (
                      <RequestNight
                        squadId={s.squad.id}
                        squadName={s.squad.name || `${g.name} Squad`}
                        gameName={g.name}
                        captainName={captain?.name ?? null}
                        squadHref={`/hq/squads/${s.squad.id}`}
                        variant="inline"
                      />
                    ) : (
                      <JoinSquad
                        squadId={s.squad.id}
                        squadName={s.squad.name || `${g.name} Squad`}
                        variant="inline"
                      />
                    )}
                    <Link href={`/hq/squads/${s.squad.id}`} className="hq-label hover:text-ink">
                      Open →
                    </Link>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {shown.map((s, i) => {
            const g = gameById(s.squad.game);
            const all = bySquad.get(s.squad.id) ?? [];
            const upcoming = all.filter((c) => c.status === "upcoming" && c.date >= today);
            const captain = s.members.find((m) => m.is_captain)?.profile ?? null;
            const mu = s.muster?.muster ?? null;
            const answered = s.muster?.responses.length ?? 0;

            const musterTone = mu ? (mu.status === "proposed" ? "alert" : "warn") : "idle";
            const musterText = !mu
              ? "No muster running"
              : mu.status === "proposed"
                ? `Night proposed · ${mu.chosen_date ? shortDate(mu.chosen_date) : "TBC"}`
                : `Muster open · ${answered}/${s.members.length} answered`;

            return (
              /* Not a link wrapper any more: the card now carries its own
                 buttons, and a button inside an anchor is a broken target. */
              <Panel key={s.squad.id} i={7 + i} className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      {s.squad.clan_tag && (
                        <span
                          className="hq-mono shrink-0 text-[12px] font-bold tracking-[0.1em]"
                          style={{ color: "var(--color-sand)" }}
                        >
                          [{s.squad.clan_tag}]
                        </span>
                      )}
                      <h2 className="hq-readout truncate text-[19px] font-bold uppercase leading-none">
                        {s.squad.name || `${g.name} Squad`}
                      </h2>
                    </div>
                    <p className="hq-mono mt-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                      {g.name} · {PANEL_LABEL[panelKind(s.squad.game)]}
                    </p>
                  </div>
                  {s.mine && <Tag tone="live">Yours</Tag>}
                </div>

                {/* Who runs it and how many there are — the two facts you want
                    before deciding whether to ask them for a game. */}
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
                  <span className="hq-mono text-[12px]">
                    <span className="hq-label">Captain </span>
                    <span style={{ color: captain ? "var(--color-sand)" : "var(--color-ink-soft)" }}>
                      {captain ? captain.name : "Vacant"}
                    </span>
                  </span>
                  <span className="hq-mono text-[12px] text-ink-soft">
                    {s.members.length} operative{s.members.length === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Only when there's something to say. A card that always shows
                    every row is a dashboard again. */}
                {(mu || upcoming[0] || s.nightRequests.length > 0) && (
                  <div className="mt-3 flex flex-col gap-1.5 border-t border-rule/60 pt-3">
                    {mu && (
                      <span className="flex items-center gap-2">
                        <Dot tone={musterTone} pulse={mu.status === "proposed"} />
                        <span className="hq-mono truncate text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--color-sand)" }}>
                          {musterText}
                        </span>
                      </span>
                    )}
                    {upcoming[0] && (
                      <span className="flex items-center gap-2">
                        <Dot tone="live" />
                        <span className="hq-mono truncate text-[11px] uppercase tracking-[0.08em]">
                          Next operation · {shortDate(upcoming[0].date)}
                          {shortTime(upcoming[0].tee_time) ? ` · ${shortTime(upcoming[0].tee_time)}` : ""}
                        </span>
                      </span>
                    )}
                    {s.nightRequests.length > 0 && (
                      <span className="flex items-center gap-2">
                        <Dot tone="alert" />
                        <span className="hq-mono truncate text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--color-flag)" }}>
                          {s.nightRequests.length} night
                          {s.nightRequests.length === 1 ? "" : "s"} wanted
                        </span>
                      </span>
                    )}
                  </div>
                )}

                {/* The actions. Request a night is the member's whole reason
                    for being here, so it leads and everything else is a link. */}
                <div className="mt-auto flex flex-col gap-2 pt-4">
                  {s.mine ? (
                    <RequestNight
                      squadId={s.squad.id}
                      squadName={s.squad.name || `${g.name} Squad`}
                      gameName={g.name}
                      captainName={captain?.name ?? null}
                      squadHref={`/hq/squads/${s.squad.id}`}
                    />
                  ) : (
                    <JoinSquad
                      squadId={s.squad.id}
                      squadName={s.squad.name || `${g.name} Squad`}
                    />
                  )}
                  <Link
                    href={`/hq/squads/${s.squad.id}`}
                    className="hq-label rounded-[3px] border border-rule px-3 py-2.5 text-center transition-colors hover:border-ink-soft hover:text-ink"
                  >
                    Open squad →
                  </Link>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
