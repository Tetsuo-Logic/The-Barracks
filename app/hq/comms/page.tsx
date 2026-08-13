import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { resolveViewRole, realRoleOf } from "@/lib/hq/role";
import { createClient } from "@/lib/supabase/server";
import { getActivityFeed, type ActivityItem } from "@/lib/queries";
import { relativeTime, heroDate, shortDate } from "@/lib/dates";
import { Panel, Stat, Dot, Tag, Meter, PageHead, Nil } from "@/components/hq/Kit";
import { Composer } from "@/components/hq/comms/Composer";
import { RespondBar } from "@/components/hq/comms/RespondBar";
import type { Broadcast, BroadcastMessage, BroadcastResponse, Profile } from "@/lib/types";

export const metadata = { title: "Comms · Barracks HQ" };

const KIND_LABEL: Record<string, string> = {
  announce: "Notice",
  yesno: "Yes / No",
  ask: "Question",
  dates: "Dates poll",
};

const KIND_TONE: Record<string, "live" | "warn" | "alert" | "info" | "idle"> = {
  announce: "info",
  yesno: "live",
  ask: "warn",
  dates: "warn",
};

// Comms dispatch. The transmitter on the left, every signal ever sent down the
// middle, and the selected signal opened up on the right — who answered, who
// hasn't, and the thread underneath it. All real rows.
export default async function CommsPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string; as?: string }>;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const selectedId = sp.b;
  // Planning is a Captain/President surface — a member never sees a route into
  // it, here or anywhere else. Follows the dev role preview so it's testable.
  const canPlan = resolveViewRole(sp.as, await realRoleOf(profile)) !== "member";

  const supabase = await createClient();

  const [{ data: bxRows }, { data: respRows }, { data: profileRows }, activity] =
    await Promise.all([
      supabase.from("broadcasts").select("*").order("created_at", { ascending: false }),
      supabase.from("broadcast_responses").select("*"),
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      getActivityFeed(profile.id, profile.is_admin),
    ]);

  const broadcasts = (bxRows ?? []) as Broadcast[];
  const responses = (respRows ?? []) as BroadcastResponse[];
  const profiles = (profileRows ?? []) as Profile[];
  const nameById = new Map(profiles.map((p) => [p.id, p.nickname || p.name]));
  const totalPlayers = profiles.length;

  const respByBroadcast = new Map<string, BroadcastResponse[]>();
  for (const r of responses) {
    const arr = respByBroadcast.get(r.broadcast_id) ?? [];
    arr.push(r);
    respByBroadcast.set(r.broadcast_id, arr);
  }

  const selected = broadcasts.find((x) => x.id === selectedId) ?? broadcasts[0] ?? null;

  // Thread for the open signal — append-only, newest last.
  let thread: BroadcastMessage[] = [];
  if (selected) {
    const { data } = await supabase
      .from("broadcast_messages")
      .select("*")
      .eq("broadcast_id", selected.id)
      .order("created_at", { ascending: true });
    thread = (data ?? []) as BroadcastMessage[];
  }

  // System traffic — real events off the activity feed, rendered as the
  // machine's own transmissions alongside the human ones.
  const system = activity.items
    .filter((i): i is Exclude<ActivityItem, { kind: "broadcast" }> => i.kind !== "broadcast")
    .slice(0, 12)
    .map((i) => {
      switch (i.kind) {
        case "round":
          return { at: i.at, text: `OPERATION SCHEDULED — ${(i.comp.title || i.comp.game).toUpperCase()}`, tone: "info" as const };
        case "result":
          return { at: i.at, text: `RESULT POSTED — ${(i.comp.title || i.comp.game).toUpperCase()}`, tone: "live" as const };
        case "muster":
          return { at: i.at, text: `MUSTER CALLED — ${i.squadName.toUpperCase()}`, tone: "warn" as const };
        case "night":
          return { at: i.at, text: `NIGHT WANTED — ${i.squadName.toUpperCase()}`, tone: "warn" as const };
        case "trial":
          return { at: i.at, text: `COURT CASE ${i.trial.status === "open" ? "OPENED" : "CLOSED"}`, tone: "alert" as const };
        case "complaint":
          return { at: i.at, text: `COMPLAINT FILED — ${i.filerName.toUpperCase()}`, tone: "alert" as const };
        case "mutiny":
          return { at: i.at, text: `MOTION ${i.mutiny.status.toUpperCase()} — ${i.raiserName.toUpperCase()}`, tone: "alert" as const };
        case "squadReq":
          return { at: i.at, text: `SQUAD REQUESTED — ${i.requesterName.toUpperCase()}`, tone: "warn" as const };
        case "comment":
          return { at: i.at, text: `${i.authorName.toUpperCase()} COMMENTED`, tone: "info" as const };
      }
    });

  // Strip stats
  const openSignals = broadcasts.filter((x) => x.kind !== "announce");
  const awaiting = openSignals.filter(
    (x) => (respByBroadcast.get(x.id)?.length ?? 0) < totalPlayers,
  ).length;
  const answeredTotal = openSignals.reduce((n, x) => n + (respByBroadcast.get(x.id)?.length ?? 0), 0);
  const expected = openSignals.length * Math.max(1, totalPlayers);
  const responseRate = expected ? Math.round((answeredTotal / expected) * 100) : 0;
  const mineUnanswered = openSignals.filter(
    (x) => x.created_by !== profile.id && !(respByBroadcast.get(x.id) ?? []).some((r) => r.player_id === profile.id),
  ).length;

  // ── The open signal, unpacked ──────────────────────────────────────────
  const sel = selected ? respByBroadcast.get(selected.id) ?? [] : [];
  const yes = sel.filter((r) => r.answer === "yes").length;
  const no = sel.filter((r) => r.answer === "no").length;
  const silent = Math.max(0, totalPlayers - sel.length);
  const mine = selected ? sel.find((r) => r.player_id === profile.id) ?? null : null;

  const dateTally =
    selected?.kind === "dates" && selected.option_dates
      ? selected.option_dates.map((iso) => ({
          iso,
          count: sel.filter((r) => (r.available_dates ?? []).includes(iso)).length,
        }))
      : [];
  const bestDate = dateTally.length
    ? dateTally.reduce((b, d) => (d.count > b.count ? d : b), dateTally[0])
    : null;

  return (
    <div>
      <PageHead
        eyebrow="Command"
        title="Comms Dispatch"
        right={
          <>
            <Tag tone={profile.is_admin ? "live" : "idle"}>
              {profile.is_admin ? "Transmit clearance" : "Receive only"}
            </Tag>
            {canPlan && (
              <Link
                href="/hq/availability"
                className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
              >
                Planning
              </Link>
            )}
          </>
        }
      >
        {broadcasts.length} signal{broadcasts.length === 1 ? "" : "s"} on record ·{" "}
        {mineUnanswered > 0 ? (
          <span style={{ color: "var(--color-flag)" }}>{mineUnanswered} awaiting your answer</span>
        ) : (
          <>nothing awaiting your answer</>
        )}
      </PageHead>

      {/* ── Status strip ──────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Panel i={0}>
          <Stat value={broadcasts.length} label="Signals sent" />
        </Panel>
        <Panel i={1}>
          <Stat value={openSignals.length} label="Answerable" sub={`${broadcasts.length - openSignals.length} notices`} />
        </Panel>
        <Panel i={2}>
          <Stat value={awaiting} label="Awaiting replies" tone={awaiting > 0 ? "warn" : undefined} />
        </Panel>
        <Panel i={3}>
          <Stat value={`${responseRate}%`} label="Response rate" tone={responseRate >= 70 ? "live" : "warn"} />
        </Panel>
        <Panel i={4}>
          <Stat value={totalPlayers} label="On the net" sub="All operatives reachable" />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[330px_minmax(280px,0.95fr)_1.2fr]">
        {/* ── Transmitter ───────────────────────────────────────────── */}
        <Panel
          i={5}
          sweep
          label="Transmitter"
          status={<Dot tone={profile.is_admin ? "live" : "idle"} pulse={profile.is_admin} />}
          pad={false}
        >
          <Composer canSend={profile.is_admin} callsign={profile.nickname || profile.name} />
        </Panel>

        {/* ── Traffic ───────────────────────────────────────────────── */}
        <Panel
          i={6}
          label="Signal traffic"
          right={<span className="hq-mono text-[11px] text-ink-soft">{broadcasts.length}</span>}
          pad={false}
        >
          <div className="max-h-[720px] overflow-y-auto">
            {broadcasts.length === 0 ? (
              <Nil>No signals transmitted</Nil>
            ) : (
              <ul className="flex flex-col">
                {broadcasts.map((x, i) => {
                  const rs = respByBroadcast.get(x.id) ?? [];
                  const on = selected?.id === x.id;
                  const answered = rs.some((r) => r.player_id === profile.id);
                  return (
                    <li key={x.id}>
                      <Link
                        href={`/hq/comms?b=${x.id}`}
                        scroll={false}
                        className="hq-rise block border-b border-rule/60 px-3 py-2.5 transition-colors hover:bg-[rgba(255,255,255,0.025)]"
                        style={{
                          ["--i" as string]: Math.min(i, 10),
                          backgroundColor: on ? "rgba(245,182,61,0.07)" : undefined,
                          borderLeft: on ? "2px solid var(--color-sand)" : "2px solid transparent",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Tag tone={KIND_TONE[x.kind]}>{KIND_LABEL[x.kind]}</Tag>
                          {x.kind !== "announce" && !answered && x.created_by !== profile.id && (
                            <Tag tone="alert" solid>
                              Answer
                            </Tag>
                          )}
                          <span className="hq-mono ml-auto shrink-0 text-[10px] text-ink-soft">
                            {relativeTime(x.created_at)}
                          </span>
                        </div>
                        {x.title && (
                          <p className="hq-readout mt-1 truncate text-[14px] font-bold">{x.title}</p>
                        )}
                        <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-soft">{x.body}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <Meter
                              pct={totalPlayers ? (rs.length / totalPlayers) * 100 : 0}
                              tone={rs.length >= totalPlayers ? "live" : "warn"}
                            />
                          </div>
                          <span className="hq-mono shrink-0 text-[10px] text-ink-soft">
                            {x.kind === "announce" ? "—" : `${rs.length}/${totalPlayers}`}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* System traffic */}
          <div className="border-t border-rule">
            <p className="hq-label px-3 py-2">System traffic</p>
            <ul className="max-h-[220px] overflow-y-auto pb-2">
              {system.length === 0 ? (
                <Nil>Quiet on the net</Nil>
              ) : (
                system.map((s, i) => (
                  <li key={`${s.at}-${i}`} className="flex items-center gap-2.5 px-3 py-1">
                    <Dot tone={s.tone} />
                    <span className="hq-mono min-w-0 flex-1 truncate text-[10px] tracking-[0.06em] text-ink-soft">
                      {s.text}
                    </span>
                    <span className="hq-mono shrink-0 text-[9px] text-ink-soft">{relativeTime(s.at)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </Panel>

        {/* ── Detail ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {!selected ? (
            <Panel i={7} label="Signal detail">
              <Nil>Select a signal to read its traffic</Nil>
            </Panel>
          ) : (
            <>
              <Panel
                i={7}
                label={`Signal · ${KIND_LABEL[selected.kind]}`}
                status={<Dot tone={KIND_TONE[selected.kind]} />}
                right={
                  <span className="hq-mono text-[11px] text-ink-soft">
                    {shortDate(selected.created_at.slice(0, 10))} · {relativeTime(selected.created_at)}
                  </span>
                }
              >
                <p className="hq-label mb-1">
                  From {selected.created_by ? nameById.get(selected.created_by) ?? "Command" : "Command"}
                </p>
                {selected.title && (
                  <h3 className="hq-readout text-[20px] font-bold leading-tight">{selected.title}</h3>
                )}
                <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed">{selected.body}</p>

                {/* Tally */}
                {selected.kind === "yesno" && (
                  <div className="mt-4 grid grid-cols-3 gap-4 border-t border-rule pt-3">
                    <Stat value={yes} label="In" tone="live" />
                    <Stat value={no} label="Out" tone="alert" />
                    <Stat value={silent} label="Silent" />
                  </div>
                )}

                {selected.kind === "dates" && dateTally.length > 0 && (
                  <div className="mt-4 border-t border-rule pt-3">
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="hq-label">Night tally</span>
                      {bestDate && bestDate.count > 0 && (
                        <span className="hq-mono text-[11px]" style={{ color: "var(--color-moss)" }}>
                          BEST · {heroDate(bestDate.iso).dow} {heroDate(bestDate.iso).day} · {bestDate.count} ON
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {dateTally.map((d) => {
                        const hd = heroDate(d.iso);
                        const best = bestDate?.iso === d.iso && d.count > 0;
                        return (
                          <div key={d.iso} className="flex items-center gap-2.5">
                            <span className="hq-mono w-16 shrink-0 text-[11px] uppercase tracking-[0.08em]">
                              {hd.dow} {hd.day}
                            </span>
                            <div className="min-w-0 flex-1">
                              <Meter
                                pct={totalPlayers ? (d.count / totalPlayers) * 100 : 0}
                                tone={best ? "live" : "warn"}
                              />
                            </div>
                            <span className="hq-mono w-10 shrink-0 text-right text-[11px] text-ink-soft">
                              {d.count}/{totalPlayers}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selected.kind === "ask" && (
                  <div className="mt-4 grid grid-cols-2 gap-4 border-t border-rule pt-3">
                    <Stat value={sel.filter((r) => r.comment).length} label="Replied" tone="live" />
                    <Stat value={silent} label="Silent" />
                  </div>
                )}
              </Panel>

              <Panel i={8} label="Responses" right={<span className="hq-mono text-[11px] text-ink-soft">{sel.length}/{totalPlayers}</span>}>
                {profiles.length === 0 ? (
                  <Nil>No operatives</Nil>
                ) : (
                  <ul className="flex flex-col">
                    {profiles.map((p) => {
                      const r = sel.find((x) => x.player_id === p.id);
                      const tone = !r ? "idle" : r.answer === "yes" ? "live" : r.answer === "no" ? "alert" : "warn";
                      const label = !r
                        ? "No response"
                        : r.answer
                          ? r.answer.toUpperCase()
                          : (r.available_dates?.length ?? 0) > 0
                            ? `${r.available_dates!.length} nights`
                            : "Replied";
                      return (
                        <li key={p.id} className="flex items-center gap-2.5 border-b border-rule/50 py-1.5 last:border-0">
                          <Dot tone={tone} />
                          <span className="w-24 shrink-0 truncate text-[13px]">
                            {p.id === profile.id ? "You" : p.name}
                          </span>
                          <span className="hq-mono min-w-0 flex-1 truncate text-[11px] text-ink-soft">
                            {r?.comment ?? (r?.available_dates?.length ? r.available_dates.map((d) => heroDate(d).dow).join(" ") : "—")}
                          </span>
                          <span
                            className="hq-mono shrink-0 text-[10px] uppercase tracking-[0.12em]"
                            style={{
                              color:
                                tone === "live"
                                  ? "var(--color-moss)"
                                  : tone === "alert"
                                    ? "var(--color-flag)"
                                    : tone === "warn"
                                      ? "var(--color-sand)"
                                      : "var(--color-ink-soft)",
                            }}
                          >
                            {label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>

              <Panel i={9} label="Thread">
                {thread.length === 0 ? (
                  <Nil>No traffic on this thread</Nil>
                ) : (
                  <ul className="mb-3 flex flex-col gap-2">
                    {thread.map((t) => (
                      <li key={t.id} className="rounded-[3px] border border-rule px-3 py-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="hq-label">
                            {t.author_id ? nameById.get(t.author_id) ?? "Operative" : "Command"}
                          </span>
                          <span className="hq-mono text-[10px] text-ink-soft">{relativeTime(t.created_at)}</span>
                        </div>
                        <p className="mt-0.5 text-[13px]">{t.body}</p>
                      </li>
                    ))}
                  </ul>
                )}

                <RespondBar
                  broadcastId={selected.id}
                  kind={selected.kind}
                  myAnswer={mine?.answer ?? null}
                  myComment={mine?.comment ?? null}
                  optionDates={selected.option_dates ?? []}
                  myDates={mine?.available_dates ?? []}
                />
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
