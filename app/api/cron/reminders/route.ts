import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendToPlayers } from "@/lib/push";
import { heroDate, shortTime, formatLabel } from "@/lib/dates";
import type { Competition, Profile, Rsvp } from "@/lib/types";

// Daily sweep (§6.4), run by Vercel Cron, guarded by CRON_SECRET.
// - chase: competitions 3 days out with players who haven't answered
// - day-of: competitions today → everyone who is in
// sent_notifications makes it safe to retry (can't double-send).
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const today = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayStr = iso(today);
  const in3 = new Date(today);
  in3.setDate(in3.getDate() + 3);
  const in3Str = iso(in3);

  const { data: profiles } = await admin.from("profiles").select("*");
  const allProfiles = (profiles ?? []) as Profile[];

  const { data: comps } = await admin
    .from("competitions")
    .select("*")
    .eq("status", "upcoming")
    .in("date", [todayStr, in3Str]);

  let sent = 0;

  for (const comp of (comps ?? []) as Competition[]) {
    const { data: rsvps } = await admin
      .from("rsvps")
      .select("*")
      .eq("competition_id", comp.id);
    const rsvpList = (rsvps ?? []) as Rsvp[];
    const { day, mon } = heroDate(comp.date);
    const tee = shortTime(comp.tee_time);

    if (comp.date === in3Str) {
      // chase the undecided
      const answered = new Set(rsvpList.map((r) => r.player_id));
      const inCount = rsvpList.filter((r) => r.status === "in").length;
      const undecided = allProfiles.filter((p) => !answered.has(p.id)).map((p) => p.id);
      const fresh = await notYetSent(admin, comp.id, "chase", undecided);
      if (fresh.length > 0) {
        await sendToPlayers(fresh, "chase_undecided", {
          title: `${day} ${mon} — still no answer`,
          body: `${inCount} of the others ${inCount === 1 ? "is" : "are"} in. Are you?`,
          url: `/comp/${comp.id}`,
          tag: `chase-${comp.id}`,
        });
        await markSent(admin, comp.id, "chase", fresh);
        sent += fresh.length;
      }
    }

    if (comp.date === todayStr) {
      // day-of, to everyone who is in
      const ins = rsvpList.filter((r) => r.status === "in").map((r) => r.player_id);
      const fresh = await notYetSent(admin, comp.id, "dayof", ins);
      if (fresh.length > 0) {
        await sendToPlayers(fresh, "day_of", {
          title: `Today: ${tee ? tee + " at " : ""}${comp.course}`,
          body: `${comp.holes} holes · ${formatLabel(comp.format)}`,
          url: `/comp/${comp.id}`,
          tag: `dayof-${comp.id}`,
        });
        await markSent(admin, comp.id, "dayof", fresh);
        sent += fresh.length;
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

async function notYetSent(admin: Admin, compId: string, kind: string, playerIds: string[]) {
  if (playerIds.length === 0) return [];
  const { data } = await admin
    .from("sent_notifications")
    .select("player_id")
    .eq("competition_id", compId)
    .eq("kind", kind)
    .in("player_id", playerIds);
  const already = new Set((data ?? []).map((r: { player_id: string }) => r.player_id));
  return playerIds.filter((id) => !already.has(id));
}

async function markSent(admin: Admin, compId: string, kind: string, playerIds: string[]) {
  await admin.from("sent_notifications").insert(
    playerIds.map((id) => ({ competition_id: compId, kind, player_id: id })),
  );
}
