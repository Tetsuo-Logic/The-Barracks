"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BroadcastRow } from "@/components/BroadcastRow";
import { Avatar } from "@/components/Avatar";
import { deleteActivity, type DeletableKind } from "@/app/actions/activity";
import { relativeTime, shortDate } from "@/lib/dates";
import { compHeading } from "@/lib/games";
import type { Activity, ActivityItem } from "@/lib/queries";
import type { Profile, Trial } from "@/lib/types";

// A stable key per feed row, and — where the row maps to a deletable entity —
// its {kind, id}. "result" rows aren't deletable on their own (delete the round
// via its "Round added" row instead).
function rowKey(item: ActivityItem): string {
  switch (item.kind) {
    case "broadcast":
      return `b-${item.broadcast.id}`;
    case "trial":
      return `t-${item.trial.id}`;
    case "round":
      return `r-${item.comp.id}`;
    case "result":
      return `res-${item.comp.id}`;
    case "comment":
      return `c-${item.comment.id}`;
  }
}

function deleteTarget(item: ActivityItem): { kind: DeletableKind; id: string } | null {
  switch (item.kind) {
    case "broadcast":
      return { kind: "broadcast", id: item.broadcast.id };
    case "trial":
      return { kind: "trial", id: item.trial.id };
    case "round":
      return { kind: "competition", id: item.comp.id };
    case "comment":
      return { kind: "comment", id: item.comment.id };
    case "result":
      return null;
  }
}

type FilterKey = "all" | "messages" | "rounds" | "comments" | "court";

const FILTERS: { key: FilterKey; label: string; match: (i: ActivityItem) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "messages", label: "Messages", match: (i) => i.kind === "broadcast" },
  { key: "rounds", label: "Rounds", match: (i) => i.kind === "round" || i.kind === "result" },
  { key: "comments", label: "Comments", match: (i) => i.kind === "comment" },
  { key: "court", label: "Court", match: (i) => i.kind === "trial" },
];

