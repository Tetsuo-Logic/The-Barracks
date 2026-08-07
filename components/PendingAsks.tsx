import Link from "next/link";
import type { Broadcast } from "@/lib/types";

// A home-screen strip showing questions put to you that you haven't answered —
// so a Yes/No or Ask always reaches you, even if a notification was missed.
export function PendingAsks({ pending }: { pending: Broadcast[] }) {
  if (pending.length === 0) return null;

  return (
    <div className="mb-6 rounded-[3px] border border-flag/50 bg-card p-4">
      <p className="label mb-2" style={{ color: "var(--color-flag)" }}>
        You&apos;ve been asked
      </p>
      <ul className="flex flex-col divide-y divide-rule">
        {pending.map((b) => (
          <li key={b.id}>
            <Link
              href={`/broadcast/${b.id}`}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate text-ink">
                {b.title ? `${b.title}: ` : ""}
                {b.body}
              </span>
              <span className="shrink-0 rounded-[3px] bg-flag px-3 py-1 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-paper">
                {b.kind === "yesno" ? "Answer" : "Reply"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
