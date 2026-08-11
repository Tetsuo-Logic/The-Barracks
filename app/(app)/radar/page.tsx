import { requireProfile } from "@/lib/auth";
import { previewingAsPlayer } from "@/lib/preview";
import { effectiveAdmin } from "@/lib/permissions";
import { getRadar } from "@/lib/queries";
import { ConsoleHeader } from "@/components/ConsoleHeader";
import { RadarBoard } from "@/components/RadarBoard";

// /radar — the games wishlist: what to get next, with interested/not.
export default async function RadarPage() {
  const profile = await requireProfile();
  const isAdmin = effectiveAdmin(profile, await previewingAsPlayer());
  const { items } = await getRadar(profile.id);

  return (
    <div>
      <ConsoleHeader title="Radar" tag="🛰️ Intel" />
      <RadarBoard items={items} currentUserId={profile.id} isAdmin={isAdmin} />
    </div>
  );
}
