import Link from "next/link";
import { gameById } from "@/lib/games";
import { Panel, Stat, Dot, Tag, Row, Meter, PageHead, Nil, Proto } from "@/components/hq/Kit";
import { BATTLES, RIVALRIES, orgById, series, type Rivalry } from "@/lib/hq/future/network";

export const metadata = { title: "Rivals · Barracks HQ" };

// ── Rivals ─────────────────────────────────────────────────────────────────
// Anyone can play a stranger. The point of this screen is the outfit you've
// played eight times — the head-to-head record, who's ahead, and what happened
// last time. Repeat opponents are the thing worth building.

function streakTone(s: string): "live" | "alert" {
  return s.startsWith("W") ? "live" : "alert";
}

function nextBattleFor(orgId: string) {
  return BATTLES.find((b) => b.org === orgId && b.stage !== "archived") ?? null;
}

function History({ r }: { r: Rivalry }) {
  if (!r.history?.length) return <Nil>No meetings recorded</Nil>;
  return (
    <div className="flex flex-col">
      {r.history.map((m, i) => (
        <div
          key={`${m.when}-${i}`}
          className="flex items-center gap-3 border-b border-rule/50 py-1.5 last:border-0"
        >
          <span
            className="hq-mono flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] text-[10px] font-bold"
            style={{
              backgroundColor: m.result === "W" ? "var(--color-moss)" : "var(--color-flag)",
              color: "#0b100e",
            }}
          >
            {m.result}
          </span>
          <span className="hq-mono w-24 shrink-0 text-[11px] uppercase tracking-[0.08em] text-ink-soft">
            {m.when}
          </span>
          <span className="hq-mono w-12 shrink-0 text-[13px] font-bold">{m.score}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">{m.note}</span>
          <span className="hq-mono hidden shrink-0 text-[10px] uppercase tracking-[0.1em] text-ink-soft lg:block">
            {m.format}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RivalsPage() {
  const ranked = RIVALRIES.slice().sort((a, b) => b.meetings - a.meetings);
  const hero = ranked[0];
  const rest = ranked.slice(1);

  const totals = ranked.reduce(
    (acc, r) => {
      acc.meetings += r.meetings;
      acc.us += r.us;
      acc.them += r.them;
      return acc;
    },
    { meetings: 0, us: 0, them: 0 },
  );
  const share = totals.meetings ? Math.round((totals.us / totals.meetings) * 100) : 0;
  const heroOrg = hero ? orgById(hero.org) : null;
  const heroNext = hero ? nextBattleFor(hero.org) : null;

  return (
    <div>
      <PageHead
        eyebrow="Network"
        title="Rivals"
        right={
          <>
            <Proto />
            <Link
              href="/hq/find-opponent"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              Find opponent
            </Link>
            <Link
              href="/hq/battles"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              Battles
            </Link>
          </>
        }
      >
        Every Barracks we&apos;ve met more than once, and where the ledger stands.
      </PageHead>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Panel i={0}>
          <Stat value={ranked.length} label="Rivalries" sub="Repeat opponents" />
        </Panel>
        <Panel i={1}>
          <Stat value={totals.meetings} label="Meetings" />
        </Panel>
        <Panel i={2}>
          <Stat value={totals.us} label="Barracks wins" tone="live" />
        </Panel>
        <Panel i={3}>
          <Stat value={totals.them} label="Their wins" tone="alert" />
        </Panel>
        <Panel i={4}>
          <Stat value={`${share}%`} label="Head-to-head share" tone={share >= 50 ? "live" : "warn"} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* ── The big one ───────────────────────────────────────────── */}
          {hero && heroOrg ? (
            <Panel
              i={5}
              sweep
              label="Principal rivalry"
              status={<Dot tone="alert" pulse />}
              right={<Tag tone={streakTone(hero.streak)} solid>{hero.streak}</Tag>}
            >
              <div id={hero.org} className="scroll-mt-24">
                <p className="hq-readout text-[30px] font-bold uppercase leading-none">
                  The Barracks <span className="text-ink-soft">vs</span> {heroOrg.name}
                </p>
                <p className="hq-mono mt-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                  {gameById(heroOrg.game).emoji} {gameById(heroOrg.game).name} · {heroOrg.tag} ·{" "}
                  {heroOrg.region} · rivals since {hero.since ?? "—"}
                </p>

                <div className="mt-5 grid gap-6 md:grid-cols-[auto_1fr]">
                  <div className="flex items-end gap-5">
                    <div className="text-center">
                      <div className="hq-readout text-[54px] font-bold leading-[0.85]" style={{ color: "var(--color-moss)" }}>
                        {hero.us}
                      </div>
                      <div className="hq-label mt-1">Barracks</div>
                    </div>
                    <div className="hq-readout pb-4 text-[22px] text-ink-soft">—</div>
                    <div className="text-center">
                      <div className="hq-readout text-[54px] font-bold leading-[0.85]" style={{ color: "var(--color-flag)" }}>
                        {hero.them}
                      </div>
                      <div className="hq-label mt-1">{heroOrg.tag}</div>
                    </div>
                    <div className="ml-4 border-l border-rule pl-5 text-center">
                      <div className="hq-readout text-[54px] font-bold leading-[0.85]">{hero.meetings}</div>
                      <div className="hq-label mt-1">Meetings</div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="hq-label">The ledger</span>
                      <span className="hq-mono text-xs">
                        <span style={{ color: "var(--color-moss)" }}>{Math.round((hero.us / hero.meetings) * 100)}% ours</span>
                      </span>
                    </div>
                    <Meter pct={Math.round((hero.us / hero.meetings) * 100)} tone="live" />

                    <div className="mt-3">
                      <Row k="Current streak" v={hero.streak} tone={streakTone(hero.streak)} />
                      <Row k="Largest win" v={hero.biggest} tone="warn" />
                      <Row k="Last meeting" v={hero.last} />
                      <Row k="Next battle" v={hero.next ?? "Nothing booked"} tone={hero.next ? "live" : "idle"} />
                    </div>

                    {heroNext && (
                      <Link
                        href={`/hq/battles/${heroNext.id}`}
                        className="hq-label mt-3 inline-block rounded-[3px] px-3 py-2 font-semibold"
                        style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
                      >
                        Open battle room →
                      </Link>
                    )}
                  </div>
                </div>

                <div className="mt-5 border-t border-rule/60 pt-3">
                  <p className="hq-label mb-1.5">Every meeting</p>
                  <History r={hero} />
                </div>
              </div>
            </Panel>
          ) : (
            <Panel i={5} label="Principal rivalry">
              <Nil>No rivalries yet — go and make some enemies</Nil>
            </Panel>
          )}

          {/* ── The rest ──────────────────────────────────────────────── */}
          {rest.map((r, i) => {
            const org = orgById(r.org);
            if (!org) return null;
            const pct = Math.round((r.us / r.meetings) * 100);
            const next = nextBattleFor(r.org);
            return (
              <Panel
                key={r.org}
                i={6 + i}
                label={`The Barracks vs ${org.name}`}
                status={<Dot tone={r.us >= r.them ? "live" : "alert"} />}
                right={<Tag tone={streakTone(r.streak)}>{r.streak}</Tag>}
              >
                <div id={r.org} className="grid gap-6 scroll-mt-24 md:grid-cols-[auto_1fr]">
                  <div className="flex items-end gap-4">
                    <div className="text-center">
                      <div className="hq-readout text-[34px] font-bold leading-none" style={{ color: "var(--color-moss)" }}>
                        {r.us}
                      </div>
                      <div className="hq-label mt-1">Us</div>
                    </div>
                    <div className="hq-readout pb-2 text-ink-soft">—</div>
                    <div className="text-center">
                      <div className="hq-readout text-[34px] font-bold leading-none" style={{ color: "var(--color-flag)" }}>
                        {r.them}
                      </div>
                      <div className="hq-label mt-1">{org.tag}</div>
                    </div>
                    <div className="ml-3 border-l border-rule pl-4 text-center">
                      <div className="hq-readout text-[34px] font-bold leading-none">{r.meetings}</div>
                      <div className="hq-label mt-1">Met</div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <Meter pct={pct} tone={pct >= 50 ? "live" : "alert"} />
                    <p className="hq-mono mt-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                      {gameById(org.game).name} · {org.region} · largest win {r.biggest} · {r.last}
                    </p>
                    <div className="mt-2">
                      <History r={r} />
                    </div>
                    {next && (
                      <Link href={`/hq/battles/${next.id}`} className="hq-label mt-2 inline-block hover:text-ink">
                        Next: {next.scheduled} — open room →
                      </Link>
                    )}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>

        {/* ── Right column ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel i={9} label="Next engagements" status={<Dot tone="warn" pulse />} right={<Proto />}>
            {BATTLES.filter((b) => b.stage !== "archived").length === 0 ? (
              <Nil>Nothing booked</Nil>
            ) : (
              <ul className="flex flex-col">
                {BATTLES.filter((b) => b.stage !== "archived").map((b) => {
                  const org = orgById(b.org);
                  const known = RIVALRIES.some((r) => r.org === b.org);
                  return (
                    <li key={b.id}>
                      <Link
                        href={`/hq/battles/${b.id}`}
                        className="flex items-center gap-3 border-b border-rule/50 py-2 last:border-0 transition-colors hover:bg-[rgba(255,255,255,0.025)]"
                      >
                        <Dot tone={b.stage === "live" ? "live" : "warn"} pulse={b.stage === "live"} />
                        <span className="min-w-0 flex-1 truncate text-[13px]">{org?.name}</span>
                        <span className="hq-mono shrink-0 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                          {b.scheduled}
                        </span>
                        {known && <Tag tone="alert">Rival</Tag>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel i={10} label="Ledger">
            {ranked.map((r) => {
              const org = orgById(r.org);
              const pct = Math.round((r.us / r.meetings) * 100);
              return (
                <div key={r.org} className="border-b border-rule/50 py-2 last:border-0">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[13px]">{org?.name}</span>
                    <span className="hq-mono shrink-0 text-[12px]">
                      <span style={{ color: "var(--color-moss)" }}>{r.us}</span>
                      <span className="text-ink-soft">–</span>
                      <span style={{ color: "var(--color-flag)" }}>{r.them}</span>
                    </span>
                  </div>
                  <Meter pct={pct} tone={pct >= 50 ? "live" : "alert"} />
                </div>
              );
            })}
          </Panel>

          <Panel i={11} label="Archive">
            <ul className="flex flex-col">
              {BATTLES.filter((b) => b.stage === "archived").map((b) => {
                const org = orgById(b.org);
                const s = series(b);
                const won = s.us > s.them;
                return (
                  <li key={b.id}>
                    <Link
                      href={`/hq/battles/${b.id}`}
                      className="flex items-center gap-3 border-b border-rule/50 py-2 last:border-0 transition-colors hover:bg-[rgba(255,255,255,0.025)]"
                    >
                      <span
                        className="hq-mono flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] text-[10px] font-bold"
                        style={{ backgroundColor: won ? "var(--color-moss)" : "var(--color-flag)", color: "#0b100e" }}
                      >
                        {won ? "W" : "L"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">{org?.name}</span>
                      <span className="hq-mono shrink-0 text-[12px] font-bold">
                        {s.us}–{s.them}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel i={12} label="Why rivals matter">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              A one-off battle is a night out. A rivalry is a record: eight meetings, a
              scoreline that carries between them, and a rematch someone has been waiting
              three weeks for. The Barracks tracks outfits, not individuals — the ledger
              belongs to the whole roster.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
