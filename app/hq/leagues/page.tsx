import Link from "next/link";
import { gameById } from "@/lib/games";
import { Panel, Stat, Dot, Tag, Row, Meter, PageHead, Nil, Proto } from "@/components/hq/Kit";
import { LEAGUES, LEAGUE_HONOURS, orgById, type LeagueTable, type LeagueRow } from "@/lib/hq/future/network";

export const metadata = { title: "Leagues · Barracks HQ" };

// ── Leagues ────────────────────────────────────────────────────────────────
// Structured seasons between Barracks. One rule underpins this whole screen:
// SQUADS ARE RANKED, NEVER INDIVIDUALS. There is no universal player ranking in
// this product and there never will be — the table is a table of outfits.

function Form({ form }: { form: ("W" | "L")[] }) {
  return (
    <span className="flex gap-1">
      {form.map((f, i) => (
        <span
          key={i}
          className="hq-mono flex h-4 w-4 items-center justify-center rounded-[2px] text-[9px] font-bold"
          style={{
            backgroundColor: f === "W" ? "var(--color-moss)" : "var(--color-flag)",
            color: "#0b100e",
            opacity: 0.55 + (i / Math.max(1, form.length - 1)) * 0.45,
          }}
        >
          {f}
        </span>
      ))}
    </span>
  );
}

