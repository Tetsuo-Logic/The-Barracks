import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getActivityFeed, getInbox } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { BroadcastCompose } from "@/components/BroadcastCompose";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Inbox } from "@/components/Inbox";
import type { Profile } from "@/lib/types";

// The shared activity timeline — open to everyone. Your outstanding items sit
// pinned at the top; the full history (messages, rounds, results, comments,
// trials) runs below. Only the organiser gets the compose box.
export default async function BroadcastPage() {
  const profile = await requireProfile();

  const [inbox, activity] = await Promise.all([
    getInbox(profile),
    getActivityFeed(profile.id),
  ]);

  // Candidates for the "Court" composer (organiser only).
  let candidates: Profile[] = [];
  if (profile.is_admin) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", profile.id)
      .order("created_at", { ascending: true });
    candidates = (data ?? []) as Profile[];
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="label">Activity</p>
        <Link href="/" className="label text-ink-soft">← Fixtures</Link>
      </div>

      <Inbox inbox={inbox} />

      {profile.is_admin && (
        <div className="mb-8">
          <BroadcastCompose candidates={candidates} />
        </div>
      )}

      <p className="label mb-1">History</p>
      <hr className="rule" />
      <ActivityFeed activity={activity} currentUserId={profile.id} />
    </div>
  );
}
