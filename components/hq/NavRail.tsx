"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The rail is part of the system, not a website sidebar: grouped by command
// function, monospaced, with a live status block pinned to the bottom.

type Item = { href: string; label: string; badge?: number; proto?: boolean };
type Group = { title: string; items: Item[] };

export const NAV: Group[] = [
  {
    title: "Command",
    items: [
      { href: "/hq", label: "Headquarters" },
      { href: "/hq/calendar", label: "Calendar" },
      { href: "/hq/operations", label: "Operations" },
      { href: "/hq/availability", label: "Availability" },
      { href: "/hq/comms", label: "Comms" },
    ],
  },
  {
    title: "Barracks",
    items: [
      { href: "/hq/personnel", label: "Personnel" },
      { href: "/hq/squads", label: "Squads" },
      { href: "/hq/leadership", label: "Leadership" },
      { href: "/hq/court", label: "Court" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { href: "/hq/radar", label: "Radar" },
      { href: "/hq/records", label: "Records" },
      { href: "/hq/archives", label: "Archives" },
      { href: "/hq/honours", label: "Honours" },
      { href: "/hq/dispatch", label: "Dispatch" },
    ],
  },
  {
    title: "Network",
    items: [
      { href: "/hq/battles", label: "Battles", proto: true },
      { href: "/hq/find-opponent", label: "Find Opponent", proto: true },
      { href: "/hq/rivals", label: "Rivals", proto: true },
      { href: "/hq/leagues", label: "Leagues", proto: true },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/hq/integrations", label: "Integrations", proto: true },
      { href: "/hq/link", label: "Barracks Link", proto: true },
      { href: "/hq/modules", label: "Modules", proto: true },
      { href: "/hq/personal", label: "Your account" },
      { href: "/hq/settings", label: "Settings" },
    ],
  },
];

export function NavRail({ actions }: { actions: number }) {
  const path = usePathname();

  return (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto px-3 pb-5 pt-4">
      {NAV.map((g) => (
        <div key={g.title}>
          <p className="hq-label mb-1.5 px-3 opacity-60">{g.title}</p>
          <div className="flex flex-col gap-0.5">
            {g.items.map((it) => {
              const active = it.href === "/hq" ? path === "/hq" : path.startsWith(it.href);
              const badge = it.href === "/hq" && actions > 0 ? actions : undefined;
              return (
                <Link key={it.href} href={it.href} className="hq-nav-item" data-active={active}>
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {badge != null && (
                    <span
                      className="hq-mono rounded-[3px] px-1.5 text-[10px] font-bold"
                      style={{ backgroundColor: "var(--color-flag)", color: "#0b100e" }}
                    >
                      {badge}
                    </span>
                  )}
                  {it.proto && (
                    <span
                      className="hq-mono text-[8px] uppercase tracking-[0.12em]"
                      style={{ color: "#55655c" }}
                      title="Interface prototype"
                    >
                      proto
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
