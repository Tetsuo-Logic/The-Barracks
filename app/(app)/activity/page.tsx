import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getActivityFeed, getInbox } from "@/lib/queries";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Inbox } from "@/components/Inbox";

// The bell's destination — everyone's notifications and history. Outstanding
// items pinned at the top, the full read-only timeline below. No compose here;
// sending messages lives on /broadcast (organiser only).
export default async function ActivityPage() {
  const profile = await requireProfile();

  const [inbox, activity] = await Promise.all([
    getInbox(profile),
    getActivityFeed(profile.id),
  ]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="label">Notifications</p>
        <Link href="/" className="label text-ink-soft">← Fixtures</Link>
      </div>

      <Inbox inbox={inbox} />

      <p className="label mb-1">History</p>
      <hr className="rule" />
      <ActivityFeed activity={activity} currentUserId={profile.id} />
    </div>
  );
}
