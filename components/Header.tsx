import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { GearIcon, MegaphoneIcon, BoardIcon, BellIcon } from "@/components/Icons";
import type { Profile } from "@/lib/types";

// App header (§4.6): league name, settings, your avatar.
export function Header({
  profile,
  pendingCount = 0,
  isAdmin = profile.is_admin,
}: {
  profile: Profile;
  pendingCount?: number;
  isAdmin?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 mx-auto flex w-full max-w-[520px] items-center justify-between border-b border-rule bg-paper/80 px-4 py-3 backdrop-blur-md [box-shadow:0_1px_0_rgba(245,182,61,0.12)]">
      <Link href="/" className="group flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full bg-moss [box-shadow:0_0_8px_1px_var(--color-moss)]"
          aria-hidden
        />
        <span className="font-mono text-[16px] font-bold uppercase tracking-[0.08em] text-ink">
          BARRACKS
        </span>
      </Link>
      <div className="flex items-center gap-3">
        {/* Notifications — outstanding items plus the full activity history.
            Everyone sees this, so a missed push is never lost. */}
        <Link
          href="/activity"
          aria-label={
            pendingCount > 0
              ? `${pendingCount} thing${pendingCount === 1 ? "" : "s"} waiting on you`
              : "Notifications"
          }
          className="relative text-ink-soft transition-colors hover:text-ink"
        >
          <BellIcon width={26} height={26} />
          {pendingCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-flag px-1 font-narrow text-[10px] font-bold leading-none text-paper">
              {pendingCount}
            </span>
          )}
        </Link>
        <Link
          href="/board"
          aria-label="The board"
          className="text-ink-soft transition-colors hover:text-ink"
        >
          <BoardIcon width={26} height={26} />
        </Link>
        {isAdmin && (
          <Link
            href="/broadcast"
            aria-label="Comms — ping the squad"
            className="text-ink-soft transition-colors hover:text-ink"
          >
            <MegaphoneIcon width={26} height={26} />
          </Link>
        )}
        <Link
          href="/settings"
          aria-label="Settings"
          className="text-ink-soft transition-colors hover:text-ink"
        >
          <GearIcon width={26} height={26} />
        </Link>
        <Link href="/you" aria-label="Your profile">
          <Avatar
            name={profile.name}
            avatarUrl={profile.avatar_url}
            colour={profile.colour}
            size={34}
          />
        </Link>
      </div>
    </header>
  );
}
