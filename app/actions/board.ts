"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendToPlayers } from "@/lib/push";
import type { Profile } from "@/lib/types";

async function nameOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<string> {
  const { data } = await supabase.from("profiles").select("name").eq("id", id).single();
  return (data as { name?: string })?.name ?? "Someone";
}

// Any player files a complaint to the board, optionally about a named player.
export async function fileComplaint(input: {
  reason: string;
  action?: string;
  comment?: string;
  againstId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "What's the complaint?" };

  const againstId = input.againstId || null;
  const { error } = await supabase.from("complaints").insert({
    filed_by: user.id,
    against_id: againstId,
    reason,
    action: input.action?.trim() || null,
    comment: input.comment?.trim() || null,
  });
  if (error) return { ok: false, error: "Couldn't file it." };

  const who = await nameOf(supabase, user.id);

  // Nudge the president (and admin) that there's something to rule on.
  const { data: rulers } = await supabase
    .from("profiles")
    .select("id")
    .or("is_president.eq.true,is_admin.eq.true")
    .neq("id", user.id);
  await sendToPlayers(
    ((rulers ?? []) as Pick<Profile, "id">[]).map((p) => p.id),
    "board",
    {
      title: "A complaint has been filed",
      body: `${who}: ${reason}`,
      url: "/board",
      tag: "board",
    },
  );

  // Tell the person it's about so they can respond.
  if (againstId && againstId !== user.id) {
    await sendToPlayers([againstId], "board", {
      title: "You're facing a complaint",
      body: `${who}: ${reason} — tap to respond`,
      url: "/board",
      tag: "board",
    });
  }

  revalidatePath("/board");
  return { ok: true };
}

// The subject of a complaint responds to it.
export async function respondToComplaint(
  complaintId: string,
  response: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const text = response.trim();
  if (!text) return { ok: false, error: "Write your response first." };

  const { error } = await supabase
    .from("complaints")
    .update({ response: text, response_at: new Date().toISOString() })
    .eq("id", complaintId)
    .eq("against_id", user.id);
  if (error) return { ok: false, error: "Couldn't save your response." };

  // Let the president/admin know a response is in.
  const { data: rulers } = await supabase
    .from("profiles")
    .select("id")
    .or("is_president.eq.true,is_admin.eq.true")
    .neq("id", user.id);
  const who = await nameOf(supabase, user.id);
  await sendToPlayers(
    ((rulers ?? []) as Pick<Profile, "id">[]).map((p) => p.id),
    "board",
    { title: `${who} responded`, body: text, url: "/board", tag: "board" },
  );

  revalidatePath("/board");
  return { ok: true };
}

// The president (or admin) asks a chosen player for a second opinion.
export async function requestSecondOpinion(
  complaintId: string,
  personId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin, is_president")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin && !me?.is_president) {
    return { ok: false, error: "Only the president can do that." };
  }

  const { error } = await supabase
    .from("complaints")
    .update({ second_opinion_by: personId, second_opinion: null, second_opinion_at: null })
    .eq("id", complaintId);
  if (error) return { ok: false, error: "Couldn't ask for a second opinion." };

  await sendToPlayers([personId], "board", {
    title: "You've been asked to help",
    body: "The president wants your second opinion on a complaint — tap to give it.",
    url: "/board",
    tag: "board",
  });

  revalidatePath("/board");
  return { ok: true };
}

