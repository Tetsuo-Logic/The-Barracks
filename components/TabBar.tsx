"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GamepadIcon,
  CalendarIcon,
  TrophyIcon,
  PersonIcon,
} from "@/components/Icons";

const TABS = [
  { href: "/", label: "Games", Icon: GamepadIcon, match: (p: string) => p === "/" },
  {
    href: "/calendar",
    label: "Calendar",
    Icon: CalendarIcon,
    match: (p: string) => p.startsWith("/calendar"),
  },
  {
    href: "/standings",
    label: "Ranks",
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
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[520px] border-t border-rule bg-paper/85 backdrop-blur-md [box-shadow:0_-1px_0_rgba(245,182,61,0.1)]">
      <ul className="flex pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className="relative flex flex-col items-center gap-1 py-2.5"
                style={{ color: active ? "var(--color-sand)" : "var(--color-ink-soft)" }}
                aria-current={active ? "page" : undefined}
              >
                {/* active indicator bar */}
                <span
                  className="absolute top-0 h-[2px] w-8 rounded-full transition-opacity"
                  style={{
                    backgroundColor: "var(--color-sand)",
                    opacity: active ? 1 : 0,
                    boxShadow: active ? "0 0 10px 1px var(--color-sand)" : "none",
                  }}
                  aria-hidden
                />
                <Icon />
                <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.14em]">
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
