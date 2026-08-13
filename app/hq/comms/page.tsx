import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { resolveViewRole, realRoleOf } from "@/lib/hq/role";
import { createClient } from "@/lib/supabase/server";
import { relativeTime, shortDate, heroDate } from "@/lib/dates";
import { Panel, Dot, Tag, Meter, PageHead, Nil } from "@/components/hq/Kit";
import { Transmitter } from "@/components/hq/comms/Transmitter";
import { RespondBar } from "@/components/hq/comms/RespondBar";
import { KIND_LABEL, KIND_TONE } from "@/components/hq/comms/kinds";
import type { Broadcast, BroadcastMessage, BroadcastResponse, Profile } from "@/lib/types";

export const metadata = { title: "Comms · Barracks HQ" };

// ── COMMS ──────────────────────────────────────────────────────────────────
// The PA system. Command speaks to the Barracks and, where it wants one, gets
// an answer back. That is the whole job.
//
// Not here, deliberately: musters, planning, Court, scheduling, requests, or
// generic system activity. Those are workflows with their own screens, and
// pouring them in here is what turned Comms into a second activity feed. NAAFI
// is separate too — Comms is Command broadcasting, NAAFI is people talking.

type Filter = "all" | "notices" | "questions" | "polls" | "awaiting";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "notices", label: "Notices" },
  { key: "questions", label: "Questions" },
  { key: "polls", label: "Polls" },
  { key: "awaiting", label: "Awaiting reply" },
];

