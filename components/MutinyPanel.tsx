"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { raiseMutiny, voteMutiny, nominateJudge, deleteMutiny } from "@/app/actions/mutiny";
import { useAnnounce } from "@/components/Announce";
import { relativeTime } from "@/lib/dates";
import type { Mutiny, Profile } from "@/lib/types";

// A motion against the President. What you see depends on who you are — and the
// President is cut out entirely while the vote runs (RLS, 0042). This component
// only ever renders what the server already decided you may read.
export function MutinyPanel({
  mutiny,
  profiles,
  currentUserId,
  president,
  myVote,
}: {
  mutiny: Mutiny | null;
  profiles: Profile[];
  currentUserId: string;
  president: Profile | null;
  myVote: boolean | null; // your own vote — nobody else's is ever readable
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const [composing, setComposing] = useState(false);
  const [reason, setReason] = useState("");
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(profiles.map((p) => [p.id, p]));
  const isPresident = president?.id === currentUserId;
  const raiser = mutiny?.raised_by ? byId.get(mutiny.raised_by) : null;

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    if (ok) announce(ok);
    router.refresh();
  }

  // ── Nothing live: offer to raise one (never to the President) ──────────────
  if (!mutiny) {
    if (isPresident || !president) return null;
    return (
      <div className="mb-6">
        <div className="mb-1 flex items-center justify-between">
          <p className="label">The ranks 🏴</p>
          {!composing && (
            <button
              onClick={() => setComposing(true)}
              className="rounded-[4px] border border-rule px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink-soft transition-colors hover:border-flag hover:text-flag"
            >
              🏴 Raise a mutiny
            </button>
          )}
        </div>
        <hr className="rule" />
        {composing ? (
          <div className="mt-3 rounded-[3px] border border-flag/50 bg-card p-4">
            <p className="label mb-1" style={{ color: "var(--color-flag)" }}>
              Motion against {president.name}
            </p>
            <p className="mb-3 text-sm text-ink-soft">
              The ranks vote in secret and {president.name} sees none of it. If they back you it
              goes to court. If they don&apos;t, it dies — and {president.name} is told it was you.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="State your case…"
              className="w-full resize-none rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
            />
            {error && <p className="mt-2 text-sm text-flag">{error}</p>}
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => {
                  setComposing(false);
                  setError(null);
                }}
                className="rounded-[3px] border border-rule px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink-soft"
              >
                Stand down
              </button>
              <button
                onClick={() =>
                  run(() => raiseMutiny(reason), "Motion raised · the ranks are voting 🏴").then(
                    () => {
                      setReason("");
                      setComposing(false);
                    },
                  )
                }
                disabled={busy || !reason.trim()}
                className="flex-1 rounded-[3px] bg-flag px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
              >
                {busy ? "Raising" : "Put it to the ranks"}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-soft">
            Unhappy with the President? Put it to the ranks — quietly.
          </p>
        )}
      </div>
    );
  }

  const target = mutiny.target_id ? byId.get(mutiny.target_id) : null;
  const isRaiser = mutiny.raised_by === currentUserId;
  const iAmTarget = mutiny.target_id === currentUserId;
  const judge = mutiny.judge_id ? byId.get(mutiny.judge_id) : null;

  // ── Failed: only the target and the raiser ever see this ──────────────────
  if (mutiny.status === "failed") {
    return (
      <div className="mb-6 rounded-[3px] border border-rule bg-card p-4">
        <p className="label mb-1" style={{ color: "var(--color-ink-soft)" }}>
          🏴 Motion failed
        </p>
        {iAmTarget ? (
          <>
            <p className="text-ink">
              <span className="font-semibold">{raiser?.name ?? "Someone"}</span> moved against you.
              The ranks stood by you.
            </p>
            <p className="mt-2 rounded-[3px] border-l-2 border-flag bg-paper px-3 py-2 text-ink">
              “{mutiny.reason}”
            </p>
          </>
        ) : (
          <p className="text-ink">
            The ranks stood by {target?.name ?? "the President"} — and they&apos;ve been told it
            was you. Awkward.
          </p>
        )}
        <p className="mt-2 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
          {mutiny.agree_count} for · {mutiny.against_count} against · {relativeTime(mutiny.created_at)}
        </p>
      </div>
    );
  }

  // ── Carried ───────────────────────────────────────────────────────────────
  if (mutiny.status === "carried") {
    return (
      <div className="mb-6 rounded-[3px] border border-flag/50 bg-card p-4">
        <p className="label mb-1" style={{ color: "var(--color-flag)" }}>
          🏴 The motion carried
        </p>
        <p className="text-ink">
          The ranks have moved against{" "}
          <span className="font-semibold">{target?.name ?? "the President"}</span>.
        </p>
        <p className="mt-2 rounded-[3px] border-l-2 border-flag bg-paper px-3 py-2 text-ink">
          “{mutiny.reason}”
        </p>
        <p className="mt-2 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
          {mutiny.agree_count} for · {mutiny.against_count} against
        </p>

        {mutiny.trial_id ? (
          <Link
            href={`/trial/${mutiny.trial_id}`}
            className="mt-3 inline-block rounded-[3px] bg-flag px-5 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper"
          >
            ⚖️ In the Courtroom{judge ? ` · ${judge.name} presiding` : ""}
          </Link>
        ) : isRaiser ? (
          <div className="mt-3 rounded-[3px] border border-rule bg-paper p-3">
            <p className="label mb-1">Name a judge</p>
            <p className="mb-2 text-sm text-ink-soft">
              They rule alone — the President has no say in their own case.
            </p>
            <div className="flex gap-2">
              <select
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                className="min-w-0 flex-1 rounded-[3px] border border-rule bg-card px-3 py-2 text-ink outline-none focus:border-ink"
              >
                <option value="">Pick someone impartial</option>
                {profiles
                  .filter((p) => p.id !== currentUserId && p.id !== mutiny.target_id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <button
                onClick={() =>
                  run(() => nominateJudge(mutiny.id, pick), "Judge named · case opened ⚖️")
                }
                disabled={busy || !pick}
                className="shrink-0 rounded-[3px] bg-flag px-4 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
              >
                Open case
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-flag">{error}</p>}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">
            Waiting on {raiser?.name ?? "the raiser"} to name a judge.
          </p>
        )}
      </div>
    );
  }

  // ── Voting (the President can't reach this — RLS won't return the row) ────
  return (
    <div className="mb-6 rounded-[3px] border border-flag/50 bg-card p-4">
      <p className="label mb-1" style={{ color: "var(--color-flag)" }}>
        🏴 A motion is before the ranks
      </p>
      <p className="text-sm text-ink-soft">
        {raiser?.id === currentUserId ? "You" : (raiser?.name ?? "Someone")} moved against{" "}
        {target?.name ?? "the President"} · {relativeTime(mutiny.created_at)}
      </p>
      <p className="mt-2 rounded-[3px] border-l-2 border-flag bg-paper px-3 py-2 text-ink">
        “{mutiny.reason}”
      </p>

      <p className="mt-3 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
        {mutiny.agree_count} for · {mutiny.against_count} against · {mutiny.eligible_count} eligible
      </p>
      <p className="mt-1 text-xs text-ink-soft">
        Votes are secret — nobody sees how you voted, ever.
      </p>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => run(() => voteMutiny(mutiny.id, true), "Vote cast")}
          disabled={busy}
          className="flex-1 rounded-[3px] border py-2.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
          style={{
            backgroundColor: myVote === true ? "var(--color-flag)" : "transparent",
            borderColor: myVote === true ? "var(--color-flag)" : "var(--color-rule)",
            color: myVote === true ? "var(--color-paper)" : "var(--color-ink)",
          }}
        >
          🏴 Agree
        </button>
        <button
          onClick={() => run(() => voteMutiny(mutiny.id, false), "Vote cast")}
          disabled={busy}
          className="flex-1 rounded-[3px] border py-2.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
          style={{
            backgroundColor: myVote === false ? "var(--color-moss)" : "transparent",
            borderColor: myVote === false ? "var(--color-moss)" : "var(--color-rule)",
            color: myVote === false ? "var(--color-paper)" : "var(--color-ink)",
          }}
        >
          Stand by them
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-flag">{error}</p>}

      {isRaiser && (
        <button
          onClick={() => run(() => deleteMutiny(mutiny.id), "Motion withdrawn")}
          disabled={busy}
          className="mt-3 font-mono text-xs uppercase tracking-[0.06em] text-ink-soft hover:text-flag"
        >
          Withdraw the motion
        </button>
      )}
    </div>
  );
}
