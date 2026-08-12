"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendToPlayers } from "@/lib/push";

// A motion against the President. Every write goes through a SECURITY DEFINER
// function (0042) — the secrecy while voting is an RLS guarantee, not a UI one.

type Result = { ok: true } | { ok: false; error: string };

async function nameOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<string> {
  const { data } = await supabase.from("profiles").select("name").eq("id", id).single();
  return (data as { name?: string })?.name ?? "Someone";
}

/** Raise a mutiny and notify the ranks — everyone except the President. */
export async function raiseMutiny(reason: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.rpc("raise_mutiny", { p_reason: reason });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };
  const id = data as string;

  // Tell everyone but the President (and the raiser) that there's a vote on.
  const { data: mu } = await supabase
    .from("mutinies")
    .select("target_id, group_id")
    .eq("id", id)
    .maybeSingle();
  const target = (mu as { target_id: string | null } | null)?.target_id ?? null;

  const { data: members } = await supabase.from("profiles").select("id");
  const ranks = ((members ?? []) as { id: string }[])
    .map((p) => p.id)
    .filter((pid) => pid !== target && pid !== user.id);
  if (ranks.length > 0) {
    await sendToPlayers(ranks, "board", {
      title: "🏴 A motion has been raised",
      body: "Someone has moved against the President. Cast your vote — quietly.",
      url: "/board",
      tag: `mutiny-${id}`,
    });
  }

  revalidatePath("/board");
  return { ok: true, id };
}

/** Agree, or stand by the President. Resolves the moment it's decided. */
export async function voteMutiny(mutinyId: string, agree: boolean): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.rpc("cast_mutiny_vote", {
    p_mutiny: mutinyId,
    p_agree: agree,
  });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };

  const status = data as string;
  if (status === "carried" || status === "failed") {
    const { data: mu } = await supabase
      .from("mutinies")
      .select("raised_by, target_id, reason")
      .eq("id", mutinyId)
      .maybeSingle();
    const m = mu as { raised_by: string | null; target_id: string | null; reason: string } | null;

    if (status === "carried" && m?.raised_by) {
      await sendToPlayers([m.raised_by], "board", {
        title: "🏴 The motion carried",
        body: "The ranks are with you. Name a judge to take it to court.",
        url: "/board",
        tag: `mutiny-${mutinyId}`,
      });
    }

    // Failed: it collapses — and the President learns who moved against them.
    if (status === "failed" && m?.target_id) {
      const who = m.raised_by ? await nameOf(supabase, m.raised_by) : "Someone";
      await sendToPlayers([m.target_id], "board", {
        title: "🏴 A motion against you failed",
        body: `${who} moved against you: "${m.reason}" — the ranks stood by you.`,
        url: "/board",
        tag: `mutiny-${mutinyId}`,
      });
      if (m.raised_by) {
        await sendToPlayers([m.raised_by], "board", {
          title: "Your motion failed",
          body: "The ranks stood by the President — and they've been told it was you.",
          url: "/board",
          tag: `mutiny-${mutinyId}`,
        });
      }
    }
  }

  revalidatePath("/board");
  return { ok: true };
}

/** Carried → name an impartial judge; opens the case with the President in the dock. */
export async function nominateJudge(
  mutinyId: string,
  judgeId: string,
): Promise<{ ok: true; trialId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.rpc("nominate_mutiny_judge", {
    p_mutiny: mutinyId,
    p_judge: judgeId,
  });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };
  const trialId = data as string;

  const { data: mu } = await supabase
    .from("mutinies")
    .select("target_id, reason")
    .eq("id", mutinyId)
    .maybeSingle();
  const m = mu as { target_id: string | null; reason: string } | null;

  await sendToPlayers([judgeId], "board", {
    title: "⚖️ You've been named judge",
    body: "A case against the President is yours to rule on — tap to hear it.",
    url: `/trial/${trialId}`,
    tag: `mutiny-${mutinyId}`,
  });
  if (m?.target_id) {
    await sendToPlayers([m.target_id], "board", {
      title: "🏴 You're facing the court",
      body: `The ranks carried a motion against you: "${m.reason}" — enter your defence.`,
      url: `/trial/${trialId}`,
      tag: `mutiny-${mutinyId}`,
    });
  }

  revalidatePath("/board");
  revalidatePath(`/trial/${trialId}`);
  return { ok: true, trialId };
}

/** The raiser withdraws; the CO can clear a resolved one (RLS gates both). */
export async function deleteMutiny(mutinyId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("mutinies").delete().eq("id", mutinyId);
  if (error) return { ok: false, error: "Couldn't withdraw it." };
  revalidatePath("/board");
  return { ok: true };
}
