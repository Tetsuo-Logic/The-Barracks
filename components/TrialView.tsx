"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitDefence, castVote, openJury, rulePresident } from "@/app/actions/trials";
import { Avatar } from "@/components/Avatar";
import { useAnnounce } from "@/components/Announce";
import type { Penalty, Profile, Trial, TrialVote, Verdict } from "@/lib/types";

// The Courtroom, restructured: the accuser states the charge, the accused enters
// a plea, then the President rules — Guilty (warning or strike) or Not guilty
// (case dismissed, or noted). The jury is optional and advisory.
export function TrialView({
  trial,
  votes,
  profiles,
  currentUserId,
  canRule = false,
}: {
  trial: Trial;
  votes: TrialVote[];
  profiles: Profile[];
  currentUserId: string;
  canRule?: boolean;
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const defendant = profiles.find((p) => p.id === trial.defendant_id);
  const jurors = profiles.filter((p) => p.id !== trial.defendant_id);
  const voteByJuror = new Map(votes.map((v) => [v.juror_id, v]));
  const isDefendant = currentUserId === trial.defendant_id;
  const myVote = voteByJuror.get(currentUserId) ?? null;
  const open = trial.status === "open";
  const closed = !open;
  const guiltyCount = votes.filter((v) => v.vote === "guilty").length;
  const notGuiltyCount = votes.filter((v) => v.vote === "not_guilty").length;

  const [defence, setDefence] = useState(trial.defence ?? "");
  const [comment, setComment] = useState(myVote?.comment ?? "");
  // President's ruling flow: pick a verdict, then the follow-up.
  const [stage, setStage] = useState<null | "guilty" | "not_guilty">(null);
  const [penalty, setPenalty] = useState<Penalty | null>(null);
  const [resolution, setResolution] = useState<null | "dismissed" | "noted">(null);
  const [note, setNote] = useState("");
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

  async function steer(v: Verdict) {
    setBusy(true);
    setError(null);
    const res = await castVote(trial.id, v, comment);
    if (!res.ok) setError(res.error);
    setBusy(false);
    router.refresh();
  }

  async function callJury() {
    setBusy(true);
    setError(null);
    const res = await openJury(trial.id);
    if (!res.ok) setError(res.error);
    setBusy(false);
    if (res.ok) {
      announce("Jury called · steers requested");
      router.refresh();
    }
  }

  async function rule(input: { verdict: Verdict; penalty?: Penalty; note?: string }) {
    setBusy(true);
    setError(null);
    const res = await rulePresident(trial.id, input);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    announce(
      input.verdict === "guilty"
        ? `Verdict · guilty, ${input.penalty ?? "warning"}`
        : input.note
          ? "Verdict · not guilty, noted"
          : "Case dismissed",
    );
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
        <div className="mt-4">
          <div
            className="rounded-[3px] p-4 text-center font-narrow text-[20px] font-bold uppercase tracking-[0.08em]"
            style={{
              backgroundColor:
                trial.verdict === "guilty"
                  ? trial.penalty === "strike"
                    ? "var(--color-flag)"
                    : "var(--color-sand)"
                  : trial.note
                    ? "var(--color-moss)"
                    : "var(--color-ink-soft)",
              color: "var(--color-paper)",
            }}
          >
            {trial.verdict === "guilty"
              ? trial.penalty === "strike"
                ? "Guilty — strike added"
                : "Guilty — warning"
              : trial.note
                ? "Not guilty — noted"
                : "Case dismissed"}
          </div>
          {trial.note && (
            <p className="mt-2 rounded-[3px] border-l-2 border-rule bg-card px-3 py-2 text-sm text-ink-soft">
              <span className="label">On the record:</span> {trial.note}
            </p>
          )}
        </div>
      )}

      {/* defence / plea */}
      <div className="mt-6">
        <p className="label mb-2">The defence</p>
        {isDefendant && open ? (
          <div className="rounded-[3px] border border-rule bg-card p-4">
            <textarea
              value={defence}
              onChange={(e) => setDefence(e.target.value)}
              rows={3}
              placeholder="Enter your plea…"
              className="w-full resize-none rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
            />
            <button
              onClick={fileDefence}
              disabled={busy}
              className="mt-2 rounded-[3px] bg-ink px-5 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
            >
              {trial.defence ? "Update plea" : "Enter plea"}
            </button>
          </div>
        ) : trial.defence ? (
          <p className="rounded-[3px] border border-rule bg-card p-4 text-ink">“{trial.defence}”</p>
        ) : (
          <p className="text-ink-soft">No plea entered yet.</p>
        )}
      </div>

      {/* President's ruling — the final call */}
      {canRule && !isDefendant && open && (
        <div className="mt-6">
          <p className="label mb-2" style={{ color: "var(--color-flag)" }}>The President rules</p>
          <div className="rounded-[3px] border border-flag/50 bg-card p-4">
            {/* step 1 — guilty or not */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setStage("guilty");
                  setResolution(null);
                }}
                disabled={busy}
                className="rounded-[3px] border py-3 font-narrow text-sm font-semibold uppercase tracking-[0.06em]"
                style={{
                  backgroundColor: stage === "guilty" ? "var(--color-flag)" : "transparent",
                  borderColor: stage === "guilty" ? "var(--color-flag)" : "var(--color-rule)",
                  color: stage === "guilty" ? "var(--color-paper)" : "var(--color-ink)",
                }}
              >
                Guilty
              </button>
              <button
                onClick={() => {
                  setStage("not_guilty");
                  setPenalty(null);
                }}
                disabled={busy}
                className="rounded-[3px] border py-3 font-narrow text-sm font-semibold uppercase tracking-[0.06em]"
                style={{
                  backgroundColor: stage === "not_guilty" ? "var(--color-moss)" : "transparent",
                  borderColor: stage === "not_guilty" ? "var(--color-moss)" : "var(--color-rule)",
                  color: stage === "not_guilty" ? "var(--color-paper)" : "var(--color-ink)",
                }}
              >
                Not guilty
              </button>
            </div>

            {/* step 2a — guilty → warning or strike */}
            {stage === "guilty" && (
              <div className="mt-3">
                <p className="label mb-2">The penalty</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["warning", "strike"] as Penalty[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPenalty(p)}
                      disabled={busy}
                      className="rounded-[3px] border py-2.5 font-narrow text-sm font-semibold uppercase tracking-[0.06em] capitalize"
                      style={{
                        backgroundColor:
                          penalty === p ? (p === "strike" ? "var(--color-flag)" : "var(--color-sand)") : "transparent",
                        borderColor:
                          penalty === p ? (p === "strike" ? "var(--color-flag)" : "var(--color-sand)") : "var(--color-rule)",
                        color: penalty === p ? "var(--color-paper)" : "var(--color-ink)",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-soft">
                  Three warnings add up to a strike.
                </p>
                <button
                  onClick={() => rule({ verdict: "guilty", penalty: penalty ?? "warning" })}
                  disabled={busy || !penalty}
                  className="mt-3 w-full rounded-[3px] bg-ink px-5 py-2.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
                >
                  {busy ? "Recording" : `Deliver verdict — guilty, ${penalty ?? "…"}`}
                </button>
              </div>
            )}

            {/* step 2b — not guilty → dismissed or noted */}
            {stage === "not_guilty" && (
              <div className="mt-3">
                <p className="label mb-2">The outcome</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setResolution("dismissed")}
                    disabled={busy}
                    className="rounded-[3px] border py-2.5 font-narrow text-sm font-semibold uppercase tracking-[0.06em]"
                    style={{
                      backgroundColor: resolution === "dismissed" ? "var(--color-ink)" : "transparent",
                      borderColor: resolution === "dismissed" ? "var(--color-ink)" : "var(--color-rule)",
                      color: resolution === "dismissed" ? "var(--color-paper)" : "var(--color-ink)",
                    }}
                  >
                    Case dismissed
                  </button>
                  <button
                    onClick={() => setResolution("noted")}
                    disabled={busy}
                    className="rounded-[3px] border py-2.5 font-narrow text-sm font-semibold uppercase tracking-[0.06em]"
                    style={{
                      backgroundColor: resolution === "noted" ? "var(--color-sand)" : "transparent",
                      borderColor: resolution === "noted" ? "var(--color-sand)" : "var(--color-rule)",
                      color: resolution === "noted" ? "var(--color-paper)" : "var(--color-ink)",
                    }}
                  >
                    Note it
                  </button>
                </div>

                {resolution === "noted" && (
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder={`Goes on ${defendant?.name ?? "the player"}'s record…`}
                    className="mt-3 w-full resize-none rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
                  />
                )}

                <button
                  onClick={() =>
                    rule(
                      resolution === "noted"
                        ? { verdict: "not_guilty", note: note.trim() || trial.charge }
                        : { verdict: "not_guilty" },
                    )
                  }
                  disabled={busy || !resolution}
                  className="mt-3 w-full rounded-[3px] bg-ink px-5 py-2.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
                >
                  {busy
                    ? "Recording"
                    : resolution === "noted"
                      ? "Not guilty — add the note"
                      : "Dismiss the case"}
                </button>
              </div>
            )}
          </div>

          {/* optional: consult the jury */}
          {!trial.jury_opened && (
            <button
              onClick={callJury}
              disabled={busy}
              className="mt-3 w-full rounded-[3px] border border-rule py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-ink-soft hover:text-ink disabled:opacity-50"
            >
              👥 Ask the jury first (guilty / not guilty)
            </button>
          )}
        </div>
      )}

      {/* the jury — only once the President calls it. Advisory guilty/not-guilty. */}
      {trial.jury_opened && (
        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="label">The jury</p>
            <p className="font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
              <span style={{ color: "var(--color-flag)" }}>{guiltyCount} guilty</span>
              {"  ·  "}
              <span style={{ color: "var(--color-moss)" }}>{notGuiltyCount} not</span>
            </p>
          </div>

          {!isDefendant && open && (
            <div className="mb-4 rounded-[3px] border border-rule bg-card p-4">
              <p className="mb-2 text-sm text-ink-soft">Your steer — the President decides the rest.</p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Your remarks (optional)"
                className="mb-3 w-full resize-none rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => steer("guilty")}
                  disabled={busy}
                  className="rounded-[3px] border py-3 font-narrow text-sm font-semibold uppercase tracking-[0.06em]"
                  style={{
                    backgroundColor: myVote?.vote === "guilty" ? "var(--color-flag)" : "transparent",
                    borderColor: myVote?.vote === "guilty" ? "var(--color-flag)" : "var(--color-rule)",
                    color: myVote?.vote === "guilty" ? "var(--color-paper)" : "var(--color-ink)",
                  }}
                >
                  Guilty
                </button>
                <button
                  onClick={() => steer("not_guilty")}
                  disabled={busy}
                  className="rounded-[3px] border py-3 font-narrow text-sm font-semibold uppercase tracking-[0.06em]"
                  style={{
                    backgroundColor: myVote?.vote === "not_guilty" ? "var(--color-moss)" : "transparent",
                    borderColor: myVote?.vote === "not_guilty" ? "var(--color-moss)" : "var(--color-rule)",
                    color: myVote?.vote === "not_guilty" ? "var(--color-paper)" : "var(--color-ink)",
                  }}
                >
                  Not guilty
                </button>
              </div>
              {myVote && <p className="mt-2 text-sm text-ink-soft">Steer logged. Change it any time before the ruling.</p>}
            </div>
          )}

          <ul className="flex flex-col gap-3">
            {jurors.map((j) => {
              const v = voteByJuror.get(j.id);
              const colour = !v
                ? "var(--color-rule)"
                : v.vote === "guilty"
                  ? "var(--color-flag)"
                  : "var(--color-moss)";
              return (
                <li key={j.id} className="flex items-start gap-2">
                  <Avatar name={j.name} avatarUrl={j.avatar_url} colour={j.colour} size={26} />
                  <div className="flex-1">
                    <p className="flex items-center gap-2">
                      <span className="text-ink">{j.id === currentUserId ? "You" : j.name}</span>
                      <span className="font-narrow text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: colour }}>
                        {!v ? "Undecided" : v.vote === "guilty" ? "Guilty" : "Not guilty"}
                      </span>
                    </p>
                    {v?.comment && <p className="text-ink-soft">“{v.comment}”</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-flag">{error}</p>}
    </div>
  );
}
