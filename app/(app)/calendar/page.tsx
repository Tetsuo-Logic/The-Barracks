import { requireProfile } from "@/lib/auth";
import { previewingAsPlayer } from "@/lib/preview";
import { effectiveAdmin } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { CalendarView, type RadarRelease } from "@/components/CalendarView";
import { AddDateButton } from "@/components/AddDateButton";
import { ConsoleHeader } from "@/components/ConsoleHeader";
import type { Competition, RadarGame } from "@/lib/types";

export default async function CalendarPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data }, { data: radar }] = await Promise.all([
    supabase.from("competitions").select("*"),
    supabase.from("radar_games").select("id, title, release_date").not("release_date", "is", null),
  ]);

  const releases: RadarRelease[] = ((radar ?? []) as Pick<RadarGame, "id" | "title" | "release_date">[])
    .filter((r) => r.release_date)
    .map((r) => ({ id: r.id, title: r.title, date: r.release_date as string }));

  const isAdmin = effectiveAdmin(profile, await previewingAsPlayer());
  const now = new Date();

  return (
    <div>
      <ConsoleHeader
        title="Calendar"
        tag="Schedule"
        right={isAdmin ? <AddDateButton /> : undefined}
      />
      <CalendarView
        competitions={(data ?? []) as Competition[]}
        releases={releases}
        initialYear={now.getFullYear()}
        initialMonth={now.getMonth()}
      />
    </div>
  );
}
