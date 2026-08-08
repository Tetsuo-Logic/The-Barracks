"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitDefence, castVote } from "@/app/actions/trials";
import { Avatar } from "@/components/Avatar";
import type { Penalty, Profile, Trial, TrialVote, Verdict } from "@/lib/types";

// The three ways a juror can land: acquit, warn, or strike.
const CHOICES: { key: string; vote: Verdict; penalty?: Penalty; label: string; colour: string }[] = [
  { key: "not_guilty", vote: "not_guilty", label: "Not guilty", colour: "var(--color-moss)" },
  { key: "warning", vote: "guilty", penalty: "warning", label: "Warning", colour: "var(--color-sand)" },
  { key: "strike", vote: "guilty", penalty: "strike", label: "Strike", colour: "var(--color-flag)" },
];

function labelFor(v: TrialVote): { text: string; colour: string } {
  if (v.vote !== "guilty") return { text: "Not guilty", colour: "var(--color-moss)" };
  if (v.penalty === "strike") return { text: "Guilty · strike", colour: "var(--color-flag)" };
  return { text: "Guilty · warning", colour: "var(--color-sand)" };
}

// The Courtroom. The accused files a defence; the jury (everyone else) votes
// guilty or not. Unanimous guilty adds a strike — decided server-side.
export function TrialView({
  trial,
  votes,
  profiles,
  currentUserId,
}: {
  trial: Trial;
  votes: TrialVote[];
  profiles: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const defendant = profiles.find((p) => p.id === trial.defendant_id);
  const jurors = profiles.filter((p) => p.id !== trial.defendant_id);
  const voteByJuror = new Map(votes.map((v) => [v.juror_id, v]));
  const isDefendant = currentUserId === trial.defendant_id;
  const myVote = voteByJuror.get(currentUserId) ?? null;
  const closed = trial.status === "closed";

  const [defence, setDefence] = useState(trial.defence ?? "");
  const [comment, setComment] = useState(myVote?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fileDefence() {
    setBusy(true);
    setError(null);
    const res = await submitDefence(trial.id, defence);
    if (!res.ok) setError(res.error);
    setBusy(false);
    router.refresh();
  }

  async function vote(v: Verdict, penalty?: Penalty) {
    setBusy(true);
    setError(null);
    const res = await castVote(trial.id, v, penalty, comment);
    if (!res.ok) setError(res.error);
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      {/* charge sheet */}
      <div className="rounded-[3px] border border-ink bg-card p-4 text-center">
        <p className="label" style={{ color: "var(--color-flag)" }}>⚖️ The Courtroom</p>
        <div className="my-3 flex justify-center">
          <Avatar name={defendant?.name ?? "?"} avatarUrl={defendant?.avatar_url} colour={defendant?.colour} size={56} />
        </div>
        <p className="text-ink">
          <span className="font-bold">{defendant?.name}</span> stands accused
        </p>
        <p className="mt-1 text-[16px] font-semibold text-ink">“{trial.charge}”</p>
      </div>

      {/* verdict banner */}
      {closed && (
        <div
          className="mt-4 rounded-[3px] p-4 text-center font-narrow text-[20px] font-bold uppercase tracking-[0.08em]"
          style={{
            backgroundColor:
              trial.verdict === "guilty"
                ? trial.penalty === "strike"
                  ? "var(--color-flag)"
                  : "var(--color-sand)"
                : "var(--color-moss)",
            color: "var(--color-paper)",
          }}
        >
          {trial.verdict === "guilty"
            ? trial.penalty === "strike"
              ? "Guilty — strike added"
              : "Guilty — warning"
            : "Not guilty"}
        </div>
      )}

      {/* defence */}
      <div className="mt-6">
        <p className="label mb-2">The defence</p>
        {isDefendant && !closed ? (
          <div className="rounded-[3px] border border-rule bg-card p-4">
            <textarea
              value={defence}
              onChange={(e) => setDefence(e.target.value)}
              rows={3}
              placeholder="Plead your case…"
              className="w-full resize-none rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
            />
            <button
              onClick={fileDefence}
              disabled={busy}
              className="mt-2 rounded-[3px] bg-ink px-5 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
            >
              {trial.defence ? "Update defence" : "File defence"}
            </button>
          </div>
        ) : trial.defence ? (
          <p className="rounded-[3px] border border-rule bg-card p-4 text-ink">“{trial.defence}”</p>
        ) : (
          <p className="text-ink-soft">No defence entered yet.</p>
        )}
      </div>

      {/* jury box */}
      <div className="mt-6">
        <p className="label mb-2">The jury</p>

        {!isDefendant && !closed && (
          <div className="mb-4 rounded-[3px] border border-rule bg-card p-4">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Your remarks (optional)"
              className="mb-3 w-full resize-none rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
            />
            <div className="grid grid-cols-3 gap-2">
              {CHOICES.map((ch) => {
                const active =
                  myVote?.vote === ch.vote &&
                  (ch.vote !== "guilty" || (myVote?.penalty ?? "warning") === ch.penalty);
                return (
                  <button
                    key={ch.key}
                    onClick={() => vote(ch.vote, ch.penalty)}
                    disabled={busy}
                    className="rounded-[3px] border py-3 font-narrow text-sm font-semibold uppercase tracking-[0.06em]"
                    style={{
                      backgroundColor: active ? ch.colour : "transparent",
                      borderColor: active ? ch.colour : "var(--color-rule)",
                      color: active ? "var(--color-paper)" : "var(--color-ink)",
                    }}
                  >
                    {ch.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              A strike needs both of you. If either picks warning, it&apos;s a warning. Three warnings add up to a strike.
            </p>
            {myVote && <p className="mt-1 text-sm text-ink-soft">Vote cast. You can change it until the last juror votes.</p>}
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {jurors.map((j) => {
            const v = voteByJuror.get(j.id);
            return (
              <li key={j.id} className="flex items-start gap-2">
                <Avatar name={j.name} avatarUrl={j.avatar_url} colour={j.colour} size={26} />
                <div className="flex-1">
                  <p className="flex items-center gap-2">
                    <span className="text-ink">{j.id === currentUserId ? "You" : j.name}</span>
                    {v ? (
                      <span
                        className="font-narrow text-xs font-semibold uppercase tracking-[0.08em]"
                        style={{ color: labelFor(v).colour }}
                      >
                        {labelFor(v).text}
                      </span>
                    ) : (
                      <span className="font-narrow text-xs font-semibold uppercase tracking-[0.08em] text-rule">
                        Undecided
                      </span>
                    )}
                  </p>
                  {v?.comment && <p className="text-ink-soft">“{v.comment}”</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {error && <p className="mt-4 text-sm text-flag">{error}</p>}
    </div>
  );
}
