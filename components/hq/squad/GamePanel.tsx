import { FootballPanel } from "@/components/hq/squad/FootballPanel";
import { RacePanel } from "@/components/hq/squad/RacePanel";
import { GolfPanel } from "@/components/hq/squad/GolfPanel";
import { BriefingPanel } from "@/components/hq/squad/BriefingPanel";
import type { Competition, Profile, Score, Squad } from "@/lib/types";

// One squad, one specialised panel. The dossier above it is identical for every
// squad — this is the 15% where the game gets to be itself. Anything we don't
// recognise falls through to the mission briefing, which works for any game.

type Member = { profile: Profile; is_captain: boolean };

const FOOTBALL = new Set(["fifa", "fc", "football", "ea-fc", "efootball", "pes"]);
const RACING = new Set(["f1", "formula1", "racing", "gt7", "gran-turismo", "forza", "assetto-corsa"]);
const GOLF = new Set(["threeball", "golf", "golf2k", "pga"]);

export type SquadPanelKind = "football" | "race" | "golf" | "briefing";

export function panelKind(game: string): SquadPanelKind {
  const g = game.toLowerCase();
  if (FOOTBALL.has(g)) return "football";
  if (RACING.has(g)) return "race";
  if (GOLF.has(g)) return "golf";
  return "briefing";
}

export const PANEL_LABEL: Record<SquadPanelKind, string> = {
  football: "Match command",
  race: "Race control",
  golf: "Scorecard",
  briefing: "Mission briefing",
};

export function GamePanel({
  squad,
  gameName,
  members,
  comps,
  fixtures,
  scores,
}: {
  squad: Squad;
  gameName: string;
  members: Member[];
  comps: Competition[]; // every operation this squad has ever had
  fixtures: Competition[]; // the ones still ahead
  scores: Score[];
}) {
  switch (panelKind(squad.game)) {
    case "football":
      return (
        <FootballPanel
          squadId={squad.id}
          squadName={squad.name || `${gameName} Squad`}
          members={members}
          fixtures={fixtures}
        />
      );
    case "race":
      return <RacePanel squadId={squad.id} members={members} fixtures={fixtures} />;
    case "golf":
      return <GolfPanel squadId={squad.id} members={members} comps={comps} scores={scores} />;
    default:
      return (
        <BriefingPanel
          squadId={squad.id}
          gameName={gameName}
          members={members}
          fixtures={fixtures}
        />
      );
  }
}
