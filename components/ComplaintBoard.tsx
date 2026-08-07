"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fileComplaint, ruleOnComplaint } from "@/app/actions/board";
import { Avatar } from "@/components/Avatar";
import { relativeTime } from "@/lib/dates";
import type { Complaint, Profile } from "@/lib/types";

export function ComplaintBoard({
  complaints,
  profiles,
  currentUserId,
  canRule,
}: {
  complaints: Complaint[];
  profiles: Profile[];
  currentUserId: string;
  canRule: boolean;
}) {
  const router = useRouter();
  const byId = new Map(profiles.map((p) => [p.id, p]));

  const [reason, setReason] = useState("");
  const [action, setAction] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function file() {
    setBusy(true);
    setError(null);
    const res = await fileComplaint({ reason, action, comment });
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    setReason("");
    setAction("");
    setComment("");
    setBusy(false);
    router.refresh();
  }

  const open = complaints.filter((c) => c.status === "open");
  const closed = complaints.filter((c) => c.status === "addressed");

  return (
    <div>
      {/* file a complaint */}
      <div className="rounded-[3px] border border-rule bg-card p-4">
        <p className="label mb-3">Raise it with the board</p>
        <label className="label mb-1 block">The complaint</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Mac takes 20 minutes on every green"
          className="mb-3 w-full rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
        />
        <label className="label mb-1 block">Action you want</label>
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="A formal warning and a two-shot penalty"
          className="mb-3 w-full rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
        />
        <label className="label mb-1 block">Comment</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="It's affecting morale."
          className="w-full resize-none rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
        />
        {error && <p className="mt-2 text-sm text-flag">{error}</p>}
        <button
          onClick={file}
          disabled={busy || !reason.trim()}
          className="mt-3 w-full rounded-[3px] bg-ink px-4 py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
        >
          {busy ? "Filing" : "File it"}
        </button>
      </div>

      {/* awaiting a ruling */}
      <div className="mt-8">
        <p className="label mb-1">Before the president</p>
        <hr className="rule mb-2" />
        {open.length === 0 ? (
          <p className="py-6 text-center text-ink-soft">Nothing outstanding. A peaceful reign.</p>
        ) : (
          open.map((c) => (
            <ComplaintCard key={c.id} c={c} byId={byId} currentUserId={currentUserId} canRule={canRule} />
          ))
        )}
      </div>

      {/* ruled on */}
      {closed.length > 0 && (
        <div className="mt-8">
          <p className="label mb-1">Ruled on</p>
          <hr className="rule mb-2" />
          {closed.map((c) => (
            <ComplaintCard key={c.id} c={c} byId={byId} currentUserId={currentUserId} canRule={false} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComplaintCard({
  c,
  byId,
  currentUserId,
  canRule,
}: {
  c: Complaint;
  byId: Map<string, Profile>;
  currentUserId: string;
  canRule: boolean;
}) {
  const router = useRouter();
  const filer = c.filed_by ? byId.get(c.filed_by) : null;
  const [ruling, setRuling] = useState("");
  const [busy, setBusy] = useState(false);

  async function rule() {
    setBusy(true);
    const res = await ruleOnComplaint(c.id, ruling);
    setBusy(false);
    if (res.ok) router.refresh();
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
      <p className="mt-1 font-semibold text-ink">{c.reason}</p>
      {c.action && (
        <p className="text-sm text-ink-soft">
          <span className="label">Wants:</span> {c.action}
        </p>
      )}
      {c.comment && <p className="text-sm text-ink-soft">“{c.comment}”</p>}

      {c.status === "addressed" ? (
        <div className="mt-2 rounded-[3px] border-l-2 border-sand bg-card px-3 py-2">
          <p className="label mb-0.5" style={{ color: "var(--color-sand)" }}>The ruling</p>
          <p className="text-ink">{c.ruling || "Dismissed without comment."}</p>
        </div>
      ) : canRule ? (
        <div className="mt-3 rounded-[3px] border border-rule bg-card p-3">
          <p className="label mb-1">Your ruling</p>
          <textarea
            value={ruling}
            onChange={(e) => setRuling(e.target.value)}
            rows={2}
            placeholder="Complaint upheld. Mac to buy the first round."
            className="mb-2 w-full resize-none rounded-[3px] border border-rule bg-paper px-3 py-2 text-ink outline-none focus:border-ink"
          />
          <button
            onClick={rule}
            disabled={busy}
            className="rounded-[3px] bg-ink px-5 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
          >
            {busy ? "Ruling" : "Rule on it"}
          </button>
        </div>
      ) : (
        <p className="mt-2 font-narrow text-xs font-semibold uppercase tracking-[0.08em] text-sand">
          Awaiting the president&apos;s ruling
        </p>
      )}
    </div>
  );
}
