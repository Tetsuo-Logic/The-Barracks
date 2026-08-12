"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActingCaptain } from "@/app/actions/operations";

// Sq-3b: a squad op can have a stand-in Captain for the night. The real
// Captain / CO names them; everyone else just sees who's leading.
export function ActingCaptain({
  compId,
  value,
  people,
  me,
}: {
  compId: string;
  value: string | null;
  people: { id: string; name: string }[];
  me: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: string) {
    setError(null);
    startTransition(async () => {
      const res = await setActingCaptain(compId, next || null);
      if (!res.ok) {
        setError(res.error ?? "Couldn't name a stand-in.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <p className="hq-label mb-1.5">Acting Captain</p>
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(e) => change(e.target.value)}
          disabled={pending}
          className="hq-mono w-full appearance-none rounded-[3px] border border-rule bg-[rgba(0,0,0,0.35)] py-2 pl-2.5 pr-7 text-[12px] text-ink outline-none focus:border-sand disabled:opacity-50"
        >
          <option value="">No stand-in — Captain leads</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === me ? "You" : p.name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-ink-soft">
          ▼
        </span>
      </div>
      <p className="hq-mono mt-1 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
        Hands command of this room to someone for tonight only
      </p>
      {error && (
        <p className="hq-mono mt-1 text-[11px] uppercase" style={{ color: "var(--color-flag)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
