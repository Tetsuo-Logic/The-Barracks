import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Panel, PageHead, Tag, Dot, Nil, Proto, Stat } from "@/components/hq/Kit";
import { MEDALS } from "@/lib/hq/future/systems";
import { computeService } from "@/lib/service";
import { compHeading } from "@/lib/games";
import { relativeTime } from "@/lib/dates";
import type { Profile, Competition, Rsvp, Trial, Strike, Warning } from "@/lib/types";

export const metadata = { title: "Honours · Barracks HQ" };

// Commendations, Hall of Fame and Hall of Shame. Medals are an adapter (there's
// no commendations table yet); the halls are computed from REAL service data —
// which is the point: the group's history, not a points system.
export default async function HonoursPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: profiles }, { data: comps }, { data: rsvps }, { data: trials }, { data: strikes }, { data: warnings }] =
    await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("competitions").select("*"),
      supabase.from("rsvps").select("*"),
      supabase.from("trials").select("*").order("created_at", { ascending: false }),
      supabase.from("strikes").select("*"),
      supabase.from("warnings").select("*"),
    ]);

  const roster = (profiles ?? []) as Profile[];
  const allComps = (comps ?? []) as Competition[];
  const allRsvps = (rsvps ?? []) as Rsvp[];
  const allTrials = (trials ?? []) as Trial[];
  const allStrikes = (strikes ?? []) as Strike[];
  const allWarnings = (warnings ?? []) as Warning[];

  const service = roster.map((p) => ({
    profile: p,
    s: computeService(allRsvps.filter((r) => r.player_id === p.id), allComps),
    strikes: allStrikes.filter((x) => x.player_id === p.id).length,
    warnings: allWarnings.filter((x) => x.player_id === p.id).length,
    guilty: allTrials.filter((t) => t.defendant_id === p.id && t.verdict === "guilty").length,
  }));

  // Fame: turned up, put the hours in. Shame: said in and vanished, or convicted.
  const fame = [...service].sort((a, b) => b.s.operations - a.s.operations).slice(0, 5);
  const shame = [...service]
    .filter((x) => x.s.noShows > 0 || x.strikes > 0 || x.guilty > 0)
    .sort((a, b) => b.s.noShows + b.strikes * 2 + b.guilty * 2 - (a.s.noShows + a.strikes * 2 + a.guilty * 2))
    .slice(0, 5);

  const played = allComps.filter((c) => c.status === "played");
  const totals = computeService(allRsvps, allComps);
  const byId = new Map(roster.map((p) => [p.id, p]));

  const TONE: Record<string, string> = {
    sand: "var(--color-sand)",
    moss: "var(--color-moss)",
    flag: "var(--color-flag)",
  };

  return (
    <div>
      <PageHead eyebrow="Intelligence" title="Honours">
        Medals, legends and disgraces. The group&apos;s own history — not a points system.
      </PageHead>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Panel i={0}><Stat value={played.length} label="Operations in the book" /></Panel>
        <Panel i={1}><Stat value={Math.round(totals.hours)} label="Hours deployed" tone="live" /></Panel>
        <Panel i={2}><Stat value={totals.games} label="Games played" /></Panel>
        <Panel i={3}><Stat value={totals.noShows} label="No-shows recorded" tone={totals.noShows ? "alert" : undefined} /></Panel>
      </div>

      {/* Commendations */}
      <Panel i={4} label="Commendations" right={<Proto />} className="mb-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {MEDALS.map((m) => (
            <div
              key={m.key}
              className="rounded-[3px] border p-4"
              style={{
                borderColor: `color-mix(in srgb, ${TONE[m.tone]} 35%, transparent)`,
                background: `linear-gradient(180deg, color-mix(in srgb, ${TONE[m.tone]} 7%, transparent), transparent)`,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className="hq-readout text-[15px] font-bold uppercase leading-tight tracking-[0.04em]"
                  style={{ color: TONE[m.tone] }}
                >
                  {m.name}
                </p>
                <span className="text-[18px]" aria-hidden>
                  {m.tone === "flag" ? "☠" : m.tone === "moss" ? "✦" : "★"}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] text-ink-soft">{m.blurb}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.holders.map((h) => (
                  <Tag key={h} tone={m.tone === "flag" ? "alert" : m.tone === "moss" ? "live" : "warn"}>
                    {h}
                  </Tag>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="hq-label mt-4 opacity-60">
          Awarded by the President or a Captain. Part of a Service Record — never a leaderboard.
        </p>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Hall of Fame */}
        <Panel
          i={5}
          label="Hall of Fame"
          status={<Dot tone="warn" />}
          right={<span className="hq-label">By service</span>}
        >
          {fame.length === 0 ? (
            <Nil>No service recorded yet</Nil>
          ) : (
            <ol className="flex flex-col">
              {fame.map((f, i) => (
                <li
                  key={f.profile.id}
                  className="flex items-center gap-3 border-b border-rule/60 py-2.5 last:border-0"
                >
                  <span
                    className="hq-readout w-6 shrink-0 text-[18px] font-bold"
                    style={{ color: i === 0 ? "var(--color-sand)" : "var(--color-rule)" }}
                  >
                    {i + 1}
                  </span>
                  <Link
                    href={`/hq/personnel/${f.profile.id}`}
                    className="min-w-0 flex-1 truncate text-[14px] hover:text-sand"
                  >
                    {f.profile.name}
                  </Link>
                  <span className="hq-mono shrink-0 text-xs text-ink-soft">
                    {f.s.operations} ops · {f.s.hours}h · {f.s.games} games
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="hq-label mt-3 opacity-60">
            Ordered by operations attended. Participation, not skill.
          </p>
        </Panel>

        {/* Hall of Shame */}
        <Panel i={6} label="Hall of Shame" status={<Dot tone="alert" />}>
          {shame.length === 0 ? (
            <Nil>Spotless. Suspicious.</Nil>
          ) : (
            <ol className="flex flex-col">
              {shame.map((f) => (
                <li
                  key={f.profile.id}
                  className="flex items-center gap-3 border-b border-rule/60 py-2.5 last:border-0"
                >
                  <span className="text-[15px]" aria-hidden>☠</span>
                  <Link
                    href={`/hq/personnel/${f.profile.id}`}
                    className="min-w-0 flex-1 truncate text-[14px] hover:text-flag"
                  >
                    {f.profile.name}
                  </Link>
                  <span className="hq-mono shrink-0 text-xs" style={{ color: "var(--color-flag)" }}>
                    {[
                      f.s.noShows ? `${f.s.noShows} no-show` : null,
                      f.strikes ? `${f.strikes} strike` : null,
                      f.warnings ? `${f.warnings} warning` : null,
                      f.guilty ? `${f.guilty} guilty` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="hq-label mt-3 opacity-60">Said in. Was not in. The record remembers.</p>
        </Panel>
      </div>

      {/* Legendary incidents — real trials, told properly */}
      <Panel i={7} label="Legendary incidents" className="mt-4">
        {allTrials.length === 0 ? (
          <Nil>No incidents on file</Nil>
        ) : (
          <ul className="flex flex-col">
            {allTrials.slice(0, 8).map((t) => {
              const d = byId.get(t.defendant_id);
              const comp = t.competition_id ? allComps.find((c) => c.id === t.competition_id) : null;
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 border-b border-rule/60 py-2.5 last:border-0"
                >
                  <Dot tone={t.verdict === "guilty" ? "alert" : t.status === "open" ? "warn" : "live"} />
                  <Link href={`/trial/${t.id}`} className="min-w-0 flex-1 truncate text-[13px] hover:text-sand">
                    <span className="text-ink">{d?.name ?? "Unknown"}</span>
                    <span className="text-ink-soft"> — {t.charge}</span>
                    {comp && <span className="text-ink-soft"> · {compHeading(comp)}</span>}
                  </Link>
                  {t.verdict && (
                    <Tag tone={t.verdict === "guilty" ? "alert" : "live"}>
                      {t.verdict === "guilty" ? `Guilty · ${t.penalty ?? "—"}` : "Not guilty"}
                    </Tag>
                  )}
                  <span className="hq-mono shrink-0 text-[10px] text-ink-soft">
                    {relativeTime(t.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
