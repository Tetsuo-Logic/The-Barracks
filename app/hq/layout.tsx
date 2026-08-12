import type { ReactNode } from "react";
import Link from "next/link";
import "./hq.css";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NavRail } from "@/components/hq/NavRail";
import { TopBar, type BarracksOption } from "@/components/hq/TopBar";
import { Boot } from "@/components/hq/Boot";
import type { Profile } from "@/lib/types";

export const metadata = {
  title: "Barracks Headquarters",
  description: "Command interface for The Barracks.",
};

// The Headquarters shell. Same auth and same Supabase as the phone — this is a
// second interface over one platform, not a second product.
export default async function HqLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: profiles }, { count: squadCount }] = await Promise.all([
    supabase.from("profiles").select("id, name, nickname"),
    supabase.from("squads").select("id", { count: "exact", head: true }),
  ]);

  const roster = (profiles ?? []) as Pick<Profile, "id" | "name" | "nickname">[];
  const callsign = profile.nickname || profile.name;

  // A User has 0..n memberships. Only the live Barracks is wired; the others
  // exist so multi-Barracks switching can be experienced (lib/hq/future).
  const barracks: BarracksOption[] = [
    { id: "live", name: "The Barracks", tag: "BRK", live: true },
    { id: "work", name: "Work Lads", tag: "WRK", live: false },
    { id: "old", name: "Old School", tag: "OSC", live: false },
  ];

  return (
    <div className="hq">
      <Boot callsign={callsign} />
      <TopBar
        barracks={barracks}
        callsign={callsign}
        online={Math.max(1, Math.round(roster.length * 0.55))}
      />

      <div className="flex" style={{ minHeight: "calc(100dvh - var(--hq-bar))" }}>
        <aside
          className="sticky shrink-0 border-r border-rule"
          style={{
            width: "var(--hq-rail)",
            top: "var(--hq-bar)",
            height: "calc(100dvh - var(--hq-bar))",
          }}
        >
          <NavRail actions={0} />
          <div className="absolute inset-x-0 bottom-0 border-t border-rule bg-[rgba(8,12,10,0.9)] px-4 py-3">
            <p className="hq-label flex items-center gap-1.5">
              <span className="hq-dot hq-dot-live" style={{ backgroundColor: "var(--color-moss)" }} />
              System online
            </p>
            <p className="hq-mono mt-1 text-[10px] text-ink-soft">
              {roster.length} operatives · {squadCount ?? 0} squads
            </p>
            <Link href="/hq/settings" className="hq-label mt-2 block opacity-50 hover:opacity-100">
              Barracks HQ v0.1 · experimental
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-6 py-6" style={{ maxWidth: 1760 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
