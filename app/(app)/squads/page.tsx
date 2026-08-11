import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { previewingAsPlayer } from "@/lib/preview";
import { effectiveAdmin } from "@/lib/permissions";
import { getSquads, getSquadRequests, getGames } from "@/lib/queries";
import { SquadsBoard } from "@/components/SquadsBoard";
import { ConsoleHeader } from "@/components/ConsoleHeader";

// /squads — game-specific squads within the Barracks.
export default async function SquadsPage() {
  const profile = await requireProfile();
  const isAdmin = effectiveAdmin(profile, await previewingAsPlayer());
  const [squads, requests, games] = await Promise.all([
    getSquads(profile.id),
    getSquadRequests(),
    getGames(),
  ]);

  return (
    <div>
      <ConsoleHeader
        title="Squads"
        tag="🪖 By game"
        right={<Link href="/" className="label text-ink-soft">← Games</Link>}
      />
      <SquadsBoard
        squads={squads}
        requests={requests}
        games={games}
        currentUserId={profile.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}
