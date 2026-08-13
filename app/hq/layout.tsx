import type { ReactNode } from "react";
import Link from "next/link";
import "./hq.css";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NavRail } from "@/components/hq/NavRail";
import { TopBar, type BarracksOption } from "@/components/hq/TopBar";
import { Boot } from "@/components/hq/Boot";
import { realRoleOf } from "@/lib/hq/role";
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
        realRole={await realRoleOf(profile)}
      />

      <div className="flex" style={{ minHeight: "calc(100dvh - var(--hq-bar))" }}>
        <aside
          className="sticky flex shrink-0 flex-col border-r border-rule"
          style={{
            width: "var(--hq-rail)",
            top: "var(--hq-bar)",
            height: "calc(100dvh - var(--hq-bar))",
          }}
        >
          {/* min-h-0 lets the nav actually scroll inside the flex column instead
              of pushing the status block off the bottom of the rail. */}
          <div className="min-h-0 flex-1">
            <NavRail actions={0} />
          </div>
          <div className="shrink-0 border-t border-rule bg-[rgba(8,12,10,0.9)] px-4 py-3">
            <p className="hq-label flex items-center gap-1.5">
              <span className="hq-dot hq-dot-live" style={{ backgroundColor: "var(--color-moss)" }} />
              System online
            </p>
            <p className="hq-mono mt-1 text-[10px] text-ink-soft">
              {roster.length} operatives · {squadCount ?? 0} squads
            </p>
            <Link
              href="/hq/settings"
              className="hq-mono mt-1.5 block text-[9px] uppercase tracking-[0.1em] opacity-45 hover:opacity-100"
            >
              HQ v0.1 · experimental
            </Link>
          </div>
        </aside>

        {/* The content column is centred in whatever space is left beside the
            rail, and capped, so HQ reads the same on a laptop and on an
            ultrawide instead of stretching to the edge of the monitor. Pages
            that want to be narrower still centre themselves inside this. */}
        <main className="min-w-0 flex-1 px-6 py-6">
          <div className="mx-auto w-full" style={{ maxWidth: 1500 }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
