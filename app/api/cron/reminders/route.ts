import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendToPlayers } from "@/lib/push";
import { heroDate, shortTime } from "@/lib/dates";
import { compHeading, compMetaChip, gameIdFromName } from "@/lib/games";
import type { Competition, Profile, RadarGame, Rsvp } from "@/lib/types";

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
          title: `Today: ${tee ? tee + " · " : ""}${compHeading(comp)}`,
          body: compMetaChip(comp),
          url: `/comp/${comp.id}`,
          tag: `dayof-${comp.id}`,
        });
        await markSent(admin, comp.id, "dayof", fresh);
        sent += fresh.length;
      }
    }
  }

  // Radar releases out today → tell everyone and add it to the games list.
  const { data: releases } = await admin
    .from("radar_games")
    .select("*")
    .eq("release_date", todayStr);
  for (const r of (releases ?? []) as RadarGame[]) {
    const everyoneIds = allProfiles.map((p) => p.id);
    const fresh = await notYetSent(admin, r.id, "radar_release", everyoneIds);
    if (fresh.length > 0) {
      await sendToPlayers(fresh, "new_comp", {
        title: `🎮 Out today: ${r.title}`,
        body: "It's released — added to the games list. Fancy a night?",
        url: "/radar",
        tag: `radar-release-${r.id}`,
      });
      await markSent(admin, r.id, "radar_release", fresh);
      sent += fresh.length;
      await addReleasedGameToList(admin, r.title);
    }
  }

  return NextResponse.json({ ok: true, sent });
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

// Add a released radar game to the CO-editable games list (idempotent by id).
async function addReleasedGameToList(admin: Admin, title: string) {
  const id = gameIdFromName(title);
  if (!id) return;
  const { data } = await admin.from("app_settings").select("games").eq("id", 1).maybeSingle();
  const raw = (data as { games?: unknown } | null)?.games;
  const games = Array.isArray(raw)
    ? (raw as { id: string; name: string; emoji: string; hasScorecard: boolean }[])
    : [];
  if (games.some((g) => g.id === id)) return;
  games.push({ id, name: title.trim(), emoji: "🎮", hasScorecard: false });
  await admin.from("app_settings").update({ games }).eq("id", 1);
}

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
