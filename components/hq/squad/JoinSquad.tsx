"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinSquad } from "@/app/actions/squads";

// Joining a squad you're not in. Wired to the existing `joinSquad` — no new
// approval flow: squads are open to the Barracks, and RLS is what decides.
//
// Sits where REQUEST A NIGHT sits on a squad you already serve in, because the
// question the card answers is the same one either way: what do I do about
// this squad?

export function JoinSquad({
  squadId,
  squadName,
  variant = "primary",
}: {
  squadId: string;
  squadName: string;
  /** `primary` fills the card's action slot; `inline` sits in a list row. */
  variant?: "primary" | "inline";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await joinSquad(squadId);
            if (!res.ok) setError(res.error ?? "Couldn't join.");
            else router.refresh();
          })
        }
        disabled={pending}
        title={`Join ${squadName}`}
        className={
          variant === "primary"
            ? "hq-readout w-full rounded-[3px] border px-4 py-3 text-[14px] font-bold uppercase tracking-[0.08em] transition-colors disabled:opacity-50"
            : "hq-label rounded-[3px] border px-3 py-2 font-semibold transition-colors disabled:opacity-50"
        }
        style={{
          borderColor: "color-mix(in srgb, var(--color-sand) 55%, transparent)",
          backgroundColor: "rgba(245,182,61,0.1)",
          color: "var(--color-sand)",
        }}
      >
        {pending ? "Joining…" : "Join squad"}
      </button>
      {error && (
        <p className="hq-mono text-[11px]" style={{ color: "var(--color-flag)" }}>
          {error}
        </p>
      )}
    </>
  );
}
