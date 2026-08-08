import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "@/components/CalendarView";
import { AddDateButton } from "@/components/AddDateButton";
import { ConsoleHeader } from "@/components/ConsoleHeader";
import type { Competition } from "@/lib/types";

export default async function CalendarPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("competitions").select("*");

  const now = new Date();

  return (
    <div>
      <ConsoleHeader
        title="Calendar"
        tag="Schedule"
        right={profile.is_admin ? <AddDateButton /> : undefined}
      />
      <CalendarView
        competitions={(data ?? []) as Competition[]}
        initialYear={now.getFullYear()}
        initialMonth={now.getMonth()}
      />
    </div>
  );
}
