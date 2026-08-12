import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { getRadar, getSquads, type RadarItem } from "@/lib/data";
import { setRadarInterest } from "@/app/actions/radar";
import { shortDate, parseDate, todayISO } from "@/lib/dates";
import { gameById } from "@/lib/games";
import { Panel, Stat, Dot, Tag, Meter, PageHead, Nil, Proto } from "@/components/hq/Kit";
import { Countdown } from "@/components/hq/Countdown";

export const metadata = { title: "Radar · Barracks HQ" };

// ── Radar ───────────────────────────────────────────────────────────────────
// Incoming contacts: what's coming out, when it lands, and whether the Barracks
// cares. Everything on this screen is real (radar_games + radar_interest) except
// the two dispositions at the foot of each contact, which are marked.

/** Real interest toggle — an inline Server Action, so no client bundle. */
async function markInterest(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await setRadarInterest(id, formData.get("v") === "1");
  revalidatePath("/hq/radar");
}

const DAY = 86_400_000;
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const STOP = new Set(["the", "cup", "and", "squad", "game", "games"]);

function daysUntil(iso: string): number {
  return Math.round((parseDate(iso).getTime() - parseDate(todayISO()).getTime()) / DAY);
}

/** Which squads this contact plausibly belongs to — token match on the title. */
function relevance(item: RadarItem, squads: { id: string; label: string; game: string }[]) {
  const title = item.title.toLowerCase();
  return squads.filter((s) =>
    `${gameById(s.game).name} ${s.label} ${s.game}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOP.has(w))
      .some((w) => title.includes(w)),
  );
}

export default async function RadarPage() {
  const profile = await requireProfile();
  const [{ items, totalPlayers }, squadViews] = await Promise.all([
    getRadar(profile.id),
    getSquads(profile.id),
  ]);

  const squads = squadViews.map((s) => ({
    id: s.squad.id,
    label: s.squad.name || gameById(s.squad.game).name,
    game: s.squad.game,
  }));

  const today = todayISO();
  const dated = items.filter((i) => i.release_date);
  const inbound = dated.filter((i) => i.release_date! >= today && daysUntil(i.release_date!) <= 90);
  const undated = items.filter((i) => !i.release_date);
  const pctOf = (i: RadarItem) => (totalPlayers ? Math.round((i.yes / totalPlayers) * 100) : 0);
  const high = items.filter((i) => pctOf(i) >= 60 && i.yes >= 2);
  const nextUp = dated.find((i) => i.release_date! >= today) ?? null;

  // ── Release timeline — twelve months from this one, plus the strays ────────
  const now = parseDate(today);
  const months = Array.from({ length: 12 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() + k, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: MON[d.getMonth()],
      year: String(d.getFullYear()).slice(2),
      current: k === 0,
      items: dated.filter((i) => i.release_date!.slice(0, 7) === key),
    };
  });
  const beyond = dated.filter(
    (i) => i.release_date! > months[11].key + "-31" || i.release_date! < months[0].key + "-01",
  );

  return (
    <div>
      <PageHead
        eyebrow="Intelligence"
        title="Radar"
        right={
          <>
            <Link
              href="/radar"
              className="hq-label rounded-[3px] px-3 py-2 font-semibold"
              style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
            >
              + Add contact
            </Link>
            <span className="hq-label rounded-[3px] border border-rule px-3 py-2">
              {items.length} tracked
            </span>
          </>
        }
      >
        Incoming releases and where the Barracks stands on each. Interest is live —
        mark yours and the count moves for everyone.
      </PageHead>

      {/* ── Status strip ─────────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Panel i={0}>
          <Stat value={items.length} label="Contacts tracked" sub={`${undated.length} without a date`} />
        </Panel>
        <Panel i={1}>
          <Stat
            value={inbound.length}
            label="Inbound · 90 days"
            tone={inbound.length > 0 ? "alert" : undefined}
          />
        </Panel>
        <Panel i={2}>
          <Stat value={high.length} label="High interest" tone={high.length ? "live" : undefined} />
        </Panel>
        <Panel i={3}>
          <Stat value={totalPlayers} label="Operatives polled" />
        </Panel>
        <Panel i={4} className="col-span-2 xl:col-span-1">
          {nextUp ? (
            <>
              <Countdown iso={`${nextUp.release_date}T00:00:00`} label={`Until ${nextUp.title}`} />
            </>
          ) : (
            <Stat value="—" label="Nothing inbound" />
          )}
        </Panel>
      </div>

      {/* ── Release calendar ─────────────────────────────────────────────── */}
      <Panel
        i={5}
        sweep
        label="Release calendar"
        status={<Dot tone="live" pulse />}
        right={
          <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            {dated.length} dated · {undated.length} undated
          </span>
        }
        className="mb-4"
      >
        <div className="flex gap-px overflow-x-auto pb-1">
          {months.map((m) => (
            <div
              key={m.key}
              className="min-w-[112px] flex-1 border-r border-rule/60 px-2.5 pb-2 pt-1.5 last:border-0"
              style={{
                backgroundColor: m.current ? "rgba(245,182,61,0.05)" : undefined,
              }}
            >
              <div className="flex items-baseline justify-between">
                <span
                  className="hq-label"
                  style={{ color: m.current ? "var(--color-sand)" : undefined }}
                >
                  {m.label}
                </span>
                <span className="hq-mono text-[9px] text-ink-soft">{m.year}</span>
              </div>
              <div
                className="mt-1.5 h-px w-full"
                style={{
                  backgroundColor: m.items.length ? "var(--color-moss)" : "var(--color-rule)",
                }}
              />
              <ul className="mt-2 flex min-h-[54px] flex-col gap-1">
                {m.items.slice(0, 4).map((i) => (
                  <li key={i.id} className="flex items-start gap-1.5">
                    <span
                      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          pctOf(i) >= 60 ? "var(--color-moss)" : "var(--color-sand)",
                      }}
                    />
                    <span className="hq-mono truncate text-[10px] leading-tight">{i.title}</span>
                  </li>
                ))}
                {m.items.length > 4 && (
                  <li className="hq-mono text-[9px] text-ink-soft">+{m.items.length - 4} more</li>
                )}
              </ul>
            </div>
          ))}
        </div>
        {(beyond.length > 0 || undated.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-rule pt-3">
            {beyond.length > 0 && <Tag tone="idle">Beyond the window · {beyond.length}</Tag>}
            {undated.map((i) => (
              <Tag key={i.id} tone="idle">
                {i.title} · no date
              </Tag>
            ))}
          </div>
        )}
      </Panel>

      {/* ── Contacts ─────────────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <Panel i={6} label="Contacts">
          <Nil>Radar clear — no contacts tracked</Nil>
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {items.map((item, idx) => {
            const pct = pctOf(item);
            const days = item.release_date ? daysUntil(item.release_date) : null;
            const released = days != null && days < 0;
            const imminent = days != null && days >= 0 && days <= 30;
            const rel = relevance(item, squads);
            const polled = item.yes + item.no;

            return (
              <Panel
                key={item.id}
                i={6 + idx}
                label={item.platform ? item.platform.toUpperCase() : "PLATFORM UNKNOWN"}
                status={
                  <Dot tone={released ? "idle" : imminent ? "alert" : "warn"} pulse={imminent} />
                }
                right={
                  released ? (
                    <Tag tone="idle">Released</Tag>
                  ) : imminent ? (
                    <Tag tone="alert" solid>
                      Inbound
                    </Tag>
                  ) : (
                    <Tag tone="warn">Tracking</Tag>
                  )
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="hq-readout truncate text-[19px] font-bold leading-tight">
                      {item.title}
                    </h3>
                    <p className="hq-mono mt-1 text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                      {item.release_date ? shortDate(item.release_date) : "No release date"} ·
                      logged by {item.adderName}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className="hq-readout text-[26px] font-bold leading-none"
                      style={{
                        color: released
                          ? "var(--color-ink-soft)"
                          : imminent
                            ? "var(--color-flag)"
                            : "var(--color-sand)",
                      }}
                    >
                      {days == null ? "—" : released ? "OUT" : `T-${days}`}
                    </div>
                    <div className="hq-label mt-1">
                      {days == null ? "Undated" : released ? `${Math.abs(days)}d ago` : "Days"}
                    </div>
                  </div>
                </div>

                {item.note && (
                  <p className="mt-3 border-l border-rule pl-3 text-[13px] text-ink-soft">
                    {item.note}
                  </p>
                )}

                {/* Interest */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="hq-label">
                      {item.yes}/{totalPlayers} interested
                    </span>
                    {pct >= 60 && item.yes >= 2 ? (
                      <Tag tone="live" solid>
                        High interest
                      </Tag>
                    ) : (
                      <span className="hq-mono text-[10px] text-ink-soft">
                        {polled}/{totalPlayers} polled
                      </span>
                    )}
                  </div>
                  <Meter pct={pct} tone={pct >= 60 ? "live" : pct >= 30 ? "warn" : "alert"} />
                  <p className="hq-mono mt-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                    {item.yes} in favour · {item.no} against ·{" "}
                    {Math.max(0, totalPlayers - polled)} silent
                  </p>
                </div>

                {/* Real interest toggle */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <form action={markInterest}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="v" value="1" />
                    <button
                      type="submit"
                      className="hq-label w-full rounded-[3px] border py-2 transition-colors"
                      style={{
                        borderColor:
                          item.mine === true ? "var(--color-moss)" : "var(--color-rule)",
                        backgroundColor:
                          item.mine === true ? "var(--color-moss)" : "transparent",
                        color: item.mine === true ? "#0b100e" : "var(--color-ink)",
                      }}
                    >
                      Interested
                    </button>
                  </form>
                  <form action={markInterest}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="v" value="0" />
                    <button
                      type="submit"
                      className="hq-label w-full rounded-[3px] border py-2 transition-colors"
                      style={{
                        borderColor:
                          item.mine === false ? "var(--color-flag)" : "var(--color-rule)",
                        backgroundColor:
                          item.mine === false ? "var(--color-flag)" : "transparent",
                        color: item.mine === false ? "#0b100e" : "var(--color-ink)",
                      }}
                    >
                      Not for me
                    </button>
                  </form>
                </div>

                {/* Relevance + intel */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {rel.length > 0 ? (
                    rel.map((s) => (
                      <Tag key={s.id} tone="warn">
                        {s.label} squad
                      </Tag>
                    ))
                  ) : (
                    <Tag tone="idle">Barracks-wide</Tag>
                  )}
                  {item.youtube_url && (
                    <a
                      href={item.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hq-label rounded-[3px] border border-rule px-2 py-1 transition-colors hover:border-sand hover:text-ink"
                    >
                      ▶ Trailer
                    </a>
                  )}
                </div>

                {/* Dispositions — prototype */}
                <div className="mt-3 flex items-center gap-2 border-t border-rule pt-3">
                  <button
                    type="button"
                    className="hq-label flex-1 rounded-[3px] border border-dashed border-rule py-2 text-ink-soft transition-colors hover:border-sand hover:text-ink"
                  >
                    Propose operation
                  </button>
                  <button
                    type="button"
                    className="hq-label flex-1 rounded-[3px] border border-dashed border-rule py-2 text-ink-soft transition-colors hover:border-sand hover:text-ink"
                  >
                    Assign to squad
                  </button>
                  <Proto />
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
