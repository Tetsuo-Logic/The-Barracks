import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BroadcastCompose } from "@/components/BroadcastCompose";
import { BroadcastRow } from "@/components/BroadcastRow";
import { EmptyState } from "@/components/EmptyState";
import { Avatar } from "@/components/Avatar";
import { relativeTime } from "@/lib/dates";
import type { Broadcast, BroadcastResponse, Profile, Trial } from "@/lib/types";

export default async function BroadcastPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: broadcasts }, { data: responses }, { data: profiles }, { data: trials }] =
    await Promise.all([
      supabase.from("broadcasts").select("*").order("created_at", { ascending: false }),
      supabase.from("broadcast_responses").select("*"),
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("trials").select("*").order("created_at", { ascending: false }),
    ]);

  const allProfiles = (profiles ?? []) as Profile[];
  const byId = new Map(allProfiles.map((p) => [p.id, p]));
  const totalPlayers = allProfiles.length;

  const byBroadcast = new Map<string, BroadcastResponse[]>();
  for (const r of (responses ?? []) as BroadcastResponse[]) {
    (byBroadcast.get(r.broadcast_id) ?? byBroadcast.set(r.broadcast_id, []).get(r.broadcast_id)!).push(r);
  }

  // Merge broadcasts and trials into one time-sorted feed.
  type Item =
    | { type: "broadcast"; at: string; data: Broadcast }
    | { type: "trial"; at: string; data: Trial };
  const feed: Item[] = [
    ...((broadcasts ?? []) as Broadcast[]).map((b) => ({ type: "broadcast" as const, at: b.created_at, data: b })),
    ...((trials ?? []) as Trial[]).map((t) => ({ type: "trial" as const, at: t.created_at, data: t })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="label">Messages</p>
        <Link href="/" className="label text-ink-soft">← Fixtures</Link>
      </div>

      {profile.is_admin && (
        <div className="mb-8">
          <BroadcastCompose candidates={allProfiles.filter((p) => p.id !== profile.id)} />
        </div>
      )}

      {feed.length === 0 ? (
        <EmptyState>
          {profile.is_admin ? "Nothing sent yet. Ping the lads above." : "Nothing to answer. All quiet."}
        </EmptyState>
      ) : (
        <div>
          {feed.map((item) =>
            item.type === "broadcast" ? (
              <BroadcastRow
                key={`b-${item.data.id}`}
                broadcast={item.data}
                responses={byBroadcast.get(item.data.id) ?? []}
                totalPlayers={totalPlayers}
                answered={(byBroadcast.get(item.data.id) ?? []).some((r) => r.player_id === profile.id)}
              />
            ) : (
              <TrialFeedRow key={`t-${item.data.id}`} trial={item.data} byId={byId} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function TrialFeedRow({
  trial,
  byId,
}: {
  trial: Trial;
  byId: Map<string, Profile>;
}) {
  const accused = byId.get(trial.defendant_id);
  const jury = [...byId.values()]
    .filter((p) => p.id !== trial.defendant_id)
    .map((p) => p.nickname ?? p.name)
    .join(", ");

  return (
    <Link href={`/trial/${trial.id}`} className="block border-b border-rule py-3">
      <div className="flex items-center justify-between">
        <span className="label" style={{ color: "var(--color-flag)" }}>The Courtroom</span>
        <span className="flex items-center gap-2 text-xs text-ink-soft">
          <span
            className="font-narrow font-semibold uppercase tracking-[0.06em]"
            style={{
              color:
                trial.status === "open"
                  ? "var(--color-sand)"
                  : trial.verdict === "guilty"
                    ? "var(--color-flag)"
                    : "var(--color-moss)",
            }}
          >
            {trial.status === "open" ? "In session" : trial.verdict === "guilty" ? "Guilty" : "Not guilty"}
          </span>
          {relativeTime(trial.created_at)}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Avatar name={accused?.name ?? "?"} avatarUrl={accused?.avatar_url} colour={accused?.colour} size={22} />
        <span className="text-ink">
          <span className="font-semibold">{accused?.name}</span> — {trial.charge}
        </span>
      </div>
      {jury && (
        <p className="mt-1 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
          Jury: {jury}
        </p>
      )}
    </Link>
  );
}
