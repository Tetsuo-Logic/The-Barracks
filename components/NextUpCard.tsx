import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { RsvpButtons } from "@/components/RsvpButtons";
import { heroDate, isToday, shortTime, formatLabel } from "@/lib/dates";
import { isLocked } from "@/lib/rsvp";
import type { Competition, Profile, RsvpStatus } from "@/lib/types";
import type { RsvpWithPlayer } from "@/lib/queries";

const STATUS_TEXT: Record<RsvpStatus, string> = {
  in: "In",
  out: "Out",
  maybe: "Maybe",
};
const STATUS_COLOUR: Record<RsvpStatus, string> = {
  in: "var(--color-moss)",
  out: "var(--color-ink-soft)",
  maybe: "var(--color-sand)",
};

export function NextUpCard({
  comp,
  profiles,
  rsvps,
  currentUserId,
  isAdmin,
}: {
  comp: Competition;
  profiles: Profile[];
  rsvps: RsvpWithPlayer[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const { dow, day, mon } = heroDate(comp.date);
  const today = isToday(comp.date);
  const tee = shortTime(comp.tee_time);

  const byPlayer = new Map(rsvps.map((r) => [r.player_id, r]));
  const mine = byPlayer.get(currentUserId)?.status ?? null;

  return (
    <section className="rounded-[3px] border border-rule bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between">
        <p className="label">Next up</p>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link href={`/?sheet=${comp.id}`} scroll={false} className="label text-ink-soft">
              Edit
            </Link>
          )}
          <Link href={`/comp/${comp.id}`} className="label text-ink-soft">
            Open
          </Link>
        </div>
      </div>

      {/* Hero: date stack + meta */}
      <div className="mt-3 flex items-start gap-5">
        <div className="text-center leading-none">
          <div className="font-narrow text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
            {dow}
          </div>
          <div
            className="font-narrow text-[44px] font-bold leading-[0.9]"
            style={{ color: today ? "var(--color-flag)" : "var(--color-ink)" }}
          >
            {day}
          </div>
          <div className="font-narrow text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
            {mon}
          </div>
        </div>

        <div className="flex-1 pt-1">
          <h2 className="text-[20px] font-bold leading-tight text-ink">
            {comp.course}
          </h2>
          <p className="mt-1 font-narrow text-sm font-semibold uppercase tracking-[0.06em] text-ink-soft">
            {comp.holes} holes · {formatLabel(comp.format)}
          </p>
          {tee && (
            <p className="mt-0.5 font-narrow text-sm font-semibold uppercase tracking-[0.06em] text-ink-soft">
              Tee {tee}
            </p>
          )}
        </div>
      </div>

      {comp.stake && <p className="mt-4 text-ink">{comp.stake}</p>}

      <hr className="rule my-4" />

      {/* Your answer */}
      <p className="label mb-2">Are you in?</p>
      <RsvpButtons competitionId={comp.id} current={mine} locked={isLocked(comp)} />

      <hr className="rule my-4" />

      {/* Who's in */}
      <ul className="flex flex-col gap-2">
        {profiles.map((p) => {
          const r = byPlayer.get(p.id);
          return (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <Avatar
                name={p.name}
                avatarUrl={p.avatar_url}
                colour={p.colour}
                size={22}
              />
              <span className="text-ink">{p.name}</span>
              <span
                className="font-narrow text-xs font-semibold uppercase tracking-[0.08em]"
                style={{ color: r ? STATUS_COLOUR[r.status] : "var(--color-rule)" }}
              >
                {r ? STATUS_TEXT[r.status] : "—"}
              </span>
              {r?.note && (
                <span className="truncate text-ink-soft">“{r.note}”</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
