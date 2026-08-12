"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// The room is meant to be left open on a second monitor, so it can't be a
// snapshot. Same subscription the phone uses: the competition row and its roll
// call, RLS-scoped, refreshing the server render on any change.
export function RoomRealtime({ compId }: { compId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`hq-op-${compId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "competitions", filter: `id=eq.${compId}` },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rsvps", filter: `competition_id=eq.${compId}` },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [compId, router]);

  return null;
}
