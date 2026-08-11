import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { previewingAsPlayer } from "@/lib/preview";
import { effectiveAdmin } from "@/lib/permissions";
import { getActivityFeed, getInbox } from "@/lib/queries";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Inbox } from "@/components/Inbox";
import { ClearHistory } from "@/components/ClearHistory";
import { ConsoleHeader } from "@/components/ConsoleHeader";

// The bell's destination — everyone's notifications and history. Outstanding
// items pinned at the top, the full read-only timeline below. No compose here;
// sending messages lives on /broadcast (organiser only).
export default async function ActivityPage() {
  const profile = await requireProfile();
  const isAdmin = effectiveAdmin(profile, await previewingAsPlayer());

  const [inbox, activity] = await Promise.all([
    getInbox(profile),
    getActivityFeed(profile.id, isAdmin),
  ]);

  return (
    <div>
      <ConsoleHeader
        title="Comms Log"
        tag="Archive"
        right={<Link href="/" className="label text-ink-soft">← Games</Link>}
      />

      <Inbox inbox={inbox} />

      <p className="label mb-1">History</p>
      <hr className="rule" />
      <ActivityFeed
        activity={activity}
        currentUserId={profile.id}
        isAdmin={isAdmin}
        showRequests={activity.showRequests}
      />

      {isAdmin && <ClearHistory clearedBefore={activity.clearedBefore} />}
    </div>
  );
}
