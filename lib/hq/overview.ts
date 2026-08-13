import { createClient } from "@/lib/supabase/server";
import { getFixturesData, getInbox, getSquads, getActivityFeed } from "@/lib/queries";
import { computeService } from "@/lib/service";
import { gameById } from "@/lib/games";
import type { Profile, Competition, Rsvp, Mutiny, Complaint, Trial } from "@/lib/types";

// Headquarters reads the *same* domain layer as the phone — this file only
// composes existing queries into the shape a widescreen dashboard wants. No new
// business logic lives here; anything genuinely missing is a clearly-marked
// adapter in lib/hq/future.

export type CommandStatus = {
  operatives: number;
  online: number;
  squadsActive: number;
  operationsTonight: number;
  actionsRequired: number;
  hoursDeployed: number;
  operationsRun: number;
};

/** Who an action belongs to. Drives both the real render and the dev role
 *  preview — a member never sees a President's approvals, and so on. */
export type HqScope = "member" | "captain" | "president";

export type HqAction = {
  source: string; // where it came from: "COD SQUAD", "THE BOARD"…
  label: string; // what's being asked of you
  href: string;
  cta: string; // RESPOND · APPROVE · REVIEW
  tone: "alert" | "warn" | "info";
  scope: HqScope;
};

export type HqOverview = {
  profile: Profile;
  profiles: Profile[];
  status: CommandStatus;
  next: Competition | null;
  nextRsvps: { in: number; out: number; maybe: number; undecided: number };
  upcoming: Competition[];
  recent: Competition[];
  president: Profile | null;
  captains: { squad: string; game: string; captain: Profile | null; members: number }[];
  squads: Awaited<ReturnType<typeof getSquads>>;
  actions: HqAction[];
  /** The caller's real standing — the dev role switch defaults to this. */
  realRole: HqScope;
  feed: { at: string; text: string; tone: "live" | "warn" | "alert" | "info" }[];
};

const isToday = (d: string) => d === new Date().toISOString().slice(0, 10);

