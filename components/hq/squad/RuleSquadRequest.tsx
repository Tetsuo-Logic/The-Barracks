"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveRequest, declineRequest } from "@/app/actions/squads";

// The President ruling on a squad request, where they read it.
//
// The notification and the Action Required row both pointed at the squads page,
// which then pointed at the phone — so the last step of the journey happened
// somewhere else entirely. Approve and decline live here now, on the same row
// as the details you're ruling on.
//
// Approving forms the squad and seats the proposed Captain (approve_squad_request);
// declining just marks it declined and leaves the record.

export function RuleSquadRequest({
  requestId,
  squadName,
  captainName,
}: {
  requestId: string;
  squadName: string;
  captainName: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      {error && (
        <span className="hq-mono text-[11px]" style={{ color: "var(--color-flag)" }}>
          {error}
        </span>
      )}

      {!confirmDecline ? (
        <>
          <button
            disabled={pending}
            onClick={() => run(() => approveRequest(requestId))}
            title={
              captainName
                ? `Form ${squadName} and give ${captainName} the captaincy`
                : `Form ${squadName}`
            }
            className="hq-label rounded-[3px] px-3 py-1.5 font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--color-moss)", color: "#0b100e" }}
          >
            {pending ? "Working…" : "Approve"}
          </button>
          <button
            disabled={pending}
            onClick={() => setConfirmDecline(true)}
            className="hq-label rounded-[3px] border px-3 py-1.5 transition-colors hover:text-ink disabled:opacity-50"
            style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
          >
            Decline
          </button>
        </>
      ) : (
        <>
          <span className="hq-label" style={{ color: "var(--color-flag)" }}>
            Decline {squadName}?
          </span>
          <button
            disabled={pending}
            onClick={() => run(() => declineRequest(requestId))}
            className="hq-label rounded-[3px] px-3 py-1.5 font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--color-flag)", color: "#0b100e" }}
          >
            {pending ? "Working…" : "Decline"}
          </button>
          <button
            onClick={() => setConfirmDecline(false)}
            className="hq-label rounded-[3px] border px-3 py-1.5"
            style={{ borderColor: "var(--color-rule)" }}
          >
            Cancel
          </button>
        </>
      )}
    </span>
  );
}
