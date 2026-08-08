"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { RsvpButtons } from "@/components/RsvpButtons";
import { Scorecard } from "@/components/Scorecard";
import { EditableScorecard } from "@/components/EditableScorecard";
import { Chat } from "@/components/Chat";
import { Photos } from "@/components/Photos";
import { ConveneTrial } from "@/components/ConveneTrial";
import { heroDate, isToday, shortTime, formatLabel } from "@/lib/dates";
import { playerScores } from "@/lib/scoring";
import { isLocked } from "@/lib/rsvp";
import type { CompetitionDetail } from "@/lib/queries";
import type { RsvpStatus } from "@/lib/types";

type Tab = "details" | "card" | "photos" | "chat";

const STATUS_TEXT: Record<RsvpStatus, string> = { in: "In", out: "Out", maybe: "Maybe" };
const STATUS_COLOUR: Record<RsvpStatus, string> = {
  in: "var(--color-moss)",
  out: "var(--color-ink-soft)",
  maybe: "var(--color-sand)",
};

export function CompDetail({
  detail,
  currentUserId,
  isAdmin,
}: {
  detail: CompetitionDetail;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const { comp, profiles, rsvps, scores, comments, photos } = detail;
  const [tab, setTab] = useState<Tab>("details");
  const [entering, setEntering] = useState(false);

  const { dow, day, mon } = heroDate(comp.date);
  const tee = shortTime(comp.tee_time);
  const byPlayer = new Map(rsvps.map((r) => [r.player_id, r]));
  const mine = byPlayer.get(currentUserId)?.status ?? null;

  const played = playerScores(comp, profiles, scores);
  const hasScores = played.length > 0;
  // Everyone gets a card to fill (existing scores merged in).
  const cardPlayers = profiles.map((p) => {
    const sc = scores.find((s) => s.player_id === p.id);
    return {
      player: p,
      strokes: sc?.strokes ?? Array(comp.holes).fill(null),
    };
  });

  return (
    <div>
      {/* Optional event banner (named one-offs) */}
      {comp.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={comp.image_url}
          alt={comp.title ?? comp.course}
          className="mb-4 h-40 w-full rounded-[3px] border border-rule object-cover"
        />
      )}

      {/* header block */}
      <div className="flex items-start gap-4">
        <div className="text-center leading-none">
          <div className="font-narrow text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{dow}</div>
          <div
            className="font-narrow text-[36px] font-bold leading-[0.9]"
            style={{ color: isToday(comp.date) ? "var(--color-flag)" : "var(--color-ink)" }}
          >
            {day}
          </div>
          <div className="font-narrow text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{mon}</div>
        </div>
        <div className="flex-1">
          <h1 className="text-[20px] font-bold leading-tight text-ink">
            {comp.title || comp.course}
          </h1>
          {comp.title && <p className="mt-0.5 text-sm text-ink-soft">{comp.course}</p>}
          <p className="mt-1 font-narrow text-sm font-semibold uppercase tracking-[0.06em] text-ink-soft">
            {comp.holes} holes · {formatLabel(comp.format)}
            {tee && ` · Tee ${tee}`}
          </p>
          {comp.status === "cancelled" && (
            <p className="mt-1 font-narrow text-xs font-semibold uppercase tracking-[0.08em] text-flag">Cancelled</p>
          )}
        </div>
      </div>

      {/* tabs */}
      <div className="mt-5 flex border-b border-rule">
        {(["details", "card", "photos", "chat"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 border-b-2 pb-2 pt-1 font-narrow text-sm font-semibold uppercase tracking-[0.08em]"
            style={{
              borderColor: tab === t ? "var(--color-ink)" : "transparent",
              color: tab === t ? "var(--color-ink)" : "var(--color-ink-soft)",
            }}
          >
            {t === "chat" ? `Chat${comments.length ? ` ${comments.length}` : ""}` : t}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "details" && (
          <div>
            {comp.stake && <p className="mb-4 text-ink">{comp.stake}</p>}
            {comp.notes && <p className="mb-4 text-ink-soft">{comp.notes}</p>}

            {comp.status !== "cancelled" && (
              <>
                <p className="label mb-2">Your answer</p>
                <RsvpButtons competitionId={comp.id} current={mine} locked={isLocked(comp)} />
                <hr className="rule my-5" />
              </>
            )}

            <p className="label mb-2">Who&apos;s in</p>
            <ul className="flex flex-col gap-2">
              {profiles.map((p) => {
                const r = byPlayer.get(p.id);
                return (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <Avatar name={p.name} avatarUrl={p.avatar_url} colour={p.colour} size={22} />
                    <span className="text-ink">{p.name}</span>
                    <span
                      className="font-narrow text-xs font-semibold uppercase tracking-[0.08em]"
                      style={{ color: r ? STATUS_COLOUR[r.status] : "var(--color-rule)" }}
                    >
                      {r ? STATUS_TEXT[r.status] : "—"}
                    </span>
                    {r?.note && <span className="truncate text-ink-soft">“{r.note}”</span>}
                  </li>
                );
              })}
            </ul>

            {comp.status !== "cancelled" && (
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={`/comp/${comp.id}/ics`}
                  className="rounded-[3px] border border-rule px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink"
                >
                  Add to phone calendar
                </a>
                {isAdmin && (
                  <Link
                    href={`/?sheet=${comp.id}`}
                    className="rounded-[3px] border border-rule px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink"
                  >
                    Edit date
                  </Link>
                )}
              </div>
            )}

            {/* Someone said in and flaked? Take them to court (§ organiser). */}
            {isAdmin &&
              profiles.some(
                (p) => p.id !== currentUserId && byPlayer.get(p.id)?.status === "in",
              ) && (
                <div className="mt-6">
                  <ConveneTrial
                    candidates={profiles.filter(
                      (p) =>
                        p.id !== currentUserId &&
                        byPlayer.get(p.id)?.status === "in",
                    )}
                    competitionId={comp.id}
                    compact
                  />
                </div>
              )}
          </div>
        )}

        {tab === "card" && (
          <div>
            {entering ? (
              <EditableScorecard
                comp={comp}
                players={cardPlayers}
                onDone={() => setEntering(false)}
              />
            ) : (
              <>
                {hasScores ? (
                  <Scorecard comp={comp} players={played} />
                ) : (
                  <p className="py-8 text-center text-ink-soft">No scores in yet.</p>
                )}
                <p className="mt-3 label">
                  Counts for:{" "}
                  <span style={{ color: comp.for_cup ? "var(--color-sand)" : "var(--color-ink-soft)" }}>
                    {comp.for_cup ? "The Threeball Cup" : "Casual round"}
                  </span>
                </p>
                {comp.status !== "cancelled" && (
                  <button
                    onClick={() => setEntering(true)}
                    className="mt-4 w-full rounded-[3px] bg-ink py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-paper"
                  >
                    {hasScores ? "Edit scores" : "Enter scores"}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {tab === "photos" && (
          <Photos competitionId={comp.id} photos={photos} profiles={profiles} />
        )}

        {tab === "chat" && (
          <Chat
            competitionId={comp.id}
            initial={comments}
            profiles={profiles}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />
        )}
      </div>

    </div>
  );
}
