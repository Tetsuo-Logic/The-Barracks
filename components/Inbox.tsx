import Link from "next/link";
import { MarkInboxSeen } from "@/components/MarkInboxSeen";
import { shortDate } from "@/lib/dates";
import { compHeading } from "@/lib/games";
import type { Inbox as InboxData } from "@/lib/queries";

// A home-screen strip of everything waiting for you — questions to answer,
// rounds that still need your RSVP, and new comments — so a missed push
// notification never means a missed thing. Mirrors the header bell count.
export function Inbox({ inbox }: { inbox: InboxData }) {
  const { asks, rsvpNeeded, newComments, newAnswers, total } = inbox;
  if (total === 0) return null;

  return (
    <div
      id="asks"
      className="mb-6 scroll-mt-20 rounded-[3px] border border-flag/50 bg-card p-4"
    >
      <MarkInboxSeen when={newComments.length > 0 || newAnswers.length > 0} />
      <p className="label mb-2" style={{ color: "var(--color-flag)" }}>
        Waiting on you
      </p>

      <ul className="flex flex-col divide-y divide-rule">
        {asks.map((b) => (
          <li key={`ask-${b.id}`}>
            <Link
              href={`/broadcast/${b.id}`}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-ink">
                {b.title ? `${b.title}: ` : ""}
                {b.body}
              </span>
              <span className="shrink-0 rounded-[3px] bg-flag px-3 py-1 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-paper">
                {b.kind === "yesno" ? "Answer" : b.kind === "dates" ? "Pick dates" : "Reply"}
              </span>
            </Link>
          </li>
        ))}

        {rsvpNeeded.map((c) => (
          <li key={`rsvp-${c.id}`}>
            <Link
              href={`/comp/${c.id}`}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-ink">
                {compHeading(c)}
                <span className="text-ink-soft"> · {shortDate(c.date)}</span>
              </span>
              <span className="shrink-0 rounded-[3px] bg-flag px-3 py-1 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-paper">
                Roll call
              </span>
            </Link>
          </li>
        ))}

        {newAnswers.map(({ broadcast, count }) => (
          <li key={`ans-${broadcast.id}`}>
            <Link
              href={`/broadcast/${broadcast.id}`}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-ink-soft">
                <span className="text-ink">
                  {count} new {count === 1 ? "answer" : "answers"}
                </span>{" "}
                on “{broadcast.title || broadcast.body}”
              </span>
              <span className="shrink-0 rounded-[3px] border border-rule px-3 py-1 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
                View
              </span>
            </Link>
          </li>
        ))}

        {newComments.map(({ comment, comp }) => (
          <li key={`cmt-${comment.id}`}>
            <Link
              href={`/comp/${comp.id}`}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-ink-soft">
                <span className="text-ink">{compHeading(comp)}</span> — “{comment.body}”
              </span>
              <span className="shrink-0 rounded-[3px] border border-rule px-3 py-1 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
                New
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