// The shared, read-only history: every broadcast, round, result, comment and
// trial in one time-sorted feed, with tabs to narrow it down.
export function ActivityFeed({
  activity,
  currentUserId,
  isAdmin = false,
}: {
  activity: Activity;
  currentUserId: string;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const { items, profiles, totalPlayers } = activity;
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const shown = items.filter(active.match);

  function toggle(key: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function cancel() {
    setSelecting(false);
    setSelected(new Set());
    setError(null);
  }

  async function doDelete() {
    // Map selected row-keys back to their delete targets, deduped by the action.
    const targets = shown
      .filter((it) => selected.has(rowKey(it)))
      .map(deleteTarget)
      .filter((t): t is { kind: DeletableKind; id: string } => t !== null);
    if (targets.length === 0) return;
    if (!confirm(`Delete ${targets.length} item${targets.length === 1 ? "" : "s"} for good? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    const res = await deleteActivity(targets);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't delete those.");
      return;
    }
    cancel();
    router.refresh();
  }

  return (
    <div>
      {isAdmin && (
        <div className="mb-3 flex items-center justify-between">
          {!selecting ? (
            <button
              onClick={() => setSelecting(true)}
              className="font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink-soft"
            >
              Select to delete
            </button>
          ) : (
            <>
              <button
                onClick={doDelete}
                disabled={busy || selected.size === 0}
                className="rounded-[3px] bg-flag px-4 py-1.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
              >
                {busy ? "Deleting" : `Delete (${selected.size})`}
              </button>
              <button
                onClick={cancel}
                disabled={busy}
                className="font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink-soft"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
      {error && <p className="mb-2 text-sm text-flag">{error}</p>}

      <div className="mb-3 flex overflow-hidden rounded-[3px] border border-rule">
        {FILTERS.map((f, i) => {
          const on = f.key === filter;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="flex-1 py-2 font-narrow text-xs font-semibold uppercase tracking-[0.04em] transition-colors"
              style={{
                backgroundColor: on ? "var(--color-ink)" : "transparent",
                color: on ? "var(--color-paper)" : "var(--color-ink)",
                borderLeft: i > 0 ? "1px solid var(--color-rule)" : "none",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-soft">
          {filter === "all" ? "Nothing here yet." : `No ${active.label.toLowerCase()} yet.`}
        </p>
      ) : (
        shown.map((item) => {
          const node = renderItem(item, byId, totalPlayers, currentUserId);
          if (!selecting) return node;
          const target = deleteTarget(item);
          const key = rowKey(item);
          const on = selected.has(key);
          return (
            <div key={`sel-${key}`} className="relative">
              {node}
              {/* Overlay intercepts the row's click so it selects instead of
                  navigating. Result rows aren't deletable → no overlay. */}
              {target && (
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-label={on ? "Deselect" : "Select"}
                  aria-pressed={on}
                  className="absolute inset-0 flex items-center justify-end pr-1"
                  style={{ backgroundColor: on ? "rgba(180,55,42,0.08)" : "transparent" }}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-[3px] border text-[11px] font-bold text-paper"
                    style={{
                      borderColor: on ? "var(--color-flag)" : "var(--color-rule)",
                      backgroundColor: on ? "var(--color-flag)" : "var(--color-paper)",
                    }}
                  >
                    {on ? "✓" : ""}
                  </span>
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function renderItem(
  item: ActivityItem,
  byId: Map<string, Profile>,
  totalPlayers: number,
  currentUserId: string,
) {
  switch (item.kind) {
    case "broadcast":
      return (
        <BroadcastRow
          key={`b-${item.broadcast.id}`}
          broadcast={item.broadcast}
          responses={item.responses}
          totalPlayers={totalPlayers}
          answered={item.answered}
        />
      );
    case "trial":
      return <TrialRow key={`t-${item.trial.id}`} trial={item.trial} byId={byId} />;
    case "round":
      return (
        <Link
          key={`r-${item.comp.id}`}
          href={`/comp/${item.comp.id}`}
          className="block border-b border-rule py-3"
        >
          <div className="flex items-center justify-between">
            <span className="label" style={{ color: "var(--color-moss)" }}>
              Game added
            </span>
            <span className="text-xs text-ink-soft">{relativeTime(item.at)}</span>
          </div>
          <p className="mt-1 text-ink">
            <span className="font-semibold">{compHeading(item.comp)}</span>
            <span className="text-ink-soft"> · {shortDate(item.comp.date)}</span>
          </p>
        </Link>
      );
    case "result":
      return (
        <Link
          key={`res-${item.comp.id}`}
          href={`/comp/${item.comp.id}`}
          className="block border-b border-rule py-3"
        >
          <div className="flex items-center justify-between">
            <span className="label" style={{ color: "var(--color-sand)" }}>
              Result posted
            </span>
            <span className="text-xs text-ink-soft">{relativeTime(item.at)}</span>
          </div>
          <p className="mt-1 text-ink">
            <span className="font-semibold">{compHeading(item.comp)}</span>
            <span className="text-ink-soft"> · {shortDate(item.comp.date)}</span>
          </p>
        </Link>
      );
    case "comment": {
      const author = item.comment.author_id ? byId.get(item.comment.author_id) : undefined;
      return (
        <Link
          key={`c-${item.comment.id}`}
          href={`/comp/${item.comp.id}`}
          className="block border-b border-rule py-3"
        >
          <div className="flex items-center justify-between">
            <span className="label">Comment</span>
            <span className="text-xs text-ink-soft">{relativeTime(item.at)}</span>
          </div>
          <div className="mt-1 flex items-start gap-2">
            <Avatar
              name={author?.name ?? item.authorName}
              avatarUrl={author?.avatar_url}
              colour={author?.colour}
              size={22}
            />
            <p className="flex-1 text-ink">
              <span className="font-semibold">
                {item.comment.author_id === currentUserId ? "You" : item.authorName}
              </span>{" "}
              on {compHeading(item.comp)} — “{item.comment.body}”
            </p>
          </div>
        </Link>
      );
    }
  }
}

function TrialRow({ trial, byId }: { trial: Trial; byId: Map<string, Profile> }) {
  const accused = byId.get(trial.defendant_id);
  const jury = [...byId.values()]
    .filter((p) => p.id !== trial.defendant_id)
    .map((p) => p.nickname ?? p.name)
    .join(", ");

  return (
    <Link href={`/trial/${trial.id}`} className="block border-b border-rule py-3">
      <div className="flex items-center justify-between">
        <span className="label" style={{ color: "var(--color-flag)" }}>
          The Tribunal
        </span>
        <span className="flex items-center gap-2 text-xs text-ink-soft">
          <span
            className="font-narrow font-semibold uppercase tracking-[0.06em]"
            style={{
              color:
                trial.status === "open"
                  ? "var(--color-sand)"
                  : trial.verdict === "guilty"
                    ? "var(--color-flag)"
                    : "var(--color-moss)",
            }}
          >
            {trial.status === "open"
              ? "In session"
              : trial.verdict === "guilty"
                ? "Guilty"
                : "Not guilty"}
          </span>
          {relativeTime(trial.created_at)}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Avatar
          name={accused?.name ?? "?"}
          avatarUrl={accused?.avatar_url}
          colour={accused?.colour}
          size={22}
        />
        <span className="text-ink">
          <span className="font-semibold">{accused?.name}</span> — {trial.charge}
        </span>
      </div>
      {jury && (
        <p className="mt-1 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
          Jury: {jury}
        </p>
      )}
    </Link>
  );
}
