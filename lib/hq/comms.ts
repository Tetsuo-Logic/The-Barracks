import { createClient } from "@/lib/supabase/server";
import type { Broadcast, BroadcastResponse, Profile } from "@/lib/types";

// Quick Comms — what the radio button in the shell shows. Recent traffic and
// anything still waiting on you, nothing more. This is a quick way into Comms,
// not a second notification system: Action Required on Headquarters is what
// tells you there's work.

export type QuickTransmission = {
  id: string;
  kind: string;
  title: string;
  preview: string;
  from: string;
  at: string;
  /** Answerable, from someone else, and you haven't answered. */
  needsMe: boolean;
};

export async function getQuickComms(
  profile: Profile,
  limit = 8,
): Promise<{ items: QuickTransmission[]; awaiting: number }> {
  const supabase = await createClient();

  const [{ data: bxRows }, { data: respRows }, { data: profileRows }] = await Promise.all([
    supabase
      .from("broadcasts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("broadcast_responses").select("broadcast_id, player_id").eq("player_id", profile.id),
    supabase.from("profiles").select("id, name, nickname"),
  ]);

  const answered = new Set(
    ((respRows ?? []) as Pick<BroadcastResponse, "broadcast_id">[]).map((r) => r.broadcast_id),
  );
  const nameById = new Map(
    ((profileRows ?? []) as Pick<Profile, "id" | "name" | "nickname">[]).map((p) => [
      p.id,
      p.nickname || p.name,
    ]),
  );

  const items = ((bxRows ?? []) as Broadcast[]).map((b) => ({
    id: b.id,
    kind: b.kind,
    title: b.title || b.body,
    preview: b.title ? b.body : "",
    from: b.created_by ? (nameById.get(b.created_by) ?? "Command") : "Command",
    at: b.created_at,
    needsMe: b.kind !== "announce" && b.created_by !== profile.id && !answered.has(b.id),
  }));

  return { items, awaiting: items.filter((i) => i.needsMe).length };
}
