import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { previewingAsPlayer } from "@/lib/preview";
import { effectiveAdmin } from "@/lib/permissions";
import { getGames, getSquadOptions } from "@/lib/data";
import { PageHead, Panel, Dot } from "@/components/hq/Kit";
import { DeployForm } from "@/components/hq/room/DeployForm";

export const metadata = { title: "Deploy operation · Barracks HQ" };

// Putting a night on the board. Same server action the phone's deploy sheet
// calls — which means the same roster ping goes out on save.
export default async function NewOperationPage() {
  const [profile, previewing, games, squads] = await Promise.all([
    requireProfile(),
    previewingAsPlayer(),
    getGames(),
    getSquadOptions(),
  ]);
  const isAdmin = effectiveAdmin(profile, previewing);

  return (
    <div>
      <div className="mb-3">
        <Link href="/hq/operations" className="hq-label transition-colors hover:text-ink">
          ← Operations
        </Link>
      </div>

      <PageHead eyebrow="Command" title="Deploy operation">
        Set the target, set the parameters, put it on the board. The roster is told the moment
        it lands.
      </PageHead>

      {!isAdmin && (
        <Panel i={0} className="mb-4" label="Command authority" status={<Dot tone="alert" />}>
          <p className="text-[13px] text-ink-soft">
            You&apos;re not holding command{previewing ? " while previewing as a player" : ""} — the
            form is here to read, but only the CO can deploy.
          </p>
        </Panel>
      )}

      <DeployForm games={games} squads={squads} isAdmin={isAdmin} />
    </div>
  );
}
