"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { Portal } from "@/components/hq/Portal";
import type { HqScope } from "@/lib/hq/role";

// The avatar, with somewhere to go. Signing out lived only on the phone's
// settings page, so there was no way out of Headquarters at all — you couldn't
// even reach the login screen to look at it.

const ROLE_LABEL: Record<HqScope, string> = {
  president: "President",
  captain: "Captain",
  member: "Operative",
};

export function AccountMenu({ callsign, role }: { callsign: string; role: HqScope }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={callsign}
        className="hq-mono flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-opacity hover:opacity-85"
        style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
      >
        {callsign.slice(0, 2).toUpperCase()}
      </button>

      {open && (
        <>
          {/* Portalled: the bar carries a backdrop-filter, which would make it
              the containing block for a fixed overlay and leave the catcher
              covering only the 52px header. */}
          <Portal>
            <button
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setOpen(false)}
              aria-label="Close"
            />
          </Portal>

          <div className="hq-panel absolute right-0 top-full z-20 mt-2 w-[220px] p-1.5">
            <div className="px-2.5 py-2">
              <p className="hq-readout text-[14px] font-bold uppercase tracking-[0.06em]">
                {callsign}
              </p>
              <p className="hq-label mt-0.5" style={{ color: "var(--color-sand)" }}>
                {ROLE_LABEL[role]}
              </p>
            </div>

            <div className="border-t border-rule pt-1">
              <Link
                href="/hq/personal"
                onClick={() => setOpen(false)}
                className="block rounded-[3px] px-2.5 py-2 text-[13px] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              >
                Your account
              </Link>
              <Link
                href="/hq/settings"
                onClick={() => setOpen(false)}
                className="block rounded-[3px] px-2.5 py-2 text-[13px] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              >
                Settings
              </Link>
            </div>

            <form action={signOut} className="mt-1 border-t border-rule pt-1">
              <button
                type="submit"
                className="w-full rounded-[3px] px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-[rgba(255,91,59,0.1)]"
                style={{ color: "var(--color-flag)" }}
              >
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
