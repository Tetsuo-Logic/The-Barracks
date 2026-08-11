import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import type { Profile } from "@/lib/domain";
import type { Service } from "@/lib/service";

// The squad's participation at a glance — Operations · games · hours. Ordered by
// most active, NOT by skill: this is a service record, not a leaderboard.
export function ServiceRoster({ rows }: { rows: { profile: Profile; service: Service }[] }) {
  const active = rows.filter((r) => r.service.operations > 0);
  if (active.length === 0) {
    return (
      <p className="py-12 text-center text-ink-soft">
        No operations logged yet. Start a night in the Room and take roll call. 🎮
      </p>
    );
  }
  const sorted = [...active].sort((a, b) => b.service.operations - a.service.operations);

  return (
    <div className="overflow-hidden rounded-[3px] border border-rule">
      <div className="grid grid-cols-[1.8fr_repeat(3,1fr)] bg-[rgba(22,36,27,0.03)] px-3 py-2">
        <span className="label">Operative</span>
        <span className="label text-right">Ops</span>
        <span className="label text-right">Games</span>
        <span className="label text-right">Hours</span>
      </div>
      {sorted.map((r) => (
        <Link
          key={r.profile.id}
          href={`/profile/${r.profile.id}`}
          className="grid grid-cols-[1.8fr_repeat(3,1fr)] items-center border-t border-rule px-3 py-2.5"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={r.profile.name} avatarUrl={r.profile.avatar_url} colour={r.profile.colour} size={22} />
            <span className="truncate text-ink">{r.profile.name}</span>
          </span>
          <span className="text-right font-narrow tabular-nums text-ink">{r.service.operations}</span>
          <span className="text-right font-narrow tabular-nums text-ink">{r.service.games}</span>
          <span className="text-right font-narrow tabular-nums text-ink-soft">{r.service.hours}</span>
        </Link>
      ))}
    </div>
  );
}
