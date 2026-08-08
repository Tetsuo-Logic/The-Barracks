import Link from "next/link";
import { BroadcastRow } from "@/components/BroadcastRow";
import { Avatar } from "@/components/Avatar";
import { relativeTime, shortDate } from "@/lib/dates";
import type { Activity } from "@/lib/queries";
import type { Profile, Trial } from "@/lib/types";

// The shared, read-only history: every broadcast, round, result, comment and
// trial in one time-sorted feed. Everyone can browse it.
export function ActivityFeed({
  activity,
  currentUserId,
}: {
  activity: Activity;
  currentUserId: string;
}) {
  const { items, profiles, totalPlayers } = activity;
  const byId = new Map(profiles.map((p) => [p.id, p]));

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-soft">Nothing here yet.</p>;
  }

  return (
    <div>
      {items.map((item) => {
        switch (item.kind) {
          case "broadcast":
            return (
              <BroadcastRow
                key={`b-${item.broadcast.id}`}
                broadcast={item.broadcast}
                responses={item.responses}
                totalPlayers={totalPlayers}
                answered={item.answered}
              />
            );
          case "trial":
            return (
              <TrialRow key={`t-${item.trial.id}`} trial={item.trial} byId={byId} />
            );
          case "round":
            return (
              <Link
                key={`r-${item.comp.id}`}
                href={`/comp/${item.comp.id}`}
                className="block border-b border-rule py-3"
              >
                <div className="flex items-center justify-between">
                  <span className="label" style={{ color: "var(--color-moss)" }}>
                    Round added
                  </span>
                  <span className="text-xs text-ink-soft">{relativeTime(item.at)}</span>
                </div>
                <p className="mt-1 text-ink">
                  <span className="font-semibold">{item.comp.course}</span>
                  <span className="text-ink-soft"> · {shortDate(item.comp.date)}</span>
                </p>
              </Link>
            );
          case "result":
            return (
              <Link
                key={`res-${item.comp.id}`}
                href={`/comp/${item.comp.id}`}
                className="block border-b border-rule py-3"
              >
                <div className="flex items-center justify-between">
                  <span className="label" style={{ color: "var(--color-sand)" }}>
                    Result posted
                  </span>
                  <span className="text-xs text-ink-soft">{relativeTime(item.at)}</span>
                </div>
                <p className="mt-1 text-ink">
                  <span className="font-semibold">{item.comp.course}</span>
                  <span className="text-ink-soft"> · {shortDate(item.comp.date)}</span>
                </p>
              </Link>
            );
          case "comment": {
            const author = item.comment.author_id
              ? byId.get(item.comment.author_id)
              : undefined;
            return (
              <Link
                key={`c-${item.comment.id}`}
                href={`/comp/${item.comp.id}`}
                className="block border-b border-rule py-3"
              >
                <div className="flex items-center justify-between">
                  <span className="label">Comment</span>
                  <span className="text-xs text-ink-soft">{relativeTime(item.at)}</span>
                </div>
                <div className="mt-1 flex items-start gap-2">
                  <Avatar
                    name={author?.name ?? item.authorName}
                    avatarUrl={author?.avatar_url}
                    colour={author?.colour}
                    size={22}
                  />
                  <p className="flex-1 text-ink">
                    <span className="font-semibold">
                      {item.comment.author_id === currentUserId ? "You" : item.authorName}
                    </span>{" "}
                    on {item.comp.course} — “{item.comment.body}”
                  </p>
                </div>
              </Link>
            );
          }
        }
      })}
    </div>
  );
}

function TrialRow({ trial, byId }: { trial: Trial; byId: Map<string, Profile> }) {
  const accused = byId.get(trial.defendant_id);
  const jury = [...byId.values()]
    .filter((p) => p.id !== trial.defendant_id)
    .map((p) => p.nickname ?? p.name)
    .join(", ");

  return (
    <Link href={`/trial/${trial.id}`} className="block border-b border-rule py-3">
      <div className="flex items-center justify-between">
        <span className="label" style={{ color: "var(--color-flag)" }}>
          The Courtroom
        </span>
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
            {trial.status === "open"
              ? "In session"
              : trial.verdict === "guilty"
                ? "Guilty"
                : "Not guilty"}
          </span>
          {relativeTime(trial.created_at)}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Avatar
          name={accused?.name ?? "?"}
          avatarUrl={accused?.avatar_url}
          colour={accused?.colour}
          size={22}
        />
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
