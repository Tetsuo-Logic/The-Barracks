"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { HqScope } from "@/lib/hq/role";

// The rail is part of the system, not a website sidebar: grouped by command
// function, monospaced, with a live status block pinned to the bottom.

type Item = {
  href: string;
  label: string;
  badge?: number;
  proto?: boolean;
  /** Roles this item is for. Omitted = everyone. A member has no useful
   *  Planning screen — nights are arranged in their squad — so the rail simply
   *  doesn't offer it rather than offering a locked door. */
  roles?: HqScope[];
};
type Group = { title: string; items: Item[] };

export const NAV: Group[] = [
  {
    title: "Command",
    items: [
      { href: "/hq", label: "Headquarters" },
      { href: "/hq/calendar", label: "Calendar" },
      { href: "/hq/operations", label: "Operations" },
      { href: "/hq/availability", label: "Planning", roles: ["captain", "president"] },
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

export function NavRail({ actions, role }: { actions: number; role: HqScope }) {
  // On the HQ origin the root is rewritten to /hq by middleware, so the browser
  // reports "/" and nothing matched — landing on localhost:3001 left the rail
  // with no active item and no section open.
  const raw = usePathname();
  const path = raw === "/" ? "/hq" : raw;
  // Follow the dev role preview too, so hiding can actually be tested.
  const asked = useSearchParams().get("as") as HqScope | null;
  const allowed: HqScope[] =
    role === "president" ? ["president", "captain", "member"] : role === "captain" ? ["captain", "member"] : ["member"];
  const view: HqScope = asked && allowed.includes(asked) ? asked : role;

  const holds = (g: Group) =>
    g.items.some((it) => (it.href === "/hq" ? path === "/hq" : path.startsWith(it.href)));

  // Collapsed by default, except the group you're currently in — a rail that
  // hides the page you're on is tidier and less useful. Choices persist, so
  // opening Intelligence once doesn't close again on every navigation.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let saved: Record<string, boolean> = {};
    try {
      saved = JSON.parse(localStorage.getItem("hq-nav-open") ?? "{}");
    } catch {
      saved = {};
    }
    setOpen(saved);
    setReady(true);
  }, []);

  function toggle(title: string, isOpen: boolean) {
    const next = { ...open, [title]: !isOpen };
    setOpen(next);
    localStorage.setItem("hq-nav-open", JSON.stringify(next));
  }

  return (
    <nav className="flex h-full flex-col overflow-y-auto px-2.5 pb-5 pt-3">
      {NAV.map((g) => {
        const items = g.items.filter((it) => !it.roles || it.roles.includes(view));
        if (items.length === 0) return null;

        // Before localStorage is read, render the section holding this page as
        // open so the first paint matches what the server sent.
        const isOpen = ready ? (open[g.title] ?? holds(g)) : holds(g);

        return (
          <div key={g.title} className="border-b border-rule/50 py-1.5 last:border-0">
            {/* The section header is the control. Sized to be clicked, not to
                be a caption — a 10px label is a poor target and read as
                decoration rather than navigation. */}
            <button
              onClick={() => toggle(g.title, isOpen)}
              aria-expanded={isOpen}
              className="hq-mono flex w-full items-center gap-2 rounded-[3px] px-2.5 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              style={{ color: "var(--color-sand)" }}
            >
              <span className="min-w-0 flex-1 truncate text-left">{g.title}</span>
              {!isOpen && holds(g) && (
                <span
                  className="hq-dot"
                  style={{ backgroundColor: "var(--color-sand)", width: 5, height: 5 }}
                  aria-hidden
                />
              )}
              <span
                aria-hidden
                className="shrink-0 text-[9px] transition-transform"
                style={{ opacity: 0.75, transform: isOpen ? "rotate(180deg)" : "none" }}
              >
                ▼
              </span>
            </button>

            {isOpen && (
              <div className="mb-1 mt-1 flex flex-col gap-0.5">
                {items.map((it) => {
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
            )}
          </div>
        );
      })}
    </nav>
  );
}
