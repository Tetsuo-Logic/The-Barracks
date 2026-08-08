import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { GearIcon, MegaphoneIcon, BoardIcon, BellIcon } from "@/components/Icons";
import type { Profile } from "@/lib/types";

// App header (§4.6): league name, settings, your avatar.
export function Header({
  profile,
  pendingCount = 0,
}: {
  profile: Profile;
  pendingCount?: number;
}) {
  return (
    <header className="sticky top-0 z-20 mx-auto flex w-full max-w-[520px] items-center justify-between border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur-sm">
      <Link
        href="/"
        className="font-narrow text-[15px] font-bold uppercase tracking-[0.08em] text-ink"
      >
        The Threeball
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
          <BellIcon />
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
          <BoardIcon />
        </Link>
        {profile.is_admin && (
          <Link
            href="/broadcast"
            aria-label="Ping the lads"
            className="text-ink-soft transition-colors hover:text-ink"
          >
            <MegaphoneIcon />
          </Link>
        )}
        <Link
          href="/settings"
          aria-label="Settings"
          className="text-ink-soft transition-colors hover:text-ink"
        >
          <GearIcon />
        </Link>
        <Link href="/you" aria-label="Your profile">
          <Avatar
            name={profile.name}
            avatarUrl={profile.avatar_url}
            colour={profile.colour}
            size={30}
          />
        </Link>
      </div>
    </header>
  );
}
