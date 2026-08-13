"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { RoleSwitch } from "@/components/hq/RoleSwitch";
import { QuickComms } from "@/components/hq/comms/QuickComms";
import { Portal } from "@/components/hq/Portal";
import type { QuickTransmission } from "@/lib/hq/comms";
import type { HqScope } from "@/lib/hq/role";

// Top bar: which Barracks you're commanding, system clock, presence, and the
// route back to the phone. The Barracks switcher is real in shape — a User has
// 0..n memberships — but only your live Barracks is wired; the others are
// prototype entries so multi-Barracks can be experienced.

export type BarracksOption = { id: string; name: string; tag: string; live: boolean };

export function TopBar({
  barracks,
  callsign,
  online,
  realRole,
  comms,
}: {
  barracks: BarracksOption[];
  callsign: string;
  online: number;
  realRole: HqScope;
  comms: { items: QuickTransmission[]; awaiting: number };
}) {
  const [open, setOpen] = useState(false);
  const [clock, setClock] = useState<string>("--:--:--");
  const current = barracks.find((b) => b.live) ?? barracks[0];

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 flex items-center gap-4 border-b border-rule px-4"
      style={{ height: "var(--hq-bar)", background: "rgba(8,12,10,0.86)", backdropFilter: "blur(8px)" }}
    >
      {/* Barracks switcher */}
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-[3px] border border-rule px-3 py-1.5 transition-colors hover:border-ink-soft"
        >
          <span className="hq-dot hq-dot-live" style={{ backgroundColor: "var(--color-moss)" }} />
          <span className="hq-readout text-[13px] font-bold uppercase tracking-[0.08em]">
            {current?.name ?? "The Barracks"}
          </span>
          <span className="hq-mono text-[10px] text-ink-soft">▾</span>
        </button>

        {open && (
          <>
            <Portal>
              <button
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setOpen(false)}
                aria-label="Close"
              />
            </Portal>
            {/* See RoleSwitch: an arbitrary calc without spaces around `+` is
                invalid CSS, so Tailwind drops the rule and the menu loses its
                offset entirely. */}
            <div className="hq-panel absolute left-0 top-full z-20 mt-2 w-[280px] p-1.5">
              <p className="hq-label px-2.5 py-1.5">Your Barracks</p>
              {barracks.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-[3px] px-2.5 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                >
                  <span
                    className="hq-mono flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] text-[10px] font-bold"
                    style={{
                      backgroundColor: b.live ? "var(--color-sand)" : "var(--color-rule)",
                      color: b.live ? "#0b100e" : "var(--color-ink-soft)",
                    }}
                  >
                    {b.tag}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">{b.name}</span>
                    <span className="hq-label">{b.live ? "Active · commanding" : "Prototype"}</span>
                  </span>
                </button>
              ))}
              <div className="mt-1 border-t border-rule pt-1">
                <button className="hq-label w-full rounded-[3px] px-2.5 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]">
                  + Form a new Barracks
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="hidden items-center gap-4 lg:flex">
        {/* Not real presence yet — a placeholder off the roster count. Dashed
            underline so it never reads as fact. Replaced by a Supabase Realtime
            presence channel (lib/hq/future/systems.ts). */}
        <span
          className="hq-label flex cursor-help items-center gap-1.5"
          style={{ textDecoration: "underline dotted", textUnderlineOffset: 3, opacity: 0.75 }}
          title="Prototype — not live presence. Will show everyone linked to this Barracks once Realtime presence is wired."
        >
          <span className="hq-dot" style={{ backgroundColor: "var(--color-ink-soft)" }} />
          {online} online
        </span>
        <span className="hq-label opacity-50">|</span>
        <span className="hq-label">System nominal</span>
      </div>

      <div className="ml-auto flex items-center gap-4">
        {/* Dev role preview — in the shell so every HQ page can be judged as
            President, Captain and Member without per-page wiring. */}
        <Suspense fallback={null}>
          <RoleSwitch real={realRole} />
        </Suspense>
        {/* The radio — Comms from any screen, without leaving it. */}
        <QuickComms items={comms.items} awaiting={comms.awaiting} />
        <span className="hq-mono text-[12px] tracking-[0.1em] text-ink-soft">{clock}</span>
        <Link
          href="/"
          className="hq-label rounded-[3px] border border-rule px-2.5 py-1.5 transition-colors hover:border-ink-soft hover:text-ink"
          title="The mobile field companion"
        >
          📱 Field app
        </Link>
        <Link
          href="/hq/tv"
          className="hq-label rounded-[3px] border px-2.5 py-1.5 transition-colors"
          style={{ borderColor: "color-mix(in srgb, var(--color-sand) 40%, transparent)", color: "var(--color-sand)" }}
        >
          ▣ Barracks TV
        </Link>
        <span
          className="hq-mono flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
          title={callsign}
        >
          {callsign.slice(0, 2).toUpperCase()}
        </span>
      </div>
    </header>
  );
}