export default async function CommsPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string; as?: string; f?: string }>;
}) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const openId = sp.b ?? null;
  const filter: Filter = (FILTERS.find((f) => f.key === sp.f)?.key ?? "all") as Filter;
  const canTransmit = resolveViewRole(sp.as, await realRoleOf(profile)) === "president";

  const supabase = await createClient();
  const [{ data: bxRows }, { data: respRows }, { data: profileRows }] = await Promise.all([
    supabase.from("broadcasts").select("*").order("created_at", { ascending: false }),
    supabase.from("broadcast_responses").select("*"),
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
  ]);

  const broadcasts = (bxRows ?? []) as Broadcast[];
  const responses = (respRows ?? []) as BroadcastResponse[];
  const profiles = (profileRows ?? []) as Profile[];
  const nameById = new Map(profiles.map((p) => [p.id, p.nickname || p.name]));
  const onNet = profiles.length;

  const respByBroadcast = new Map<string, BroadcastResponse[]>();
  for (const r of responses) {
    const arr = respByBroadcast.get(r.broadcast_id) ?? [];
    arr.push(r);
    respByBroadcast.set(r.broadcast_id, arr);
  }

  const answerable = (b: Broadcast) => b.kind !== "announce";
  const iAnswered = (b: Broadcast) =>
    (respByBroadcast.get(b.id) ?? []).some((r) => r.player_id === profile.id);
  const needsMe = (b: Broadcast) => answerable(b) && b.created_by !== profile.id && !iAnswered(b);

  const shown = broadcasts.filter((b) => {
    switch (filter) {
      case "notices":
        return b.kind === "announce";
      case "questions":
        return b.kind === "ask" || b.kind === "yesno";
      case "polls":
        return b.kind === "poll" || b.kind === "dates";
      case "awaiting":
        return needsMe(b);
      default:
        return true;
    }
  });

  const awaitingMe = broadcasts.filter(needsMe).length;

  // The open transmission's thread — only fetched when one is open.
  let thread: BroadcastMessage[] = [];
  if (openId) {
    const { data } = await supabase
      .from("broadcast_messages")
      .select("*")
      .eq("broadcast_id", openId)
      .order("created_at", { ascending: true });
    thread = (data ?? []) as BroadcastMessage[];
  }

  const url = (patch: { b?: string | null; f?: Filter | null }) => {
    const q = new URLSearchParams();
    if (sp.as) q.set("as", sp.as);
    const f = patch.f !== undefined ? patch.f : filter === "all" ? null : filter;
    const b = patch.b !== undefined ? patch.b : openId;
    if (f && f !== "all") q.set("f", f);
    if (b) q.set("b", b);
    const s = q.toString();
    return s ? `/hq/comms?${s}` : "/hq/comms";
  };

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 1180 }}>
      <PageHead eyebrow="Command" title="Comms">
        {canTransmit
          ? "The Barracks PA — speak to everyone, and get an answer where you need one"
          : awaitingMe > 0
            ? <>
                <span style={{ color: "var(--color-flag)" }}>{awaitingMe}</span> transmission
                {awaitingMe === 1 ? "" : "s"} awaiting your reply
              </>
            : "Nothing awaiting your reply"}
      </PageHead>

      {/* ── TRANSMIT ─────────────────────────────────────────────────────
          President only. Everyone else receives and replies. */}
      {canTransmit && (
        <div className="mb-5">
          <Panel i={0} tier="primary" label="Transmit to the Barracks" status={<Dot tone="live" pulse />} pad={false}>
            <Transmitter callsign={profile.nickname || profile.name} />
          </Panel>
        </div>
      )}

      {/* ── TRANSMISSIONS ────────────────────────────────────────────── */}
      <Panel
        i={1}
        label="Transmissions"
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => {
              const on = f.key === filter;
              const n = f.key === "awaiting" ? awaitingMe : null;
              return (
                <Link
                  key={f.key}
                  href={url({ f: f.key === "all" ? null : f.key, b: null })}
                  scroll={false}
                  className="hq-mono rounded-[3px] border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                  style={{
                    borderColor: on ? "var(--color-sand)" : "var(--color-rule)",
                    backgroundColor: on ? "rgba(245,182,61,0.12)" : "transparent",
                    color: on ? "var(--color-sand)" : "var(--color-ink-soft)",
                  }}
                >
                  {f.label}
                  {n != null && n > 0 && <span className="ml-1.5">{n}</span>}
                </Link>
              );
            })}
          </div>
        }
        pad={false}
      >
        {shown.length === 0 ? (
          <Nil>{filter === "all" ? "Nothing transmitted yet" : "Nothing under this filter"}</Nil>
        ) : (
          <ul className="flex flex-col divide-y divide-rule/60">
            {shown.map((b) => {
              const rs = respByBroadcast.get(b.id) ?? [];
              const open = openId === b.id;
              const mine = rs.find((r) => r.player_id === profile.id) ?? null;
              const from = b.created_by ? (nameById.get(b.created_by) ?? "Command") : "Command";

              return (
                <li key={b.id}>
                  {/* The row itself — type, preview, sender, when, response count */}
                  <Link
                    href={url({ b: open ? null : b.id })}
                    scroll={false}
                    className="block px-4 py-3 transition-colors hover:bg-[rgba(255,255,255,0.025)]"
                    style={open ? { backgroundColor: "rgba(245,182,61,0.06)" } : undefined}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag tone={KIND_TONE[b.kind]}>{KIND_LABEL[b.kind]}</Tag>
                      {needsMe(b) && (
                        <Tag tone="alert" solid>
                          Reply needed
                        </Tag>
                      )}
                      <span className="hq-mono ml-auto shrink-0 text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                        {from} · {shortDate(b.created_at.slice(0, 10))} · {relativeTime(b.created_at)}
                      </span>
                    </div>

                    <p className="hq-readout mt-1.5 truncate text-[16px] font-bold">
                      {b.title || b.body}
                    </p>
                    {b.title && <p className="mt-0.5 truncate text-[13px] text-ink-soft">{b.body}</p>}

                    {answerable(b) && (
                      <div className="mt-2 flex items-center gap-3">
                        <div className="max-w-[280px] flex-1">
                          <Meter
                            pct={onNet ? (rs.length / onNet) * 100 : 0}
                            tone={rs.length >= onNet ? "live" : "warn"}
                          />
                        </div>
                        <span className="hq-mono shrink-0 text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                          {rs.length}/{onNet} replied
                        </span>
                        <span className="hq-label ml-auto shrink-0 opacity-70">
                          {open ? "Close ▴" : "Open ▾"}
                        </span>
                      </div>
                    )}
                  </Link>

                  {/* ── Opened: full message, responses, thread ───────── */}
                  {open && (
                    <div className="border-t border-rule px-4 py-4">
                      <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{b.body}</p>

                      {/* Tally, per type */}
                      {b.kind === "yesno" && (
                        <div className="mt-4 flex flex-wrap gap-6 border-t border-rule pt-3">
                          {(
                            [
                              ["Yes", rs.filter((r) => r.answer === "yes").length, "var(--color-moss)"],
                              ["No", rs.filter((r) => r.answer === "no").length, "var(--color-flag)"],
                              ["Silent", Math.max(0, onNet - rs.length), "var(--color-ink-soft)"],
                            ] as const
                          ).map(([k, v, c]) => (
                            <div key={k}>
                              <div className="hq-readout text-[26px] font-bold leading-none" style={{ color: c }}>
                                {v}
                              </div>
                              <div className="hq-label mt-1">{k}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {b.kind === "poll" && (b.options ?? []).length > 0 && (
                        <div className="mt-4 flex flex-col gap-1.5 border-t border-rule pt-3">
                          {(b.options ?? []).map((o) => {
                            const n = rs.filter((r) => r.choice === o).length;
                            return (
                              <div key={o} className="flex items-center gap-3">
                                <span className="w-[180px] shrink-0 truncate text-[13px]">{o}</span>
                                <div className="min-w-0 flex-1">
                                  <Meter pct={onNet ? (n / onNet) * 100 : 0} tone="live" />
                                </div>
                                <span className="hq-mono w-12 shrink-0 text-right text-[11px] text-ink-soft">
                                  {n}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Legacy availability polls — Planning owns scheduling now,
                          but these rows are real history and still read. */}
                      {b.kind === "dates" && (b.option_dates ?? []).length > 0 && (
                        <div className="mt-4 flex flex-col gap-1.5 border-t border-rule pt-3">
                          {(b.option_dates ?? []).map((iso) => {
                            const hd = heroDate(iso);
                            const n = rs.filter((r) => (r.available_dates ?? []).includes(iso)).length;
                            return (
                              <div key={iso} className="flex items-center gap-3">
                                <span className="hq-mono w-[180px] shrink-0 text-[12px] uppercase tracking-[0.08em]">
                                  {hd.dow} {hd.day} {hd.mon}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <Meter pct={onNet ? (n / onNet) * 100 : 0} tone="live" />
                                </div>
                                <span className="hq-mono w-12 shrink-0 text-right text-[11px] text-ink-soft">
                                  {n}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Who said what */}
                      {answerable(b) && (
                        <div className="mt-4 border-t border-rule pt-3">
                          <p className="hq-label mb-2">
                            Responses · {rs.length}/{onNet}
                          </p>
                          <ul className="flex flex-col">
                            {profiles.map((p) => {
                              const r = rs.find((x) => x.player_id === p.id);
                              const tone = !r
                                ? "idle"
                                : r.answer === "yes"
                                  ? "live"
                                  : r.answer === "no"
                                    ? "alert"
                                    : "warn";
                              const said =
                                r?.comment ??
                                r?.choice ??
                                (r?.answer ? r.answer.toUpperCase() : null) ??
                                (r?.available_dates?.length
                                  ? r.available_dates.map((d) => heroDate(d).dow).join(" ")
                                  : "—");
                              return (
                                <li
                                  key={p.id}
                                  className="flex items-center gap-2.5 border-b border-rule/50 py-1.5 last:border-0"
                                >
                                  <Dot tone={tone} />
                                  <span className="w-28 shrink-0 truncate text-[13px]">
                                    {p.id === profile.id ? "You" : p.name}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">
                                    {r ? said : "No response"}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {/* Discussion */}
                      {thread.length > 0 && (
                        <div className="mt-4 border-t border-rule pt-3">
                          <p className="hq-label mb-2">Replies</p>
                          <ul className="flex flex-col gap-2">
                            {thread.map((t) => (
                              <li key={t.id} className="rounded-[3px] border border-rule px-3 py-2">
                                <div className="flex items-baseline justify-between gap-3">
                                  <span className="hq-label">
                                    {t.author_id ? (nameById.get(t.author_id) ?? "Operative") : "Command"}
                                  </span>
                                  <span className="hq-mono text-[10px] text-ink-soft">
                                    {relativeTime(t.created_at)}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[13px]">{t.body}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-4 border-t border-rule pt-3">
                        <RespondBar
                          broadcastId={b.id}
                          kind={b.kind}
                          myAnswer={mine?.answer ?? null}
                          myComment={mine?.comment ?? null}
                          optionDates={b.option_dates ?? []}
                          myDates={mine?.available_dates ?? []}
                          options={b.options ?? []}
                          myChoice={mine?.choice ?? null}
                        />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
