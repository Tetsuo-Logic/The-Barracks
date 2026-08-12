import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { gameById, compHeading } from "@/lib/games";
import { shortDate, shortTime, heroDate } from "@/lib/dates";
import { Panel, Stat, Dot, Tag, Row, PageHead, Nil } from "@/components/hq/Kit";
import type {
  Competition,
  Complaint,
  Photo,
  Profile,
  Rsvp,
  Squad,
  Trial,
} from "@/lib/types";

export const metadata = { title: "Archives · Barracks HQ" };

// ── Archives ────────────────────────────────────────────────────────────────
// The permanent record. Every completed Operation, its roster, its duration, its
// evidence — plus the Court's closed cases. All real rows; the filter rail is
// URL state so an archive view can be linked to and kept.

type SP = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function hoursOf(c: Competition): number {
  if (!c.started_at || !c.finished_at) return 0;
  return Math.max(0, (new Date(c.finished_at).getTime() - new Date(c.started_at).getTime()) / 3_600_000);
}

export default async function ArchivesPage({ searchParams }: { searchParams: SP }) {
  await requireProfile();
  const sp = await searchParams;
  const fYear = one(sp.year);
  const fGame = one(sp.game);
  const fSquad = one(sp.squad);

  const supabase = await createClient();
  const [
    { data: compRows },
    { data: rsvpRows },
    { data: profileRows },
    { data: squadRows },
    { data: trialRows },
    { data: complaintRows },
    { data: commentRows },
  ] = await Promise.all([
    supabase.from("competitions").select("*").in("status", ["played", "cancelled"]),
    supabase.from("rsvps").select("*"),
    supabase.from("profiles").select("*"),
    supabase.from("squads").select("*"),
    supabase.from("trials").select("*").eq("status", "closed").order("created_at", { ascending: false }),
    supabase.from("complaints").select("*").eq("status", "addressed").order("created_at", { ascending: false }),
    supabase.from("comments").select("id, competition_id"),
  ]);

  const allComps = ((compRows ?? []) as Competition[]).sort((a, b) => (a.date < b.date ? 1 : -1));
  const rsvps = (rsvpRows ?? []) as Rsvp[];
  const profiles = (profileRows ?? []) as Profile[];
  const squads = (squadRows ?? []) as Squad[];
  const trials = (trialRows ?? []) as Trial[];
  const complaints = (complaintRows ?? []) as Complaint[];
  const comments = (commentRows ?? []) as { id: string; competition_id: string }[];

  const nameById = new Map(profiles.map((p) => [p.id, p.name]));
  const squadById = new Map(squads.map((s) => [s.id, s]));

  // ── Filter facets, counted off the full archive ───────────────────────────
  const years = [...new Set(allComps.map((c) => c.date.slice(0, 4)))].sort().reverse();
  const gameFacets = [...new Set(allComps.map((c) => c.game))]
    .map((g) => ({ id: g, game: gameById(g), n: allComps.filter((c) => c.game === g).length }))
    .sort((a, b) => b.n - a.n);
  const squadFacets = squads
    .map((s) => ({
      squad: s,
      label: s.name || gameById(s.game).name,
      n: allComps.filter((c) => c.squad_id === s.id).length,
    }))
    .filter((s) => s.n > 0)
    .sort((a, b) => b.n - a.n);

  const comps = allComps.filter(
    (c) =>
      (!fYear || c.date.slice(0, 4) === fYear) &&
      (!fGame || c.game === fGame) &&
      (!fSquad || c.squad_id === fSquad),
  );

  // ── Evidence, signed in one batch for the filtered view ───────────────────
  const compIds = comps.slice(0, 40).map((c) => c.id);
  let photos: (Photo & { url: string })[] = [];
  if (compIds.length > 0) {
    const { data: photoRows } = await supabase
      .from("photos")
      .select("*")
      .in("competition_id", compIds)
      .order("created_at", { ascending: false })
      .limit(80);
    const rows = (photoRows ?? []) as Photo[];
    if (rows.length > 0) {
      const { data: signed } = await supabase.storage
        .from("photos")
        .createSignedUrls(rows.map((p) => p.storage_path), 60 * 60);
      photos = rows.map((p, i) => ({ ...p, url: signed?.[i]?.signedUrl ?? "" }));
    }
  }
  const photosByComp = new Map<string, (Photo & { url: string })[]>();
  for (const p of photos) {
    const arr = photosByComp.get(p.competition_id) ?? [];
    arr.push(p);
    photosByComp.set(p.competition_id, arr);
  }
  const commentCount = new Map<string, number>();
  for (const c of comments)
    commentCount.set(c.competition_id, (commentCount.get(c.competition_id) ?? 0) + 1);

  const rsvpsByComp = new Map<string, Rsvp[]>();
  for (const r of rsvps) {
    const arr = rsvpsByComp.get(r.competition_id) ?? [];
    arr.push(r);
    rsvpsByComp.set(r.competition_id, arr);
  }

  const played = comps.filter((c) => c.status === "played");
  const totalHours = played.reduce((n, c) => n + hoursOf(c), 0);
  const totalGames = played.reduce((n, c) => n + (c.games_count ?? 0), 0);
  const span =
    comps.length > 0
      ? `${shortDate(comps[comps.length - 1].date)} — ${shortDate(comps[0].date)}`
      : "—";

  const qs = (patch: Record<string, string>) => {
    const next = new URLSearchParams();
    const merged = { year: fYear, game: fGame, squad: fSquad, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/hq/archives?${s}` : "/hq/archives";
  };

  const FilterLink = ({
    href,
    active,
    label,
    n,
  }: {
    href: string;
    active: boolean;
    label: string;
    n?: number;
  }) => (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 rounded-[3px] px-2 py-1.5 transition-colors hover:bg-[rgba(255,255,255,0.03)]"
      style={{
        backgroundColor: active ? "rgba(245,182,61,0.09)" : undefined,
        color: active ? "var(--color-ink)" : undefined,
      }}
    >
      <span className="hq-mono min-w-0 truncate text-[12px]">{label}</span>
      {n != null && <span className="hq-mono shrink-0 text-[10px] text-ink-soft">{n}</span>}
    </Link>
  );

  return (
    <div>
      <PageHead
        eyebrow="Intelligence"
        title="Archives"
        right={
          <>
            <span className="hq-label rounded-[3px] border border-rule px-3 py-2">
              {comps.length} records
            </span>
            {(fYear || fGame || fSquad) && (
              <Link
                href="/hq/archives"
                className="hq-label rounded-[3px] border px-3 py-2"
                style={{ borderColor: "var(--color-flag)", color: "var(--color-flag)" }}
              >
                Clear filters
              </Link>
            )}
          </>
        }
      >
        The permanent record of The Barracks — {span}. Nothing here is ever deleted; an Operation
        that ran, ran.
      </PageHead>

      <div className="grid gap-4 xl:grid-cols-[210px_1fr]">
        {/* ── Filter rail ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-[72px] xl:self-start">
          <Panel i={0} label="Year">
            <div className="flex flex-col gap-0.5">
              <FilterLink href={qs({ year: "" })} active={!fYear} label="All years" n={allComps.length} />
              {years.map((y) => (
                <FilterLink
                  key={y}
                  href={qs({ year: y })}
                  active={fYear === y}
                  label={y}
                  n={allComps.filter((c) => c.date.slice(0, 4) === y).length}
                />
              ))}
            </div>
          </Panel>

          <Panel i={1} label="Game">
            <div className="flex flex-col gap-0.5">
              <FilterLink href={qs({ game: "" })} active={!fGame} label="All games" />
              {gameFacets.map((g) => (
                <FilterLink
                  key={g.id}
                  href={qs({ game: g.id })}
                  active={fGame === g.id}
                  label={`${g.game.emoji} ${g.game.name}`}
                  n={g.n}
                />
              ))}
            </div>
          </Panel>

          <Panel i={2} label="Squad">
            <div className="flex flex-col gap-0.5">
              <FilterLink href={qs({ squad: "" })} active={!fSquad} label="All squads" />
              {squadFacets.length === 0 ? (
                <span className="hq-mono px-2 py-1.5 text-[11px] text-ink-soft">
                  No squad operations
                </span>
              ) : (
                squadFacets.map((s) => (
                  <FilterLink
                    key={s.squad.id}
                    href={qs({ squad: s.squad.id })}
                    active={fSquad === s.squad.id}
                    label={s.label}
                    n={s.n}
                  />
                ))
              )}
            </div>
          </Panel>

          <Panel i={3} label="This view">
            <Row k="Operations" v={played.length} />
            <Row k="Hours" v={Math.round(totalHours)} tone="warn" />
            <Row k="Games" v={totalGames} />
            <Row k="Evidence" v={photos.length} />
            <Row
              k="Scrubbed"
              v={comps.filter((c) => c.status === "cancelled").length}
              tone="alert"
            />
          </Panel>
        </div>

        {/* ── The record ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Panel i={4}>
              <Stat value={played.length} label="Operations archived" />
            </Panel>
            <Panel i={5}>
              <Stat value={Math.round(totalHours)} label="Hours on record" tone="warn" />
            </Panel>
            <Panel i={6}>
              <Stat value={trials.length} label="Cases closed" tone={trials.length ? "alert" : undefined} />
            </Panel>
            <Panel i={7}>
              <Stat value={years.length} label="Years of service" sub={years.join(" · ") || "—"} />
            </Panel>
          </div>

          <Panel
            i={8}
            sweep
            label="Operation archive"
            status={<Dot tone="live" />}
            right={
              <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                Expand a record for the roster
              </span>
            }
          >
            {comps.length === 0 ? (
              <Nil>No records match this filter</Nil>
            ) : (
              <div className="flex flex-col">
                {comps.map((c, i) => {
                  const g = gameById(c.game);
                  const hd = heroDate(c.date);
                  const list = rsvpsByComp.get(c.id) ?? [];
                  const present = list.filter((r) => r.attended === true);
                  const absent = list.filter((r) => r.attended === false);
                  const declined = list.filter((r) => r.status === "out");
                  const pics = photosByComp.get(c.id) ?? [];
                  const sq = c.squad_id ? squadById.get(c.squad_id) : null;
                  const h = hoursOf(c);
                  const scrubbed = c.status === "cancelled";

                  return (
                    <details
                      key={c.id}
                      className="hq-rise group border-b border-rule/60 last:border-0"
                      style={{ ["--i" as string]: Math.min(i, 12) }}
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-4 py-2.5 transition-colors hover:bg-[rgba(255,255,255,0.025)]">
                        <span className="hq-mono w-16 shrink-0 text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                          {hd.day} {hd.mon} {c.date.slice(2, 4)}
                        </span>
                        <span className="w-6 shrink-0 text-center">{g.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-ink">
                            {compHeading(c)}
                          </span>
                          <span className="hq-mono block truncate text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                            {g.name}
                            {c.tee_time ? ` · ${shortTime(c.tee_time)}` : ""}
                            {sq ? ` · ${sq.name || gameById(sq.game).name} squad` : ""}
                            {c.stake ? ` · ${c.stake}` : ""}
                          </span>
                        </span>
                        <span className="hq-mono hidden w-16 shrink-0 text-right text-[12px] md:block">
                          {present.length}
                          <span className="text-ink-soft"> present</span>
                        </span>
                        <span className="hq-mono hidden w-14 shrink-0 text-right text-[12px] text-ink-soft lg:block">
                          {c.games_count ? `${c.games_count} gm` : "—"}
                        </span>
                        <span
                          className="hq-mono hidden w-14 shrink-0 text-right text-[12px] lg:block"
                          style={{ color: h ? "var(--color-sand)" : "var(--color-ink-soft)" }}
                        >
                          {h ? `${h.toFixed(1)}h` : "—"}
                        </span>
                        {scrubbed ? (
                          <Tag tone="alert">Scrubbed</Tag>
                        ) : c.for_cup ? (
                          <Tag tone="warn">Cup</Tag>
                        ) : (
                          <Tag tone="idle">Filed</Tag>
                        )}
                        <span className="hq-mono w-4 shrink-0 text-center text-[10px] text-ink-soft transition-transform group-open:rotate-90">
                          ▸
                        </span>
                      </summary>

                      <div className="grid gap-5 border-t border-rule/50 bg-[rgba(255,255,255,0.012)] px-4 py-4 lg:grid-cols-[1fr_1fr_1.1fr]">
                        <div>
                          <p className="hq-label mb-2">Roster</p>
                          {list.length === 0 ? (
                            <p className="hq-mono text-[11px] text-ink-soft">No roll call recorded</p>
                          ) : (
                            <ul className="flex flex-col gap-1">
                              {present.map((r) => (
                                <li key={`p-${r.player_id}`} className="flex items-center gap-2">
                                  <Dot tone="live" />
                                  <span className="text-[12px]">{nameById.get(r.player_id) ?? "Unknown"}</span>
                                </li>
                              ))}
                              {absent.map((r) => (
                                <li key={`a-${r.player_id}`} className="flex items-center gap-2">
                                  <Dot tone="alert" />
                                  <span className="text-[12px] text-ink-soft">
                                    {nameById.get(r.player_id) ?? "Unknown"} · no-show
                                  </span>
                                </li>
                              ))}
                              {declined
                                .filter((r) => r.attended === null)
                                .map((r) => (
                                  <li key={`o-${r.player_id}`} className="flex items-center gap-2">
                                    <Dot tone="idle" />
                                    <span className="text-[12px] text-ink-soft">
                                      {nameById.get(r.player_id) ?? "Unknown"} · out
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          )}
                        </div>

                        <div>
                          <p className="hq-label mb-2">Log</p>
                          <Row k="Status" v={scrubbed ? "Cancelled" : "Completed"} tone={scrubbed ? "alert" : "live"} />
                          <Row k="Duration" v={h ? `${h.toFixed(1)} hours` : "Not logged"} />
                          <Row k="Games" v={c.games_count ?? 0} />
                          <Row k="Format" v={c.format.toUpperCase()} />
                          <Row k="Comms" v={commentCount.get(c.id) ?? 0} />
                          {c.started_at && (
                            <Row
                              k="Room opened"
                              v={new Date(c.started_at).toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            />
                          )}
                          {scrubbed && c.cancel_reason && (
                            <p className="mt-2 border-l pl-3 text-[12px] text-ink-soft" style={{ borderColor: "var(--color-flag)" }}>
                              {c.cancel_reason}
                            </p>
                          )}
                          {c.notes && (
                            <p className="mt-2 border-l border-rule pl-3 text-[12px] text-ink-soft">
                              {c.notes}
                            </p>
                          )}
                        </div>

                        <div>
                          <p className="hq-label mb-2">Evidence</p>
                          {pics.length === 0 ? (
                            <p className="hq-mono text-[11px] text-ink-soft">No photographs filed</p>
                          ) : (
                            <div className="grid grid-cols-4 gap-1.5">
                              {pics.slice(0, 8).map((p) => (
                                <a
                                  key={p.id}
                                  href={p.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block aspect-square overflow-hidden rounded-[2px] border border-rule"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={p.url}
                                    alt={p.caption ?? "Operation evidence"}
                                    className="h-full w-full object-cover opacity-90 transition-opacity hover:opacity-100"
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                          <Link
                            href={`/hq/operations/${c.id}`}
                            className="hq-label mt-3 inline-block rounded-[3px] border border-rule px-3 py-1.5 transition-colors hover:border-sand hover:text-ink"
                          >
                            Open record →
                          </Link>
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* ── Court archive ────────────────────────────────────────── */}
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              i={9}
              label="Court archive · closed trials"
              status={<Dot tone={trials.length ? "alert" : "idle"} />}
              right={<Link href="/hq/court" className="hq-label hover:text-ink">Court →</Link>}
            >
              {trials.length === 0 ? (
                <Nil>No cases have reached a verdict</Nil>
              ) : (
                <ul className="flex flex-col">
                  {trials.map((t) => (
                    <li key={t.id} className="border-b border-rule/60 py-2.5 last:border-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px]">
                            <span className="text-ink">{nameById.get(t.defendant_id) ?? "Unknown"}</span>
                            <span className="text-ink-soft"> — {t.charge}</span>
                          </p>
                          <p className="hq-mono mt-0.5 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                            {shortDate(t.created_at.slice(0, 10))}
                            {t.jury_opened ? " · jury convened" : " · ruled from the chair"}
                            {t.judge_id ? " · stand-in judge" : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {t.penalty && <Tag tone="warn">{t.penalty}</Tag>}
                          <Tag tone={t.verdict === "guilty" ? "alert" : "live"} solid={t.verdict === "guilty"}>
                            {t.verdict === "guilty" ? "Guilty" : "Not guilty"}
                          </Tag>
                        </div>
                      </div>
                      {t.note && (
                        <p className="mt-1.5 border-l border-rule pl-3 text-[12px] text-ink-soft">
                          {t.note}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel i={10} label="Court archive · addressed complaints">
              {complaints.length === 0 ? (
                <Nil>No complaints on the record</Nil>
              ) : (
                <ul className="flex flex-col">
                  {complaints.map((cx) => (
                    <li key={cx.id} className="border-b border-rule/60 py-2.5 last:border-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px]">
                            <span className="text-ink-soft">
                              {(cx.filed_by && nameById.get(cx.filed_by)) || "Someone"} v.{" "}
                            </span>
                            <span className="text-ink">
                              {(cx.against_id && nameById.get(cx.against_id)) || "the Barracks"}
                            </span>
                          </p>
                          <p className="hq-mono mt-0.5 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                            {cx.reason}
                            {cx.addressed_at ? ` · settled ${shortDate(cx.addressed_at.slice(0, 10))}` : ""}
                          </p>
                        </div>
                        <Tag tone="idle">Addressed</Tag>
                      </div>
                      {cx.ruling && (
                        <p className="mt-1.5 border-l pl-3 text-[12px] text-ink-soft" style={{ borderColor: "var(--color-sand)" }}>
                          {cx.ruling}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
