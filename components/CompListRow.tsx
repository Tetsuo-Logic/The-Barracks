import Link from "next/link";
import { shortDate, FORMAT_COLOUR } from "@/lib/dates";
import { gameById, compHeading, compMetaChip } from "@/lib/games";
import type { Competition } from "@/lib/types";
import type { RsvpWithPlayer } from "@/lib/queries";

// A row in the UPCOMING or RECENT lists. Tapping opens the edit sheet for now;
// the full competition detail page lands in Phase 4.
export function CompListRow({
  comp,
  rsvps,
}: {
  comp: Competition;
  rsvps: RsvpWithPlayer[];
}) {
  const inCount = rsvps.filter((r) => r.status === "in").length;
  const cancelled = comp.status === "cancelled";
  const game = gameById(comp.game);
  const dotColour = game.hasScorecard ? FORMAT_COLOUR[comp.format] : game.colour;

  return (
    <Link href={`/comp/${comp.id}`} className="flex items-center gap-3 py-3">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: dotColour }}
        aria-hidden
      />
      <span className="w-16 shrink-0 font-narrow text-sm font-semibold uppercase tracking-[0.04em] text-ink">
        {shortDate(comp.date)}
      </span>
      <span className="flex-1 truncate text-ink">
        {compHeading(comp)}
        {cancelled && (
          <span className="ml-2 font-narrow text-xs uppercase tracking-[0.08em] text-flag">
            scrubbed
          </span>
        )}
      </span>
      <span className="shrink-0 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
        {compMetaChip(comp)}
      </span>
      <span className="w-10 shrink-0 text-right font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
        {inCount > 0 ? `${inCount} in` : "—"}
      </span>
    </Link>
  );
}
