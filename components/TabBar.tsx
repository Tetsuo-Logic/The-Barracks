"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FlagIcon,
  CalendarIcon,
  TrophyIcon,
  PersonIcon,
} from "@/components/Icons";

const TABS = [
  { href: "/", label: "Fixtures", Icon: FlagIcon, match: (p: string) => p === "/" },
  {
    href: "/calendar",
    label: "Calendar",
    Icon: CalendarIcon,
    match: (p: string) => p.startsWith("/calendar"),
  },
  {
    href: "/standings",
    label: "Standings",
    Icon: TrophyIcon,
    match: (p: string) => p.startsWith("/standings"),
  },
  {
    href: "/you",
    label: "You",
    Icon: PersonIcon,
    match: (p: string) => p.startsWith("/you") || p.startsWith("/profile"),
  },
];

// Fixed bottom tab bar (§4.6). Respects the iPhone home indicator via
// safe-area-inset-bottom or it sits under it (§10).
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[520px] border-t border-rule bg-paper/95 backdrop-blur-sm">
      <ul className="flex pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className="flex flex-col items-center gap-0.5 py-2"
                style={{ color: active ? "var(--color-ink)" : "var(--color-ink-soft)" }}
                aria-current={active ? "page" : undefined}
              >
                <Icon />
                <span className="font-narrow text-[10px] font-semibold uppercase tracking-[0.08em]">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
