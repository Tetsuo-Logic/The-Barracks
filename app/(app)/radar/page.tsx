import { requireProfile } from "@/lib/auth";
import { getRadar } from "@/lib/queries";
import { ConsoleHeader } from "@/components/ConsoleHeader";
import { RadarBoard } from "@/components/RadarBoard";

// /radar — the games wishlist: what to get next, with interested/not.
export default async function RadarPage() {
  const profile = await requireProfile();
  const { items } = await getRadar(profile.id);

  return (
    <div>
      <ConsoleHeader title="Radar" tag="🛰️ Intel" />
      <RadarBoard items={items} currentUserId={profile.id} isAdmin={profile.is_admin} />
    </div>
  );
}
