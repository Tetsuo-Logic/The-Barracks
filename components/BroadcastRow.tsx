import Link from "next/link";
import { relativeTime } from "@/lib/dates";
import type { Broadcast, BroadcastResponse } from "@/lib/types";

const KIND_LABEL: Record<string, string> = {
  announce: "Notice",
  yesno: "Yes / No",
  ask: "Question",
};

export function BroadcastRow({
  broadcast,
  responses,
  totalPlayers,
  answered,
}: {
  broadcast: Broadcast;
  responses: BroadcastResponse[];
  totalPlayers: number;
  answered: boolean;
}) {
  const yes = responses.filter((r) => r.answer === "yes").length;
  const no = responses.filter((r) => r.answer === "no").length;
  const replies = responses.filter((r) => r.comment).length;

  return (
    <Link href={`/broadcast/${broadcast.id}`} className="block border-b border-rule py-3">
      <div className="flex items-center justify-between">
        <span className="label">{KIND_LABEL[broadcast.kind]}</span>
        <span className="flex items-center gap-2 text-xs text-ink-soft">
          {!answered && broadcast.kind !== "announce" && (
            <span className="rounded-full bg-flag px-2 py-0.5 font-narrow font-semibold uppercase tracking-[0.06em] text-paper">
              Answer
            </span>
          )}
          {relativeTime(broadcast.created_at)}
        </span>
      </div>
      {broadcast.title && <p className="mt-1 font-semibold text-ink">{broadcast.title}</p>}
      <p className="text-ink">{broadcast.body}</p>
      {broadcast.kind === "yesno" && (
        <p className="mt-1 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
          {yes} in · {no} out · {totalPlayers - yes - no} to answer
        </p>
      )}
      {broadcast.kind === "ask" && (
        <p className="mt-1 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
          {replies} of {totalPlayers} replied
        </p>
      )}
    </Link>
  );
}