function Table({ rows, state }: { rows: LeagueRow[]; state: LeagueTable["state"] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-rule">
          {["", "Barracks", "P", "W", "L", "Diff", "Pts", "Form"].map((h, i) => (
            <th
              key={i}
              className={`hq-label px-3 py-2 ${i > 1 && i < 7 ? "text-right" : "text-left"}`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const org = r.org === "self" ? null : orgById(r.org);
          const champion = state === "complete" && i === 0;
          return (
            <tr
              key={r.org}
              className="border-b border-rule/50 last:border-0"
              style={{
                backgroundColor: r.us ? "rgba(245,182,61,0.07)" : undefined,
                boxShadow: r.us ? "inset 2px 0 0 var(--color-sand)" : undefined,
              }}
            >
              <td className="hq-mono px-3 py-2 text-[12px] font-bold" style={{ color: i === 0 ? "var(--color-sand)" : "var(--color-ink-soft)" }}>
                {i + 1}
              </td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-2">
                  <span className="text-[13px]" style={{ color: r.us ? "var(--color-ink)" : undefined }}>
                    {r.name}
                  </span>
                  <span className="hq-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                    {r.us ? "BRK" : org?.tag}
                  </span>
                  {r.us && <Tag tone="warn">Us</Tag>}
                  {champion && <Tag tone="warn" solid>Champions</Tag>}
                </span>
              </td>
              <td className="hq-mono px-3 py-2 text-right text-[13px] text-ink-soft">{r.p}</td>
              <td className="hq-mono px-3 py-2 text-right text-[13px]" style={{ color: "var(--color-moss)" }}>{r.w}</td>
              <td className="hq-mono px-3 py-2 text-right text-[13px]" style={{ color: "var(--color-flag)" }}>{r.l}</td>
              <td className="hq-mono px-3 py-2 text-right text-[13px] text-ink-soft">
                {r.diff > 0 ? `+${r.diff}` : r.diff}
              </td>
              <td className="hq-readout px-3 py-2 text-right text-[16px] font-bold">{r.pts}</td>
              <td className="px-3 py-2">
                <Form form={r.form} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function LeaguesPage() {
  const live = LEAGUES.find((l) => l.state === "live") ?? LEAGUES[0];
  const complete = LEAGUES.filter((l) => l.state === "complete");

  const rows = live.rows;
  const usIdx = rows.findIndex((r) => r.us);
  const usRow = rows[usIdx];
  const leader = rows[0];
  const chaser = rows.find((r) => !r.us) ?? rows[1];
  const remaining = Math.max(0, live.rounds - live.played);

  // Points still available to the nearest challenger — the maths behind "seal it".
  const chaserMax = chaser ? chaser.pts + remaining * 3 : 0;
  const winsToSeal = usRow ? Math.max(0, Math.ceil((chaserMax - usRow.pts + 1) / 3)) : 0;
  const sealable = winsToSeal <= remaining;
  const nextOrg = live.next ? orgById(live.next.org) : null;

  return (
    <div>
      <PageHead
        eyebrow="Network"
        title="Leagues"
        right={
          <>
            <Proto />
            <Link
              href="/hq/battles"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              Battles
            </Link>
          </>
        }
      >
        Structured seasons between Barracks. Squads are ranked — never individuals.
      </PageHead>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Panel i={0}>
          <Stat
            value={usIdx >= 0 ? `${usIdx + 1}${["st", "nd", "rd"][usIdx] ?? "th"}` : "—"}
            label="Position"
            tone={usIdx === 0 ? "warn" : undefined}
            sub={live.name}
          />
        </Panel>
        <Panel i={1}>
          <Stat value={usRow?.pts ?? 0} label="Points" tone="live" sub={`${usRow?.w ?? 0}W · ${usRow?.l ?? 0}L`} />
        </Panel>
        <Panel i={2}>
          <Stat
            value={usRow && chaser ? (usRow.pts - chaser.pts > 0 ? `+${usRow.pts - chaser.pts}` : `${usRow.pts - chaser.pts}`) : "—"}
            label="Gap to next"
            tone={usRow && chaser && usRow.pts > chaser.pts ? "live" : "alert"}
            sub={chaser?.name}
          />
        </Panel>
        <Panel i={3}>
          <Stat value={remaining} label="Rounds remaining" sub={`${live.played} of ${live.rounds} played`} />
        </Panel>
        <Panel i={4}>
          <Stat value={LEAGUE_HONOURS.filter((h) => h.org === "self").length} label="Titles won" tone="warn" sub="Barracks honours" />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-4">
          <Panel
            i={5}
            sweep
            label={live.name}
            status={<Dot tone="live" pulse />}
            right={
              <>
                <span className="hq-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">{live.season}</span>
                <Tag tone="live">In season</Tag>
                <Proto />
              </>
            }
            pad={false}
          >
            <Table rows={rows} state={live.state} />
            <p className="hq-mono border-t border-rule px-4 py-2 text-[10px] uppercase tracking-[0.08em] text-ink-soft">
              {gameById(live.game).emoji} {gameById(live.game).name} · 3 points a win · game difference separates level teams
            </p>
          </Panel>

          <Panel
            i={6}
            label="Title picture"
            status={<Dot tone={usIdx === 0 ? "warn" : "idle"} pulse={usIdx === 0} />}
            right={<Proto />}
          >
            {!usRow ? (
              <Nil>The Barracks are not entered in this league</Nil>
            ) : (
              <div className="grid gap-6 md:grid-cols-[auto_1fr]">
                <div>
                  <p className="hq-label">{usIdx === 0 ? "Top of the table" : "Chasing"}</p>
                  <p
                    className="hq-readout mt-1 text-[40px] font-bold uppercase leading-none"
                    style={{ color: "var(--color-sand)" }}
                  >
                    {sealable ? `${winsToSeal} win${winsToSeal === 1 ? "" : "s"}` : "Must win out"}
                  </p>
                  <p className="hq-mono mt-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                    {sealable
                      ? `from ${remaining} to seal the season`
                      : `and hope ${chaser?.name} slip`}
                  </p>
                </div>
                <div className="min-w-0">
                  <Row k="Leaders" v={`${leader?.name} · ${leader?.pts} pts`} tone="warn" />
                  <Row k="Nearest challenger" v={`${chaser?.name} · ${chaser?.pts} pts`} tone="alert" />
                  <Row k="Their maximum" v={`${chaserMax} pts`} />
                  <Row k="Our maximum" v={`${usRow.pts + remaining * 3} pts`} tone="live" />
                  <Row
                    k="Next fixture"
                    v={live.next ? `${nextOrg?.name ?? live.next.org} · ${live.next.when}` : "None scheduled"}
                    tone={live.next ? "live" : "idle"}
                  />
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="hq-label">Season progress</span>
                      <span className="hq-mono text-xs text-ink-soft">
                        {live.played}/{live.rounds} rounds
                      </span>
                    </div>
                    <Meter pct={(live.played / live.rounds) * 100} tone="warn" />
                  </div>
                </div>
              </div>
            )}
          </Panel>

          {/* ── Champion state ─────────────────────────────────────────── */}
          {complete.map((l, i) => {
            const champ = l.champion;
            const weWon = champ?.org === "self";
            return (
              <Panel
                key={l.id}
                i={7 + i}
                label={l.name}
                status={<Dot tone="warn" />}
                right={
                  <>
                    <span className="hq-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">{l.season}</span>
                    <Tag tone="idle">Season complete</Tag>
                  </>
                }
                pad={false}
              >
                {champ && (
                  <div
                    className="border-b border-rule px-4 py-5 text-center"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(245,182,61,0.14), rgba(245,182,61,0.03) 70%, transparent)",
                    }}
                  >
                    <p className="hq-label" style={{ color: "var(--color-sand)" }}>
                      {weWon ? "Champions" : "Season winners"}
                    </p>
                    <p
                      className="hq-readout mt-1.5 text-[38px] font-bold uppercase leading-none"
                      style={{ color: "var(--color-sand)" }}
                    >
                      {champ.name}
                    </p>
                    <p className="hq-readout mt-1 text-[15px] font-bold uppercase tracking-[0.2em]">
                      {champ.season} {l.name.replace("Barracks ", "")} Champions
                    </p>
                    <p className="hq-mono mt-2 text-[11px] uppercase tracking-[0.1em] text-ink-soft">{champ.note}</p>
                  </div>
                )}
                <Table rows={l.rows} state={l.state} />
              </Panel>
            );
          })}
        </div>

        {/* ── Right column ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel i={9} label="Ranking policy" status={<Dot tone="warn" />}>
            <p className="hq-readout text-[17px] font-bold uppercase leading-tight" style={{ color: "var(--color-sand)" }}>
              Squads are ranked. Never individuals.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              There is no universal player ranking in The Barracks and there will not be one.
              A league table ranks outfits — the Barracks that turned up, the roster that played,
              the Captain who signed the result. Personal stats stay inside your own Barracks,
              where they belong.
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {[
                "Entries are Barracks, not players",
                "A result counts once both Captains sign it",
                "Game difference separates level squads",
                "Forfeits are recorded against the outfit",
              ].map((t) => (
                <li key={t} className="flex gap-2 text-[13px] text-ink-soft">
                  <span style={{ color: "var(--color-moss)" }}>·</span>
                  <span className="min-w-0">{t}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel i={10} label="Honours board" right={<Proto />}>
            {LEAGUE_HONOURS.length === 0 ? (
              <Nil>No honours yet</Nil>
            ) : (
              <ul className="flex flex-col">
                {LEAGUE_HONOURS.map((h) => {
                  const ours = h.org === "self";
                  return (
                    <li
                      key={`${h.season}-${h.league}`}
                      className="flex items-center gap-3 border-b border-rule/50 py-2 last:border-0"
                    >
                      <span
                        className="hq-mono w-10 shrink-0 text-[12px] font-bold"
                        style={{ color: ours ? "var(--color-sand)" : "var(--color-ink-soft)" }}
                      >
                        {h.season}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]" style={{ color: ours ? "var(--color-ink)" : undefined }}>
                          {h.name}
                        </span>
                        <span className="hq-mono block truncate text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                          {h.league} · {h.note}
                        </span>
                      </span>
                      {ours && <Tag tone="warn" solid>Ours</Tag>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel i={11} label="Form guide">
            <ul className="flex flex-col">
              {rows.map((r) => {
                const wins = r.form.filter((f) => f === "W").length;
                return (
                  <li key={r.org} className="flex items-center gap-3 border-b border-rule/50 py-2 last:border-0">
                    <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: r.us ? "var(--color-sand)" : undefined }}>
                      {r.name}
                    </span>
                    <Form form={r.form} />
                    <span className="hq-mono w-10 shrink-0 text-right text-[11px] text-ink-soft">{wins}/{r.form.length}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel i={12} label="How a season runs">
            <Row k="Format" v={`${live.rounds} rounds · round robin`} />
            <Row k="Win" v="3 points" tone="live" />
            <Row k="Loss" v="0 points" />
            <Row k="Tie-break" v="Game difference" tone="warn" />
            <Row k="Result entry" v="Both Captains sign" tone="warn" />
            <Row k="Evidence" v="Required per game" />
            <p className="hq-mono mt-3 border-t border-rule/60 pt-2 text-[10px] uppercase leading-[1.6] tracking-[0.08em] text-ink-soft">
              League fixtures use the same battle room and the same evidence workflow as a
              friendly. Nothing about a table changes how a battle is played.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