// The nominated player gives their second opinion, with a steer on whether it
// should go to the Tribunal.
export async function submitSecondOpinion(
  complaintId: string,
  opinion: string,
  toCourt: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const text = opinion.trim();
  if (!text) return { ok: false, error: "Add your opinion first." };

  const { error } = await supabase
    .from("complaints")
    .update({
      second_opinion: text,
      second_opinion_to_court: toCourt,
      second_opinion_at: new Date().toISOString(),
    })
    .eq("id", complaintId)
    .eq("second_opinion_by", user.id);
  if (error) return { ok: false, error: "Couldn't save your opinion." };

  const { data: rulers } = await supabase
    .from("profiles")
    .select("id")
    .or("is_president.eq.true,is_admin.eq.true")
    .neq("id", user.id);
  const who = await nameOf(supabase, user.id);
  await sendToPlayers(
    ((rulers ?? []) as Pick<Profile, "id">[]).map((p) => p.id),
    "board",
    {
      title: `${who} gave a second opinion`,
      body: toCourt ? `${text} — reckons it's one for the court` : text,
      url: "/board",
      tag: "board",
    },
  );

  revalidatePath("/board");
  return { ok: true };
}

// The President (or admin) rules on a complaint.
export async function ruleOnComplaint(
  complaintId: string,
  ruling: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("complaints")
    .update({
      status: "addressed",
      ruling: ruling.trim() || null,
      addressed_by: user.id,
      addressed_at: new Date().toISOString(),
    })
    .eq("id", complaintId);
  if (error) return { ok: false, error: "Couldn't rule on it. Are you the president?" };

  revalidatePath("/board");
  return { ok: true };
}

// Refer a complaint to the Tribunal: convene a trial with the subject as the
// defendant, close the complaint, and ping everyone involved. Organiser only
// (the trials insert policy requires admin).
export async function sendComplaintToCourt(
  complaintId: string,
): Promise<{ ok: true; trialId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return { ok: false, error: "Only the organiser can convene the court." };

  const { data: complaint } = await supabase
    .from("complaints")
    .select("against_id, reason, filed_by, second_opinion_by")
    .eq("id", complaintId)
    .single();
  const cx = complaint as {
    against_id: string | null;
    reason: string;
    filed_by: string | null;
    second_opinion_by: string | null;
  } | null;
  if (!cx) return { ok: false, error: "Complaint not found." };
  if (!cx.against_id) return { ok: false, error: "Say who it's about before sending it to court." };

  const { data: trial, error } = await supabase
    .from("trials")
    .insert({ defendant_id: cx.against_id, charge: cx.reason, created_by: user.id })
    .select("id")
    .single();
  if (error || !trial) return { ok: false, error: "Couldn't open the case." };
  const trialId = (trial as { id: string }).id;

  // Close the complaint on the board — it's now in the Tribunal.
  await supabase
    .from("complaints")
    .update({
      status: "addressed",
      ruling: "Referred to the Tribunal.",
      addressed_by: user.id,
      addressed_at: new Date().toISOString(),
    })
    .eq("id", complaintId);

  // The accused gets the bad news; the filer and any helper get the verdict on
  // their complaint.
  await sendToPlayers([cx.against_id], "board", {
    title: "The board are taking you to court",
    body: `${cx.reason} — tap to enter your defence.`,
    url: `/trial/${trialId}`,
    tag: "board",
  });
  const supporters = [cx.filed_by, cx.second_opinion_by].filter(
    (id): id is string => Boolean(id) && id !== user.id && id !== cx.against_id,
  );
  if (supporters.length > 0) {
    await sendToPlayers(supporters, "board", {
      title: "Your complaint is going to court",
      body: "The president and board agree — it's headed to the Tribunal.",
      url: `/trial/${trialId}`,
      tag: "board",
    });
  }

  revalidatePath("/board");
  revalidatePath("/trial");
  return { ok: true, trialId };
}

// The admin names the President (one at a time). Admin keeps all powers.
export async function setPresident(
  playerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return { ok: false, error: "Only the owner can name the president." };

  // Clear the title, then grant it.
  await supabase.from("profiles").update({ is_president: false }).neq("id", playerId);
  const { error } = await supabase.from("profiles").update({ is_president: true }).eq("id", playerId);
  if (error) return { ok: false, error: "Couldn't set the president." };

  revalidatePath("/admin");
  revalidatePath("/board");
  return { ok: true };
}
