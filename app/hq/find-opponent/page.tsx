import Link from "next/link";
import { gameById } from "@/lib/games";
import { Panel, Stat, PageHead, Proto } from "@/components/hq/Kit";
import { OpponentFinder } from "@/components/hq/battle/OpponentFinder";
import { ORGS } from "@/lib/hq/future/network";

export const metadata = { title: "Find opponent · Barracks HQ" };

// Discovery across the network. Barracks are organisations here — a name, a
// tag, a size, a game and a set of nights — not profiles to be browsed.
export default function FindOpponentPage() {
  const open = ORGS.filter((o) => o.openToChallenges);
  const games = Array.from(new Set(ORGS.map((o) => o.game)));
  const online = ORGS.filter((o) => o.lastActive === "Online now");
  const gameNames = Object.fromEntries(games.map((id) => [id, gameById(id).name]));

  return (
    <div>
      <PageHead
        eyebrow="Network"
        title="Find opponent"
        right={
          <>
            <Proto />
            <Link
              href="/hq/battles"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              Battles
            </Link>
          </>
        }
      >
        Barracks looking for Barracks. Filter the directory, read the outfit, then issue a
        challenge to their Captain.
      </PageHead>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Panel i={0}>
          <Stat value={ORGS.length} label="Barracks listed" sub="Across the network" />
        </Panel>
        <Panel i={1}>
          <Stat value={open.length} label="Open to challenges" tone="live" />
        </Panel>
        <Panel i={2}>
          <Stat value={games.length} label="Games represented" />
        </Panel>
        <Panel i={3}>
          <Stat value={online.length} label="Active now" tone={online.length ? "live" : undefined} />
        </Panel>
        <Panel i={4}>
          <Stat
            value={ORGS.reduce((n, o) => n + o.operatives, 0)}
            label="Operatives"
            sub="On the other side of the wire"
          />
        </Panel>
      </div>

      <OpponentFinder orgs={ORGS} gameNames={gameNames} />
    </div>
  );
}
