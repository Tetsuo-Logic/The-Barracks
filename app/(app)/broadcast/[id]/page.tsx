import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BroadcastRespond } from "@/components/BroadcastRespond";
import { BroadcastThread } from "@/components/BroadcastThread";
import { Avatar } from "@/components/Avatar";
import { shortDate, shortTime } from "@/lib/dates";
import type { Broadcast, BroadcastMessage, BroadcastResponse, Profile } from "@/lib/types";

// The tee time a player gave for a specific date ('' / undefined if none).
function timeFor(r: BroadcastResponse, date: string): string {
  const i = r.available_dates?.indexOf(date) ?? -1;
  return i >= 0 ? shortTime(r.date_times?.[i] ?? "") : "";
}

export default async function BroadcastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: broadcast } = await supabase
    .from("broadcasts")
    .select("*")
    .eq("id", id)
    .single();
  if (!broadcast) notFound();
  const b = broadcast as Broadcast;

  const [{ data: responses }, { data: profiles }, { data: messages }] = await Promise.all([
    supabase.from("broadcast_responses").select("*").eq("broadcast_id", id),
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase
      .from("broadcast_messages")
      .select("*")
      .eq("broadcast_id", id)
      .order("created_at", { ascending: true }),
  ]);
  const rs = (responses ?? []) as BroadcastResponse[];
  const allProfiles = (profiles ?? []) as Profile[];
  const byPlayer = new Map(rs.map((r) => [r.player_id, r]));
  const mine = byPlayer.get(profile.id) ?? null;

  return (
    <div>
      <Link href="/broadcast" className="label mb-4 inline-block text-ink-soft">
        ← Messages
      </Link>

      {b.title && <h1 className="text-[20px] font-bold text-ink">{b.title}</h1>}
      <p className="mt-1 text-[16px] text-ink">{b.body}</p>

      <div className="mt-5">
        <BroadcastRespond broadcast={b} mine={mine} />
      </div>

      {/* date poll — availability tally, best day first */}
      {b.kind === "dates" && b.option_dates && (
        <div className="mt-6">
          <p className="label mb-2">Who can do what</p>
          <div className="overflow-hidden rounded-[3px] border border-rule">
            {[...b.option_dates]
              .map((d) => ({
                date: d,
                count: rs.filter((r) => r.available_dates?.includes(d)).length,
                times: rs
                  .map((r) => timeFor(r, d))
                  .filter((t): t is string => Boolean(t))
                  .sort(),
              }))
              .sort((a, z) => z.count - a.count)
              .map(({ date, count, times }, i) => {
                const best = i === 0 && count > 0;
                return (
                  <div
                    key={date}
                    className="border-t border-rule px-4 py-3 first:border-t-0"
                    style={{ backgroundColor: best ? "rgba(47,107,76,0.08)" : undefined }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-ink">{shortDate(date)}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-narrow text-sm font-semibold text-ink">
                          {count} can do
                        </span>
                        {best && (
                          <span className="font-narrow text-xs font-semibold uppercase tracking-[0.08em] text-moss">
                            Best
                          </span>
                        )}
                      </span>
                    </div>
                    {times.length > 0 && (
                      <p className="mt-0.5 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
                        Times that suit: {times.join(", ")}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* everyone can see who said what — it's a group of three */}
      <div className="mt-6">
        <p className="label mb-2">Answers</p>
        <ul className="flex flex-col gap-3">
          {allProfiles.map((p) => {
            const r = byPlayer.get(p.id);
            return (
              <li key={p.id} className="flex items-start gap-2">
                <Avatar name={p.name} avatarUrl={p.avatar_url} colour={p.colour} size={26} />
                <div className="flex-1">
                  <p className="flex items-center gap-2">
                    <span className="text-ink">{p.id === profile.id ? "You" : p.name}</span>
                    {r?.answer && (
                      <span
                        className="font-narrow text-xs font-semibold uppercase tracking-[0.08em]"
                        style={{ color: r.answer === "yes" ? "var(--color-moss)" : "var(--color-flag)" }}
                      >
                        {r.answer}
                      </span>
                    )}
                    {!r && (
                      <span className="font-narrow text-xs font-semibold uppercase tracking-[0.08em] text-rule">
                        —
                      </span>
                    )}
                  </p>
                  {b.kind === "dates" && r?.available_dates && (
                    <p className="text-sm text-ink-soft">
                      {r.available_dates.length
                        ? r.available_dates
                            .map((d) => {
                              const t = timeFor(r, d);
                              return t ? `${shortDate(d)} at ${t}` : shortDate(d);
                            })
                            .join(", ")
                        : "none of them"}
                    </p>
                  )}
                  {r?.comment && <p className="text-ink-soft">“{r.comment}”</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* reply thread — append-only, so you see the conversation over time */}
      <BroadcastThread
        broadcastId={id}
        messages={(messages ?? []) as BroadcastMessage[]}
        profiles={allProfiles}
        currentUserId={profile.id}
      />
    </div>
  );
}