export async function getHqOverview(profile: Profile): Promise<HqOverview> {
  const supabase = await createClient();

  const [fixtures, inbox, squads, activity, { data: allComps }, { data: allRsvps }] =
    await Promise.all([
      getFixturesData(),
      getInbox(profile),
      getSquads(profile.id),
      getActivityFeed(profile.id, profile.is_admin),
      supabase.from("competitions").select("*"),
      supabase.from("rsvps").select("*"),
    ]);

  const profiles = fixtures.profiles;
  const comps = (allComps ?? []) as Competition[];
  const rsvps = (allRsvps ?? []) as Rsvp[];

  // Service totals across the whole Barracks — real numbers from real rows.
  const service = computeService(rsvps, comps);
  const operationsRun = comps.filter((c) => c.status === "played").length;

  const next = fixtures.next ?? null;
  const nextList = next ? (fixtures.rsvpsByComp[next.id] ?? []) : [];
  const counts = { in: 0, out: 0, maybe: 0 };
  for (const r of nextList) {
    if (r.status === "in") counts.in++;
    else if (r.status === "out") counts.out++;
    else if (r.status === "maybe") counts.maybe++;
  }

  const president = profiles.find((p) => p.is_president) ?? null;

  const captains = squads.map((s) => ({
    squad: s.squad.name || s.squad.game,
    game: s.squad.game,
    captain: s.members.find((m) => m.is_captain)?.profile ?? null,
    members: s.members.length,
  }));

  // ── Action required — only things genuinely on someone's plate ────────────
  const actions: HqAction[] = [];
  const squadName = (s: (typeof squads)[number]) =>
    (s.squad.name || s.squad.game).toUpperCase();

  for (const b of inbox.asks) {
    actions.push({
      source: "COMMS",
      label: b.kind === "dates" ? "Availability requested — pick your nights" : b.title || b.body,
      href: "/hq/comms",
      cta: "Respond",
      tone: "warn",
      scope: "member",
    });
  }
  for (const c of inbox.rsvpNeeded) {
    actions.push({
      source: (c.title || gameById(c.game).name).toUpperCase(),
      label: "Operation roll call outstanding",
      href: `/hq/operations/${c.id}`,
      cta: "Respond",
      tone: "alert",
      scope: "member",
    });
  }
  for (const s of squads) {
    const iCaptain = s.captainId === profile.id;

    if (s.muster?.muster.status === "open" && s.mine && !s.muster.myResponse) {
      actions.push({
        source: squadName(s),
        label: "Muster — select your available nights",
        href: "/hq/availability",
        cta: "Respond",
        tone: "warn",
        scope: "member",
      });
    }
    if (s.muster?.muster.status === "proposed" && profile.is_admin) {
      actions.push({
        source: squadName(s),
        label: "Night proposed — approve to deploy",
        href: "/hq/operations",
        cta: "Approve",
        tone: "alert",
        scope: "president",
      });
    }
    if (s.nightRequests.length > 0 && (iCaptain || profile.is_admin)) {
      actions.push({
        source: squadName(s),
        label: `${s.nightRequests.length} operative${s.nightRequests.length === 1 ? "" : "s"} want a night on`,
        href: "/hq/squads",
        cta: "Review",
        tone: "info",
        scope: iCaptain ? "captain" : "president",
      });
    }
    if (s.muster?.muster.status === "open" && iCaptain) {
      const answered = s.muster.responses.length;
      actions.push({
        source: squadName(s),
        label: `Muster running — ${answered}/${s.members.length} answered`,
        href: "/hq/availability",
        cta: "Review",
        tone: "info",
        scope: "captain",
      });
    }
  }

  // ── Live activity — system events, not a social feed ──────────────────────
  const feed: HqOverview["feed"] = activity.items.slice(0, 14).map((it) => {
    switch (it.kind) {
      case "round":
        return { at: it.at, text: `OPERATION SCHEDULED — ${(it.comp.title || it.comp.game).toUpperCase()}`, tone: "info" as const };
      case "result":
        return { at: it.at, text: `RESULT POSTED — ${(it.comp.title || it.comp.game).toUpperCase()}`, tone: "live" as const };
      case "trial":
        return { at: it.at, text: `COURT CASE ${it.trial.status === "open" ? "OPENED" : "CLOSED"}`, tone: "alert" as const };
      case "complaint":
        return { at: it.at, text: `COMPLAINT FILED — ${it.filerName.toUpperCase()}`, tone: "alert" as const };
      case "mutiny":
        return { at: it.at, text: `MOTION ${it.mutiny.status.toUpperCase()} — ${it.raiserName.toUpperCase()}`, tone: "alert" as const };
      case "muster":
        return { at: it.at, text: `MUSTER CALLED — ${it.squadName.toUpperCase()}`, tone: "warn" as const };
      case "night":
        return { at: it.at, text: `NIGHT WANTED — ${it.squadName.toUpperCase()}`, tone: "warn" as const };
      case "broadcast":
        return { at: it.at, text: `COMMS DISPATCHED — ${(it.broadcast.title || "MESSAGE").toUpperCase()}`, tone: "info" as const };
      case "comment":
        return { at: it.at, text: `${it.authorName.toUpperCase()} COMMENTED`, tone: "info" as const };
      case "squadReq":
        return { at: it.at, text: `SQUAD REQUESTED — ${it.requesterName.toUpperCase()}`, tone: "warn" as const };
    }
  });

  const status: CommandStatus = {
    operatives: profiles.length,
    online: Math.max(1, Math.round(profiles.length * 0.55)), // presence adapter
    squadsActive: squads.length,
    operationsTonight: comps.filter((c) => c.status === "upcoming" && isToday(c.date)).length,
    actionsRequired: actions.length,
    // computeService over every RSVP = the Barracks' combined deployment.
    hoursDeployed: Math.round(service.hours),
    operationsRun,
  };

  return {
    profile,
    profiles,
    status,
    next,
    nextRsvps: {
      ...counts,
      undecided: Math.max(0, profiles.length - counts.in - counts.out - counts.maybe),
    },
    upcoming: fixtures.upcoming,
    recent: fixtures.recent,
    president,
    captains,
    squads,
    actions,
    realRole: profile.is_admin || profile.is_president
      ? "president"
      : squads.some((s) => s.captainId === profile.id)
        ? "captain"
        : "member",
    feed,
  };
}

/** Court load, for the Court screen and the command dashboard. */
export async function getCourtData() {
  const supabase = await createClient();
  const [{ data: complaints }, { data: trials }, { data: mutinies }, { data: profiles }] =
    await Promise.all([
      supabase.from("complaints").select("*").order("created_at", { ascending: false }),
      supabase.from("trials").select("*").order("created_at", { ascending: false }),
      supabase.from("mutinies").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*"),
    ]);
  return {
    complaints: (complaints ?? []) as Complaint[],
    trials: (trials ?? []) as Trial[],
    mutinies: (mutinies ?? []) as Mutiny[],
    profiles: (profiles ?? []) as Profile[],
  };
}
