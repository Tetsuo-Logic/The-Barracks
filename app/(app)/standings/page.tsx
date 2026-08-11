import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getServiceRoster } from "@/lib/data/queries";
import { ServiceRoster } from "@/components/ServiceRoster";
import { ConsoleHeader } from "@/components/ConsoleHeader";

// Service Records — the squad's participation (Operations · games · hours).
// Deliberately NOT a "best player" ranking; Barracks records who shows up and
// puts the hours in. Competitive standings live at Battle/League level (later).
export default async function StandingsPage() {
  await requireProfile();
  const roster = await getServiceRoster();

  return (
    <div>
      <ConsoleHeader
        title="Service"
        tag="Records"
        sub="Who shows up, not who's best"
        right={<Link href="/trial" className="label text-ink-soft">Courtroom →</Link>}
      />

      <ServiceRoster rows={roster} />
    </div>
  );
}
