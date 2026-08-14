"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveSquad } from "@/app/actions/squads";

// Leaving a squad. Lives on the dossier rather than the directory: joining is
// a quick action, leaving is management, and the directory is for browsing.
//
// A Captain can't simply walk out while anyone else is still in the squad —
// nobody would be able to call a muster, approve a night or answer a request.
// The command refuses it; this explains why before you try, rather than
// offering a button that errors.

export function LeaveSquad({
  squadId,
  isCaptain,
  memberCount,
}: {
  squadId: string;
  isCaptain: boolean;
  memberCount: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Last one out is fine — there's nobody to hand it to.
  const stuck = isCaptain && memberCount > 1;

  if (stuck) {
    return (
      <span
        className="hq-label cursor-help rounded-[3px] border px-3 py-2"
        style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
        title="Hand the captaincy to another operative first — a squad with no Captain can't muster."
      >
        Captain — can&apos;t leave
      </span>
    );
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="hq-label rounded-[3px] border px-3 py-2 transition-colors hover:text-ink"
        style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
      >
        Leave squad
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="hq-label" style={{ color: "var(--color-flag)" }}>
        Leave this squad?
      </span>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await leaveSquad(squadId);
            if (!res.ok) setError(res.error);
            else {
              setConfirming(false);
              router.refresh();
            }
          })
        }
        className="hq-label rounded-[3px] px-3 py-2 font-semibold disabled:opacity-50"
        style={{ backgroundColor: "var(--color-flag)", color: "#0b100e" }}
      >
        {pending ? "Leaving…" : "Leave"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="hq-label rounded-[3px] border px-3 py-2"
        style={{ borderColor: "var(--color-rule)" }}
      >
        Cancel
      </button>
      {error && (
        <span className="hq-mono text-[11px]" style={{ color: "var(--color-flag)" }}>
          {error}
        </span>
      )}
    </span>
  );
}
