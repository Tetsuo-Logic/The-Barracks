import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { GearIcon, MegaphoneIcon } from "@/components/Icons";
import type { Profile } from "@/lib/types";

// App header (§4.6): league name, settings, your avatar.
export function Header({ profile }: { profile: Profile }) {
  return (
    <header className="sticky top-0 z-20 mx-auto flex w-full max-w-[520px] items-center justify-between border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur-sm">
      <Link
        href="/"
        className="font-narrow text-[15px] font-bold uppercase tracking-[0.08em] text-ink"
      >
        The Threeball
      </Link>
      <div className="flex items-center gap-3">
        <Link
          href="/broadcast"
          aria-label="Messages"
          className="text-ink-soft transition-colors hover:text-ink"
        >
          <MegaphoneIcon />
        </Link>
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
