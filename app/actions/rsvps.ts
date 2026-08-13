"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendToPlayers } from "@/lib/push";
import { isLocked, isClosed, confirmState } from "@/lib/rsvp";
import { shortDate } from "@/lib/dates";
import { compHeading } from "@/lib/games";
import type { Competition, Profile, RsvpStatus } from "@/lib/types";

export async function setRsvp(
  competitionId: string,
  status: RsvpStatus,
  note?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: lock } = await supabase
    .from("competitions")
    .select("status, started_at, confirm_by")
    .eq("id", competitionId)
    .single();
  if (lock && isClosed(lock as Pick<Competition, "status" | "started_at">)) {
    return { ok: false, error: "This operation is closed — roll call is locked." };
  }

  // The confirmation window. Someone carried over from the muster who let the
  // deadline pass is off the roster, and can't quietly put themselves back on —
  // a Captain or the President has to. Coming off the roster stays free: you
  // can always drop out, it's only rejoining that needs a nod.
  const { data: mine } = await supabase
    .from("rsvps")
    .select("confirmed_at, approved_late")
    .eq("competition_id", competitionId)
    .eq("player_id", user.id)
    .maybeSingle();

  if (
    status === "in" &&
    mine &&
    lock &&
    confirmState(
      mine as { confirmed_at: string | null; approved_late: boolean },
      lock as { confirm_by: string | null },
    ) === "lapsed"
  ) {
    return {
      ok: false,
      error: "You missed the confirmation window — ask your Captain to approve you back on.",
    };
  }

  const { error } = await supabase.from("rsvps").upsert(
    {
      competition_id: competitionId,
      player_id: user.id,
      status,
      note: note?.trim() || null,
      // Answering for yourself is what confirmation means.
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "competition_id,player_id" },
  );
  if (error) return { ok: false, error: "Couldn't save your answer." };

  // Ping the others so an RSVP reaches them without opening the app.
  const [{ data: comp }, { data: me }, { data: others }] = await Promise.all([
    supabase.from("competitions").select("course, title, date, game").eq("id", competitionId).single(),
    supabase.from("profiles").select("name").eq("id", user.id).single(),
    supabase.from("profiles").select("id").neq("id", user.id),
  ]);
  if (comp) {
    const who = (me as { name?: string })?.name ?? "Someone";
    const label = status === "in" ? "is in" : status === "out" ? "is out" : "might make it";
    const c = comp as { course: string | null; title: string | null; date: string; game: string };
    await sendToPlayers(
      ((others ?? []) as Pick<Profile, "id">[]).map((p) => p.id),
      "rsvp_changes",
      {
        title: `${who} ${label}`,
        body: `${compHeading(c)} · ${shortDate(c.date)}`,
        url: `/comp/${competitionId}`,
        tag: `rsvp-${competitionId}-${user.id}`,
      },
    );
  }

  revalidatePath("/");
  revalidatePath(`/comp/${competitionId}`);
  return { ok: true };
}

/**
 * Back out of a competition you'd committed to. Sets you to "out". If it's
 * inside the 24h lock, it opens a strike hearing in the Courtroom with your
 * reasons as the defence, and summons the jury (§ organiser model).
 */
export async function backOut(
  competitionId: string,
  reasons: string,
): Promise<{ ok: true; court: boolean; trialId?: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: comp } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", competitionId)
    .single();
  if (!comp) return { ok: false, error: "Competition not found." };
  const c = comp as Competition;
  if (isClosed(c)) return { ok: false, error: "This operation is closed." };

  const { error } = await supabase.from("rsvps").upsert(
    {
      competition_id: competitionId,
      player_id: user.id,
      status: "out",
      note: reasons.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "competition_id,player_id" },
  );
  if (error) return { ok: false, error: "Couldn't save that." };

  // Outside the lock — no consequence, just a normal change of heart.
  if (!isLocked(c)) {
    revalidatePath("/");
    revalidatePath(`/comp/${competitionId}`);
    return { ok: true, court: false };
  }

  // Inside the lock — open a self-trial (a strike hearing).
  const { data: trial } = await supabase
    .from("trials")
    .insert({
      defendant_id: user.id,
      competition_id: competitionId,
      charge: `Backed out of ${compHeading(c)} (${shortDate(c.date)}) after saying in`,
      defence: reasons.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (trial) {
    const { data: me } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();
    const { data: others } = await supabase
      .from("profiles")
      .select("id")
      .neq("id", user.id);
    await sendToPlayers(
      ((others ?? []) as Pick<Profile, "id">[]).map((p) => p.id),
      "rsvp_changes",
      {
        title: "⚖️ Courtroom in session",
        body: `${(me as { name?: string })?.name ?? "Someone"} backed out of ${compHeading(c)}. Your verdict is needed.`,
        url: `/trial/${trial.id}`,
        tag: `trial-${trial.id}`,
      },
    );
  }

  revalidatePath("/");
  revalidatePath(`/comp/${competitionId}`);
  revalidatePath("/trial");
  return { ok: true, court: true, trialId: trial?.id as string | undefined };
}
