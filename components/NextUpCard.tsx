import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { RsvpButtons } from "@/components/RsvpButtons";
import { heroDate, isToday, shortTime, formatLabel } from "@/lib/dates";
import { gameById, compHeading } from "@/lib/games";
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
  const game = gameById(comp.game);
  const isGolf = game.hasScorecard;
  const heading = compHeading(comp);

  const byPlayer = new Map(rsvps.map((r) => [r.player_id, r]));
  const mine = byPlayer.get(currentUserId)?.status ?? null;

  return (
    <section className="hud p-5">
      <div className="flex items-start justify-between">
        <p className="label" style={{ color: "var(--color-sand)" }}>▸ Next up</p>
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

      {/* Optional event banner (named one-offs) */}
      {comp.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={comp.image_url}
          alt={heading}
          className="mt-3 h-32 w-full rounded-[3px] border border-rule object-cover"
        />
      )}

      {/* Hero: date stack + meta */}
      <div className="mt-3 flex items-start gap-5">
        <div className="text-center leading-none">
          <div className="font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-ink-soft">
            {dow}
          </div>
          <div
            className="font-mono text-[46px] font-bold leading-[0.9]"
            style={{ color: today ? "var(--color-flag)" : "var(--color-sand)" }}
          >
            {day}
          </div>
          <div className="font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-ink-soft">
            {mon}
          </div>
        </div>

        <div className="flex-1 pt-1">
          <h2 className="display text-[21px] font-semibold leading-tight text-ink">
            {heading}
          </h2>
          {isGolf && comp.title && comp.course && (
            <p className="mt-0.5 text-sm text-ink-soft">{comp.course}</p>
          )}
          <p className="mt-1 font-narrow text-sm font-semibold uppercase tracking-[0.06em] text-ink-soft">
            {isGolf ? (
              <>
                {comp.holes} holes · {formatLabel(comp.format)}
              </>
            ) : (
              <>
                {game.emoji} {game.name}
              </>
            )}
          </p>
          {tee && (
            <p className="mt-0.5 font-narrow text-sm font-semibold uppercase tracking-[0.06em] text-ink-soft">
              {isGolf ? `Tee ${tee}` : tee}
            </p>
          )}
        </div>
      </div>

      {comp.stake && <p className="mt-4 text-ink">{comp.stake}</p>}

      <hr className="rule my-4" />

      {/* Roll call */}
      <p className="label mb-2">Roll call ✋</p>
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
