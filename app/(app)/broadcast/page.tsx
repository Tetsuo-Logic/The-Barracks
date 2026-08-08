import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getActivityFeed } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { BroadcastCompose } from "@/components/BroadcastCompose";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ClearHistory } from "@/components/ClearHistory";
import { ConsoleHeader } from "@/components/ConsoleHeader";
import type { Profile } from "@/lib/types";

// "Comms 📡" — the organiser's compose screen, with the activity history
// below it. Organiser only; everyone else reaches the history via the bell
// (/activity).
export default async function BroadcastPage() {
  const profile = await requireProfile();
  if (!profile.is_admin) redirect("/activity");

  const supabase = await createClient();
  const [{ data: candidateRows }, activity] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .neq("id", profile.id)
      .order("created_at", { ascending: true }),
    getActivityFeed(profile.id),
  ]);
  const candidates = (candidateRows ?? []) as Profile[];

  return (
    <div>
      <ConsoleHeader
        title="Comms"
        tag="📡 Transmit"
        right={<Link href="/" className="label text-ink-soft">← Games</Link>}
      />

      <div className="mb-8">
        <BroadcastCompose candidates={candidates} />
      </div>

      <p className="label mb-1">History</p>
      <hr className="rule" />
      <ActivityFeed activity={activity} currentUserId={profile.id} isAdmin={profile.is_admin} />

      <ClearHistory clearedBefore={activity.clearedBefore} />
    </div>
  );
}
