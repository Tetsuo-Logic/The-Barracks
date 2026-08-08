"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTrial } from "@/app/actions/trials";
import { Avatar } from "@/components/Avatar";
import type { Profile } from "@/lib/types";

// Organiser convenes the Tribunal: pick who flaked, name the charge.
export function ConveneTrial({
  candidates,
  competitionId,
  compact,
}: {
  candidates: Profile[];
  competitionId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!compact);
  const [defendant, setDefendant] = useState<string | null>(null);
  const [charge, setCharge] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-[3px] border border-flag px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-flag"
      >
        Take to the Tribunal
      </button>
    );
  }

  async function convene() {
    if (!defendant) return;
    setBusy(true);
    setError(null);
    const res = await createTrial({
      defendantId: defendant,
      charge,
      competitionId,
    });
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.push(`/trial/${res.id}`);
  }

  return (
    <div className="rounded-[3px] border border-flag/50 bg-card p-4">
      <p className="label mb-3" style={{ color: "var(--color-flag)" }}>
        Convene the Tribunal
      </p>

      <p className="label mb-2">The accused</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {candidates.map((p) => {
          const active = defendant === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setDefendant(p.id)}
              className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3"
              style={{
                borderColor: active ? "var(--color-flag)" : "var(--color-rule)",
                backgroundColor: active ? "rgba(180,55,42,0.08)" : "transparent",
              }}
            >
              <Avatar name={p.name} avatarUrl={p.avatar_url} colour={p.colour} size={22} />
              <span className="text-sm text-ink">{p.name}</span>
            </button>
          );
        })}
      </div>

      <p className="label mb-2">The charge</p>
      <input
        value={charge}
        onChange={(e) => setCharge(e.target.value)}
        placeholder="Said in, no-showed at Piltdown"
        className="w-full rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
      />

      {error && <p className="mt-2 text-sm text-flag">{error}</p>}

      <div className="mt-3 flex gap-3">
        {compact && (
          <button onClick={() => setOpen(false)} className="rounded-[3px] border border-rule px-4 py-2 text-sm text-ink-soft">
            Cancel
          </button>
        )}
        <button
          onClick={convene}
          disabled={busy || !defendant || !charge.trim()}
          className="flex-1 rounded-[3px] bg-flag px-4 py-2.5 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
        >
          {busy ? "Convening" : "Summon them"}
        </button>
      </div>
    </div>
  );
}
