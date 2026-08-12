"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  fileComplaint,
  ruleOnComplaint,
  respondToComplaint,
  requestSecondOpinion,
  submitSecondOpinion,
  sendComplaintToCourt,
  deleteComplaint,
} from "@/app/actions/board";
import { Avatar } from "@/components/Avatar";
import { useAnnounce } from "@/components/Announce";
import { relativeTime } from "@/lib/dates";
import type { Complaint, Profile } from "@/lib/types";

export function ComplaintBoard({
  complaints,
  profiles,
  currentUserId,
  canRule,
  isAdmin = false,
}: {
  complaints: Complaint[];
  profiles: Profile[];
  currentUserId: string;
  canRule: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const byId = new Map(profiles.map((p) => [p.id, p]));

  const [composing, setComposing] = useState(false);
  const [tab, setTab] = useState<"active" | "previous">("active");
  const [reason, setReason] = useState("");
  const [action, setAction] = useState("");
  const [comment, setComment] = useState("");
  const [againstId, setAgainstId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = profiles.filter((p) => p.id !== currentUserId);

  async function file() {
    setBusy(true);
    setError(null);
    const res = await fileComplaint({ reason, action, comment, againstId: againstId || null });
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    setReason("");
    setAction("");
    setComment("");
    setAgainstId("");
    setComposing(false);
    setBusy(false);
    announce("Complaint filed · before the board");
    router.refresh();
  }

  const open = complaints.filter((c) => c.status === "open");
  const closed = complaints.filter((c) => c.status === "addressed");

  return (
    <div>
      {/* header row + collapsed compose (matches Radar / Requests) */}
      <div className="mb-1 flex items-center justify-between">
        <p className="label">Before the President</p>
        {!composing && (
          <button
            onClick={() => setComposing(true)}
            className="rounded-[4px] border border-rule px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            ⚖ File a complaint
          </button>
        )}
      </div>
      <hr className="rule" />

      {composing && (
        <div className="mt-3 rounded-[3px] border border-rule bg-card p-4">
          <label className="label mb-1 block">Who&apos;s it about?</label>
          <select
            value={againstId}
            onChange={(e) => setAgainstId(e.target.value)}
            className="mb-3 w-full rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
          >
            <option value="">No One In Particular</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <label className="label mb-1 block">The complaint</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Went AWOL and left us a man down"
            className="mb-3 w-full rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
          />
          <label className="label mb-1 block">Action you want</label>
          <div className="relative mb-3">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full appearance-none rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
            >
              <option value="">No Specific Action — Just Raising It</option>
              <option value="Formal Warning">Formal Warning</option>
              <option value="Strike">Strike</option>
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft">
              ▾
            </span>
          </div>
          <label className="label mb-1 block">Comment</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="It's affecting morale."
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
              Cancel
            </button>
            <button
              onClick={file}
              disabled={busy || !reason.trim()}
              className="flex-1 rounded-[3px] bg-ink px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
            >
              {busy ? "Filing" : "File it"}
            </button>
          </div>
        </div>
      )}

      {/* Active / Previous — keep the board on current cases; archive below */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          onClick={() => setTab("active")}
          className="rounded-[3px] border py-2 font-narrow text-sm font-semibold uppercase tracking-[0.06em] transition-colors"
          style={{
            backgroundColor: tab === "active" ? "var(--color-ink)" : "transparent",
            borderColor: tab === "active" ? "var(--color-ink)" : "var(--color-rule)",
            color: tab === "active" ? "var(--color-paper)" : "var(--color-ink-soft)",
          }}
        >
          Active{open.length > 0 ? ` · ${open.length}` : ""}
        </button>
        <button
          onClick={() => setTab("previous")}
          className="rounded-[3px] border py-2 font-narrow text-sm font-semibold uppercase tracking-[0.06em] transition-colors"
          style={{
            backgroundColor: tab === "previous" ? "var(--color-ink)" : "transparent",
            borderColor: tab === "previous" ? "var(--color-ink)" : "var(--color-rule)",
            color: tab === "previous" ? "var(--color-paper)" : "var(--color-ink-soft)",
          }}
        >
          Previous{closed.length > 0 ? ` · ${closed.length}` : ""}
        </button>
      </div>

      {tab === "active" ? (
        <div className="mt-3">
          {open.length === 0 ? (
            <p className="py-6 text-center text-ink-soft">Nothing outstanding. A peaceful reign.</p>
          ) : (
            open.map((c) => (
              <ComplaintCard
                key={c.id}
                c={c}
                byId={byId}
                others={others}
                currentUserId={currentUserId}
                canRule={canRule}
                isAdmin={isAdmin}
                canManage={canRule}
              />
            ))
          )}
        </div>
      ) : (
        <div className="mt-3">
          {closed.length === 0 ? (
            <p className="py-6 text-center text-ink-soft">Nothing ruled on yet.</p>
          ) : (
            closed.map((c) => (
              <ComplaintCard
                key={c.id}
                c={c}
                byId={byId}
                others={others}
                currentUserId={currentUserId}
                canRule={false}
                isAdmin={false}
                canManage={canRule}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ComplaintCard({
  c,
  byId,
  others,
  currentUserId,
  canRule,
  isAdmin,
  canManage = false,
}: {
  c: Complaint;
  byId: Map<string, Profile>;
  others: Profile[];
  currentUserId: string;
  canRule: boolean;
  isAdmin: boolean;
  canManage?: boolean; // CO/President may bin a stuck case at any point
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const filer = c.filed_by ? byId.get(c.filed_by) : null;
  const against = c.against_id ? byId.get(c.against_id) : null;
  const opinionGiver = c.second_opinion_by ? byId.get(c.second_opinion_by) : null;

  const isSubject = c.against_id === currentUserId;
  const isOpinionGiver = c.second_opinion_by === currentUserId;
  const open = c.status === "open";

  const [ruling, setRuling] = useState("");
  const [response, setResponse] = useState("");
  const [opinion, setOpinion] = useState("");
  const [toCourt, setToCourt] = useState(false);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function toCourtHandler() {
    if (!confirm("Send this to the Courtroom? It opens a trial with them as the defendant.")) return;
    setBusy(true);
    const res = await sendComplaintToCourt(c.id);
    setBusy(false);
    if (res.ok) {
      announce("Referred to the Courtroom · trial opened");
      router.push(`/trial/${res.trialId}`);
    }
  }

  return (
    <div className="border-b border-rule py-3">
      <div className="flex items-center gap-2">
        <Avatar name={filer?.name ?? "?"} avatarUrl={filer?.avatar_url} colour={filer?.colour} size={22} />
        <span className="text-sm text-ink">
          {filer?.id === currentUserId ? "You" : (filer?.name ?? "Someone")}
        </span>
        <span className="text-xs text-ink-soft">{relativeTime(c.created_at)}</span>
      </div>

      {against && (
        <p className="mt-1 font-narrow text-xs font-semibold uppercase tracking-[0.08em] text-flag">
          About: {against.id === currentUserId ? "you" : against.name}
        </p>
      )}

      <p className="mt-1 font-semibold text-ink">{c.reason}</p>
      {c.action && (
        <p className="text-sm text-ink-soft">
          <span className="label">Wants:</span> {c.action}
        </p>
      )}
      {c.comment && <p className="text-sm text-ink-soft">“{c.comment}”</p>}

      {/* the subject's response */}
      {c.response ? (
        <div className="mt-2 rounded-[3px] border-l-2 border-rule bg-card px-3 py-2">
          <p className="label mb-0.5">{against?.id === currentUserId ? "Your response" : `${against?.name ?? "Response"}`}</p>
          <p className="text-ink">{c.response}</p>
        </div>
      ) : (
        isSubject &&
        open && (
          <div className="mt-3 rounded-[3px] border border-rule bg-card p-3">
            <p className="label mb-1">Your response</p>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={2}
              placeholder="In my defence…"
              className="mb-2 w-full resize-none rounded-[3px] border border-rule bg-paper px-3 py-2 text-ink outline-none focus:border-ink"
            />
            <button
              onClick={() => run(() => respondToComplaint(c.id, response))}
              disabled={busy || !response.trim()}
              className="rounded-[3px] bg-ink px-5 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
            >
              {busy ? "Saving" : "Respond"}
            </button>
          </div>
        )
      )}

      {/* second opinion — given, pending, or a box for the nominated player */}
      {c.second_opinion ? (
        <div className="mt-2 rounded-[3px] border-l-2 border-moss bg-card px-3 py-2">
          <p className="label mb-0.5" style={{ color: "var(--color-moss)" }}>
            Second opinion{opinionGiver ? ` — ${opinionGiver.name}` : ""}
          </p>
          <p className="text-ink">{c.second_opinion}</p>
          {c.second_opinion_to_court && (
            <p className="mt-1 font-narrow text-xs font-semibold uppercase tracking-[0.08em] text-flag">
              Reckons it&apos;s one for the court
            </p>
          )}
        </div>
      ) : isOpinionGiver && open ? (
        <div className="mt-3 rounded-[3px] border border-moss bg-card p-3">
          <p className="label mb-1" style={{ color: "var(--color-moss)" }}>
            Your second opinion
          </p>
          <textarea
            value={opinion}
            onChange={(e) => setOpinion(e.target.value)}
            rows={2}
            placeholder="Honestly, he's got a point…"
            className="mb-2 w-full resize-none rounded-[3px] border border-rule bg-paper px-3 py-2 text-ink outline-none focus:border-ink"
          />
          <label className="mb-2 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={toCourt}
              onChange={(e) => setToCourt(e.target.checked)}
              className="h-4 w-4"
            />
            Should this be taken to court?
          </label>
          <button
            onClick={() => run(() => submitSecondOpinion(c.id, opinion, toCourt))}
            disabled={busy || !opinion.trim()}
            className="rounded-[3px] bg-ink px-5 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
          >
            {busy ? "Saving" : "Give opinion"}
          </button>
        </div>
      ) : (
        c.second_opinion_by &&
        open && (
          <p className="mt-2 font-narrow text-xs font-semibold uppercase tracking-[0.08em] text-moss">
            Second opinion wanted from {opinionGiver?.name ?? "a player"}
          </p>
        )
      )}

      {/* A ruler can't sit in judgement on a complaint about themselves — the
          tools are hidden and it has to go to the court instead. */}
      {open && canRule && isSubject && (
        <p className="mt-3 rounded-[3px] border border-flag/50 bg-card px-3 py-2 text-sm text-ink-soft">
          ⚖️ This one&apos;s about you — you can&apos;t rule on it. Respond above; it&apos;s for the
          court to settle.
        </p>
      )}

      {/* president tools: ask for a second opinion + rule */}
      {open && canRule && !isSubject && (
        <div className="mt-3 space-y-3">
          {!c.second_opinion && (
            <div className="rounded-[3px] border border-rule bg-card p-3">
              <p className="label mb-1">Ask for a second opinion</p>
              <div className="flex gap-2">
                <select
                  value={pick}
                  onChange={(e) => setPick(e.target.value)}
                  className="min-w-0 flex-1 rounded-[3px] border border-rule bg-paper px-3 py-2 text-ink outline-none focus:border-ink"
                >
                  <option value="">Pick A Player</option>
                  {others.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => run(() => requestSecondOpinion(c.id, pick))}
                  disabled={busy || !pick}
                  className="shrink-0 rounded-[3px] border border-ink px-4 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink disabled:opacity-50"
                >
                  Ask
                </button>
              </div>
            </div>
          )}

          {isAdmin && c.against_id && (
            <div className="rounded-[3px] border border-flag/50 bg-card p-3">
              <p className="label mb-1" style={{ color: "var(--color-flag)" }}>
                Take it to court
              </p>
              <p className="mb-2 text-sm text-ink-soft">
                {c.second_opinion_to_court
                  ? "The second opinion says this is one for the court."
                  : "Open a trial with them as the defendant."}
              </p>
              <button
                onClick={toCourtHandler}
                disabled={busy}
                className="rounded-[3px] bg-flag px-5 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
              >
                {busy ? "Opening" : "Send to court"}
              </button>
            </div>
          )}

          <div className="rounded-[3px] border border-rule bg-card p-3">
            <p className="label mb-1">Your ruling</p>
            <textarea
              value={ruling}
              onChange={(e) => setRuling(e.target.value)}
              rows={2}
              placeholder="Complaint upheld — offender buys the first round."
              className="mb-2 w-full resize-none rounded-[3px] border border-rule bg-paper px-3 py-2 text-ink outline-none focus:border-ink"
            />
            <button
              onClick={() => run(() => ruleOnComplaint(c.id, ruling))}
              disabled={busy}
              className="rounded-[3px] bg-ink px-5 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
            >
              {busy ? "Ruling" : "Rule on it"}
            </button>
          </div>
        </div>
      )}

      {/* the ruling, once made */}
      {c.status === "addressed" && (
        <div className="mt-2 rounded-[3px] border-l-2 border-sand bg-card px-3 py-2">
          <p className="label mb-0.5" style={{ color: "var(--color-sand)" }}>The ruling</p>
          <p className="text-ink">{c.ruling || "Dismissed without comment."}</p>
        </div>
      )}

      {/* Bin a stuck case — the CO/President any time, the filer withdraws theirs */}
      {(canManage || c.filed_by === currentUserId) && (
        <div className="mt-3 flex justify-end">
          {confirmDel ? (
            <div className="flex items-center gap-2 rounded-[3px] border border-flag/50 bg-paper px-3 py-2">
              <span className="text-xs text-flag">Delete this case?</span>
              <button
                onClick={() => {
                  setConfirmDel(false);
                  run(() => deleteComplaint(c.id));
                }}
                disabled={busy}
                className="rounded-[3px] bg-flag px-3 py-1 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-paper disabled:opacity-60"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                className="font-mono text-xs uppercase tracking-[0.06em] text-ink-soft"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              disabled={busy}
              className="rounded-[4px] border border-rule px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] text-ink-soft transition-colors hover:border-flag hover:text-flag"
            >
              🗑 {canManage ? "Delete case" : "Withdraw"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
