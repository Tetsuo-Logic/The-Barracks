import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "@/components/CalendarView";
import type { Competition } from "@/lib/types";

export default async function CalendarPage() {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("competitions").select("*");

  const now = new Date();

  return (
    <div>
      <p className="label mb-4">Calendar</p>
      <CalendarView
        competitions={(data ?? []) as Competition[]}
        initialYear={now.getFullYear()}
        initialMonth={now.getMonth()}
      />
    </div>
  );
}
