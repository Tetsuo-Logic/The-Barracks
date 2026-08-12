import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfiles, getSquads } from "@/lib/data";
import { gameById, compHeading } from "@/lib/games";
import { shortDate } from "@/lib/dates";
import { Avatar } from "@/components/Avatar";
import { Panel, Stat, Dot, Tag, Row, Meter, PageHead, Nil, Proto } from "@/components/hq/Kit";
import { ELECTION } from "@/lib/hq/future/systems";
import type { Competition, Profile } from "@/lib/domain";

export const metadata = { title: "Leadership · Barracks HQ" };

// ── CHAIN OF COMMAND ───────────────────────────────────────────────────────
// Real: the sitting President (profiles.is_president), squad captains
// (squad_members.is_captain) and acting captains for a single Operation
// (competitions.acting_captain_id). Elections are an adapter — clearly marked.

function stamp(iso: string): string {
  const d = iso.slice(0, 10);
  return `${shortDate(d)} ${d.slice(2, 4)}`;
}

export default async function LeadershipPage() {
  const me = await requireProfile();
  const supabase = await createClient();

  const [profiles, squads, { data: compRows }] = await Promise.all([
    getProfiles(),
    getSquads(me.id),
    supabase.from("competitions").select("*").not("acting_captain_id", "is", null),
  ]);

  const president = profiles.find((p) => p.is_president) ?? null;
  const officers = profiles.filter((p) => p.is_admin);
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const acting = ((compRows ?? []) as Competition[]).sort((a, b) => (a.date < b.date ? 1 : -1));

  const captainRows = squads.map((s) => {
    const cap = s.members.find((m) => m.is_captain)?.profile ?? null;
    const squadActing = acting.filter((c) => c.squad_id === s.squad.id);
    return {
      id: s.squad.id,
      name: s.squad.name || gameById(s.squad.game).name,
      game: s.squad.game,
      tag: s.squad.clan_tag,
      captain: cap,
      members: s.members.length,
      muster: s.muster?.muster.status ?? null,
      since: s.squad.created_at,
      acting: squadActing,
    };
  });

  const captains = captainRows.filter((r) => r.captain);
  const vacant = captainRows.filter((r) => !r.captain);
  const commanded = captains.reduce((n, r) => n + r.members, 0);
  const totalVotes = ELECTION.candidates.reduce((n, c) => n + c.votes, 0) || 1;

  // Real role history: the dated command facts we actually hold.
  const history: { at: string; code: string; text: string; tone: "warn" | "live" | "info" }[] = [];
  for (const r of captainRows) {
    history.push({
      at: r.since,
      code: "SQUAD RAISED",
      text: `${r.name} squad formed${r.captain ? ` under ${r.captain.name}` : " — captaincy vacant"}.`,
      tone: r.captain ? "live" : "info",
    });
  }
  for (const c of acting) {
    const who = c.acting_captain_id ? byId.get(c.acting_captain_id) : null;
    history.push({
      at: `${c.date}T11:00:00`,
      code: "TRANSFER COMMAND",
      text: `${who?.name ?? "An operative"} took acting command for ${compHeading(c)}${
        c.finished_at ? " — command returned on close." : " — command still transferred."
      }`,
      tone: "warn",
    });
  }
  history.sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div>
      <PageHead
        eyebrow="Barracks"
        title="Chain of command"
        right={
          <>
            <Link
              href="/hq/squads"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              Squads
            </Link>
            <Link
              href="/hq/personnel"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              Personnel
            </Link>
          </>
        }
      >
        {president ? (
          <>
            <span className="text-ink">{president.name}</span> holds command ·{" "}
            {captains.length} of {captainRows.length} squads captained
          </>
        ) : (
          <>Command vacant · {captains.length} squads captained</>
        )}
      </PageHead>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Panel i={0}>
          <div className="flex items-center gap-2">
            <Dot tone={president ? "warn" : "alert"} pulse={!president} />
            <span className="hq-label">Command</span>
          </div>
          <p
            className="hq-readout mt-2 truncate text-[20px] font-bold uppercase"
            style={{ color: president ? "var(--color-sand)" : "var(--color-flag)" }}
          >
            {president ? "HELD" : "VACANT"}
          </p>
        </Panel>
        <Panel i={1}>
          <Stat value={officers.length} label="Commanding officers" />
        </Panel>
        <Panel i={2}>
          <Stat value={captains.length} label="Squad captains" tone="live" />
        </Panel>
        <Panel i={3}>
          <Stat value={vacant.length} label="Captaincies vacant" tone={vacant.length ? "alert" : undefined} />
        </Panel>
        <Panel i={4}>
          <Stat value={acting.length} label="Command transfers" sub="Acting captains appointed" />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* ── The President ──────────────────────────────────────────── */}
          <Panel
            i={5}
            sweep
            label="Office of the President"
            status={<Dot tone={president ? "warn" : "alert"} pulse />}
            right={
              <span className="hq-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                Rules on complaints · names judges
              </span>
            }
          >
            {president ? (
              <div className="flex flex-wrap items-center gap-6">
                <div className="shrink-0">
                  <Avatar
                    name={president.name}
                    avatarUrl={president.avatar_url}
                    colour={president.colour}
                    size={72}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="hq-readout text-[28px] font-bold uppercase leading-none">
                      {president.name}
                    </h3>
                    <Tag tone="warn" solid>
                      President
                    </Tag>
                    {president.is_admin && <Tag tone="warn">CO</Tag>}
                  </div>
                  <p className="hq-mono mt-2 text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                    Callsign {president.nickname || "—"} · enlisted {stamp(president.created_at)} ·
                    term start not on record
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Tag tone="live">Rules the board</Tag>
                    <Tag tone="live">Refers to court</Tag>
                    <Tag tone="live">Approves musters</Tag>
                    <Tag tone="live">Forms squads</Tag>
                  </div>
                  <Link
                    href={`/hq/personnel/${president.id}`}
                    className="hq-label mt-3 inline-block hover:text-ink"
                  >
                    Service record →
                  </Link>
                </div>
                <div className="shrink-0 border-l border-rule pl-6">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="hq-label">Acting President</span>
                    <Proto />
                  </div>
                  <p className="hq-readout text-[18px] font-bold uppercase leading-none text-ink-soft">
                    NO TRANSFER ACTIVE
                  </p>
                  <p className="hq-mono mt-2 max-w-[240px] text-[11px] leading-relaxed text-ink-soft">
                    Command may be signed over for a fixed window — the deputy rules in the
                    President&apos;s place, and{" "}
                    <span style={{ color: "var(--color-sand)" }}>COMMAND RETURNS</span> automatically
                    when it closes.
                  </p>
                  <span className="hq-label mt-3 inline-block cursor-not-allowed rounded-[3px] border border-dashed border-rule px-3 py-2 opacity-60">
                    Transfer command
                  </span>
                </div>
              </div>
            ) : (
              <Nil>Command vacant — no President appointed</Nil>
            )}
          </Panel>

          {/* ── Squad captains ─────────────────────────────────────────── */}
          <Panel
            i={6}
            label="Squad captains"
            pad={false}
            right={
              <span className="hq-mono text-[11px] text-ink-soft">
                {commanded} operatives under captaincy
              </span>
            }
          >
            <div className="grid grid-cols-[minmax(140px,1.2fr)_minmax(150px,1.3fr)_5rem_7rem_minmax(120px,1fr)] items-center gap-3 border-b border-rule px-4 py-2">
              <span className="hq-label">Squad</span>
              <span className="hq-label">Captain</span>
              <span className="hq-label text-right">Posted</span>
              <span className="hq-label">Muster</span>
              <span className="hq-label">Acting command</span>
            </div>
            {captainRows.length === 0 ? (
              <Nil>No squads formed</Nil>
            ) : (
              captainRows.map((r, i) => (
                <div
                  key={r.id}
                  className="hq-rise grid grid-cols-[minmax(140px,1.2fr)_minmax(150px,1.3fr)_5rem_7rem_minmax(120px,1fr)] items-center gap-3 border-b border-rule/50 px-4 py-2.5 last:border-0"
                  style={{ ["--i" as string]: Math.min(i, 10) }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span>{gameById(r.game).emoji}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-ink">{r.name}</span>
                      {r.tag && (
                        <span className="hq-mono block text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                          [{r.tag}]
                        </span>
                      )}
                    </span>
                  </span>

                  {r.captain ? (
                    <Link
                      href={`/hq/personnel/${r.captain.id}`}
                      className="flex min-w-0 items-center gap-2 hover:text-ink"
                    >
                      <Avatar
                        name={r.captain.name}
                        avatarUrl={r.captain.avatar_url}
                        colour={r.captain.colour}
                        size={22}
                      />
                      <span className="truncate text-[13px] text-ink">{r.captain.name}</span>
                    </Link>
                  ) : (
                    <span className="hq-mono text-[12px]" style={{ color: "var(--color-flag)" }}>
                      Captaincy vacant
                    </span>
                  )}

                  <span className="hq-mono text-right text-[13px] text-ink">{r.members}</span>

                  <span>
                    {r.muster ? (
                      <Tag tone={r.muster === "proposed" ? "alert" : "warn"}>{r.muster}</Tag>
                    ) : (
                      <span className="hq-mono text-[11px] text-ink-soft">—</span>
                    )}
                  </span>

                  <span className="hq-mono truncate text-[11px] text-ink-soft">
                    {r.acting.length === 0
                      ? "—"
                      : `${r.acting.length} transfer${r.acting.length > 1 ? "s" : ""}`}
                  </span>
                </div>
              ))
            )}
          </Panel>

          {/* ── Acting command log ─────────────────────────────────────── */}
          <Panel
            i={7}
            label="Acting command"
            status={<Dot tone={acting.some((c) => !c.finished_at) ? "warn" : "idle"} />}
          >
            {acting.length === 0 ? (
              <Nil>No command ever transferred</Nil>
            ) : (
              <ul className="flex flex-col">
                {acting.map((c) => {
                  const who = c.acting_captain_id ? byId.get(c.acting_captain_id) : null;
                  const open = !c.finished_at;
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 border-b border-rule/60 py-2 last:border-0"
                    >
                      <Dot tone={open ? "warn" : "idle"} pulse={open} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-ink">
                          {who?.name ?? "Unknown operative"} — {compHeading(c)}
                        </span>
                        <span className="hq-mono block text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                          {shortDate(c.date)} ·{" "}
                          {open ? "command transferred" : "command returned"}
                        </span>
                      </span>
                      <Tag tone={open ? "warn" : "idle"}>
                        {open ? "Transfer command" : "Command returns"}
                      </Tag>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* ── Elections (adapter) ────────────────────────────────────── */}
          <Panel
            i={8}
            label="Elections"
            status={<Dot tone={ELECTION.status === "open" ? "live" : "idle"} pulse={ELECTION.status === "open"} />}
            right={<Proto />}
          >
            <div
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[3px] border px-4 py-3"
              style={{
                borderColor:
                  ELECTION.status === "open" ? "var(--color-moss)" : "var(--color-rule)",
                backgroundColor:
                  ELECTION.status === "open"
                    ? "color-mix(in srgb, var(--color-moss) 8%, transparent)"
                    : "transparent",
              }}
            >
              <div>
                <p
                  className="hq-readout text-[22px] font-bold uppercase leading-none"
                  style={{
                    color:
                      ELECTION.status === "open" ? "var(--color-moss)" : "var(--color-ink-soft)",
                  }}
                >
                  {ELECTION.status === "open" ? "POLLS OPEN" : "POLLS CLOSED"}
                </p>
                <p className="hq-mono mt-1.5 text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                  Opened {ELECTION.opened} · closed {ELECTION.closed} · secret ballot
                </p>
              </div>
              <div className="text-right">
                <p className="hq-readout text-[22px] font-bold leading-none">
                  {ELECTION.turnout}/{ELECTION.eligible}
                </p>
                <p className="hq-label mt-1">Turnout</p>
              </div>
            </div>

            <p className="hq-label mb-2">Nominations · the ballot</p>
            <div className="flex flex-col gap-3">
              {ELECTION.candidates.map((c) => {
                const pct = Math.round((c.votes / totalVotes) * 100);
                return (
                  <div key={c.name}>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <span className="hq-mono text-[13px] uppercase tracking-[0.1em] text-ink">
                          {c.name}
                        </span>
                        {c.incumbent && <Tag tone="warn">Incumbent</Tag>}
                      </span>
                      <span className="hq-mono text-[12px] text-ink-soft">
                        {c.votes} {c.votes === 1 ? "vote" : "votes"} · {pct}%
                      </span>
                    </div>
                    <Meter pct={pct} tone={c.incumbent ? "warn" : "info"} />
                  </div>
                );
              })}
            </div>

            <p
              className="hq-readout mt-4 border-t border-rule pt-3 text-[18px] font-bold uppercase tracking-[0.04em]"
              style={{ color: "var(--color-sand)" }}
            >
              {ELECTION.outcome}
            </p>

            <p className="hq-label mb-2 mt-4">Previous presidents</p>
            {ELECTION.history.map((h) => (
              <Row key={h.term} k={h.term} v={`${h.president} · ${h.note}`} tone="info" />
            ))}
          </Panel>
        </div>

        {/* ── Right column ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel i={9} label="Order of command">
            <ul className="flex flex-col gap-2">
              <Tier
                rank="01"
                title="President"
                who={president ? [president] : []}
                blurb="Rules on complaints, refers to court, names the judge."
                tone="warn"
              />
              <Tier
                rank="02"
                title="Commanding officer"
                who={officers}
                blurb="Deploys operations, approves musters, convenes trials, issues strikes."
                tone="warn"
              />
              <Tier
                rank="03"
                title="Squad captains"
                who={captains.map((c) => c.captain!).filter(Boolean)}
                blurb="Calls the muster, proposes the night, runs the squad."
                tone="live"
              />
              <Tier
                rank="04"
                title="Operatives"
                who={profiles.filter(
                  (p) =>
                    !p.is_admin &&
                    !p.is_president &&
                    !captains.some((c) => c.captain?.id === p.id),
                )}
                blurb="Answer the roll call. Nudge the Captain. Raise a mutiny."
                tone="info"
              />
            </ul>
          </Panel>

          <Panel i={10} label="Delegation">
            <Row k="Deploy operation" v="CO" tone="warn" />
            <Row k="Approve a muster" v="CO" tone="warn" />
            <Row k="Call a muster" v="Captain" tone="live" />
            <Row k="Propose a night" v="Captain" tone="live" />
            <Row k="Rule on a complaint" v="President / CO" tone="warn" />
            <Row k="Convene a trial" v="CO" tone="warn" />
            <Row k="Issue a strike" v="The court" tone="alert" />
            <Row k="Raise a mutiny" v="Any operative" tone="info" />
            <Row k="Acting captain" v="Per operation" tone="live" />
            <p className="hq-mono mt-3 text-[10px] uppercase leading-relaxed tracking-[0.1em] text-ink-soft">
              A ruler never sits in judgement on themselves — a case about the President goes to
              the ranks, not the bench.
            </p>
          </Panel>

          <Panel i={11} label="Role history">
            {history.length === 0 ? (
              <Nil>No command events on record</Nil>
            ) : (
              <ul className="flex flex-col">
                {history.slice(0, 10).map((h, i) => (
                  <li
                    key={`${h.at}-${i}`}
                    className="flex items-start gap-2.5 border-b border-rule/60 py-2 last:border-0"
                  >
                    <Dot tone={h.tone} />
                    <span className="min-w-0 flex-1">
                      <span
                        className="hq-mono block text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{
                          color: h.tone === "warn" ? "var(--color-sand)" : "var(--color-moss)",
                        }}
                      >
                        {h.code}
                      </span>
                      <span className="block text-[12px] text-ink">{h.text}</span>
                    </span>
                    <span className="hq-mono shrink-0 text-[10px] uppercase text-ink-soft">
                      {stamp(h.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {vacant.length > 0 && (
            <Panel i={12} label="Captaincies vacant" status={<Dot tone="alert" pulse />}>
              <ul className="flex flex-col">
                {vacant.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 border-b border-rule/60 py-2 last:border-0"
                  >
                    <span className="truncate text-[13px] text-ink">{v.name}</span>
                    <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                      {v.members} posted · no captain
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

/** One tier of the command ladder — rank, holders, and what they may do. */
function Tier({
  rank,
  title,
  who,
  blurb,
  tone,
}: {
  rank: string;
  title: string;
  who: Profile[];
  blurb: string;
  tone: "warn" | "live" | "info";
}) {
  return (
    <li className="rounded-[3px] border border-rule p-3">
      <div className="flex items-center gap-2">
        <span className="hq-mono text-[10px] tracking-[0.14em] text-ink-soft">{rank}</span>
        <span
          className="hq-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{
            color:
              tone === "warn"
                ? "var(--color-sand)"
                : tone === "live"
                  ? "var(--color-moss)"
                  : "var(--color-ink)",
          }}
        >
          {title}
        </span>
        <span className="hq-mono ml-auto text-[11px] text-ink-soft">{who.length}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {who.length === 0 ? (
          <span className="hq-mono text-[11px] text-ink-soft">Nobody holds this</span>
        ) : (
          who.slice(0, 6).map((p) => (
            <Link key={p.id} href={`/hq/personnel/${p.id}`} className="flex items-center gap-1.5">
              <Avatar name={p.name} avatarUrl={p.avatar_url} colour={p.colour} size={18} />
              <span className="text-[12px] text-ink hover:underline">{p.name}</span>
            </Link>
          ))
        )}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">{blurb}</p>
    </li>
  );
}
