"use client";

import { useState } from "react";

// "+ Enlist operative".
//
// There is no invite or approval system to hook into — enlistment happens on
// sign-up, where a database trigger creates the profile and the membership
// (0030_group_scoped_rls). So the honest action is handing someone the way in,
// not inventing an invite table to make the button look busy.
//
// When a real invite flow exists this becomes a link to it and nothing else on
// the page changes.

export function EnlistLink() {
  const [said, setSaid] = useState<string | null>(null);

  async function copy() {
    const url = `${window.location.origin}/login`;
    try {
      await navigator.clipboard.writeText(url);
      setSaid("Sign-up link copied");
    } catch {
      setSaid(url);
    }
    window.setTimeout(() => setSaid(null), 4000);
  }

  return (
    <span className="flex items-center gap-2.5">
      {said && <span className="hq-label" style={{ color: "var(--color-moss)" }}>{said}</span>}
      <button
        onClick={copy}
        title="Copy the sign-up link — they enlist by creating an account"
        className="hq-label rounded-[3px] px-3 py-2 font-semibold"
        style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
      >
        + Enlist operative
      </button>
    </span>
  );
}
