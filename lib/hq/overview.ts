import { createClient } from "@/lib/supabase/server";
import { getFixturesData, getInbox, getSquads, getActivityFeed } from "@/lib/queries";
import { computeService } from "@/lib/service";
import { gameById } from "@/lib/games";
import { confirmState } from "@/lib/rsvp";
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
  /** The Barracks being commanded. Read from `groups` — never hardcoded, since
   *  every group names its own. Crest and clan tag will hang off this later. */
  barracks: { id: string | null; name: string };
  status: CommandStatus;
  /** What the hero shows: whatever is running, else the soonest not started. */
  next: Competition | null;
  /** Everything running right now, soonest first. More than one is normal on
   *  a busy night, so this is a list rather than a single Operation. */
  live: Competition[];
  /** Queued behind the hero, so a live night doesn't hide the next one. */
  upNext: Competition | null;
  nextRsvps: {
    in: number;
    out: number;
    maybe: number;
    undecided: number;
    lapsed: number;
    pending: number;
    confirmBy: string | null;
  };
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

  const [
    fixtures,
    inbox,
    squads,
    activity,
    { data: allComps },
    { data: allRsvps },
    { data: membership },
  ] = await Promise.all([
    getFixturesData(),
    getInbox(profile),
    getSquads(profile.id),
    getActivityFeed(profile.id, profile.is_admin),
    supabase.from("competitions").select("*"),
    supabase.from("rsvps").select("*"),
    // The caller's Barracks. A User may hold 0..n memberships; this surface
    // commands one at a time, so take the membership we're rendering for.
    supabase
      .from("memberships")
      .select("group_id, groups(id, name)")
      .eq("user_id", profile.id)
      .limit(1)
      .maybeSingle(),
  ]);

  // PostgREST returns an embedded many-to-one as an object, but returns an
  // array when it can't infer the relationship. Handle both, so a rename never
  // silently falls back to the default name.
  type GroupRow = { id: string; name: string };
  const embedded = (membership as { groups?: GroupRow | GroupRow[] | null } | null)?.groups ?? null;
  const group: GroupRow | null = Array.isArray(embedded) ? (embedded[0] ?? null) : embedded;

  const profiles = fixtures.profiles;
  const comps = (allComps ?? []) as Competition[];
  const rsvps = (allRsvps ?? []) as Rsvp[];

  // Service totals across the whole Barracks — real numbers from real rows.
  const service = computeService(rsvps, comps);
  const operationsRun = comps.filter((c) => c.status === "played").length;

  // ── What the hero is looking at ──────────────────────────────────────────
  // An Operation that has started is not "next" — it's happening. Until this
  // was separated, a night that kicked off pinned the hero to itself and the
  // one behind it had nowhere to appear; it just sat in This Week looking
  // scheduled while the board said the evening was already under way.
  //
  // getFixturesData also orders by date alone, so two Operations on the same
  // night came back in whatever order the query returned. Ordering by kick-off
  // is what makes "the 20:00, then the 21:00" actually true.
  const startsAt = (c: Competition) => `${c.date}T${(c.tee_time ?? "20:00:00").slice(0, 8)}`;
  const byWhen = (a: Competition, b: Competition) => (startsAt(a) < startsAt(b) ? -1 : 1);

  // An Operation is under way once its kick-off has passed, whether or not
  // anyone opened the room. Waiting for `started_at` meant a night that began
  // half an hour ago still read as merely scheduled.
  //
  // CAVEAT: dates and times are stored as wall clock with no timezone, so this
  // comparison is only right when the server shares the Barracks' clock. True
  // locally; an hour out on a UTC host during BST. The whole app carries this
  // assumption (see isToday) — fixing it means giving a Barracks a timezone.
  const n = new Date();
  const p2 = (v: number) => String(v).padStart(2, "0");
  const nowStamp = `${n.getFullYear()}-${p2(n.getMonth() + 1)}-${p2(n.getDate())}T${p2(n.getHours())}:${p2(n.getMinutes())}:${p2(n.getSeconds())}`;
  const today = nowStamp.slice(0, 10);

  const begun = (c: Competition) => c.started_at != null || startsAt(c) <= nowStamp;
  const isLive = (c: Competition) => begun(c) && c.finished_at == null && c.status !== "cancelled";

  const scheduled = comps.filter((c) => c.status === "upcoming").sort(byWhen);

  // Everything running, not just the first — two or three Operations can
  // easily overlap on a busy night, and the board has to say so.
  const live = scheduled.filter(isLive);
  const notStarted = scheduled.filter((c) => !begun(c) && c.date >= today);

  const next = live[0] ?? notStarted[0] ?? scheduled[0] ?? null;
  // Queued behind whatever's on the hero.
  const upNext = notStarted.find((c) => c.id !== next?.id) ?? null;
  const upcoming = scheduled.filter((c) => c.id !== next?.id);

  // A roster only means something if it counts people who have actually
  // committed. An answer carried over from the muster that nobody confirmed
  // before the deadline is off the roster — that is the deadline's whole job.
  const nextList = next ? rsvps.filter((r) => r.competition_id === next.id) : [];
  const counts = { in: 0, out: 0, maybe: 0 };
  let lapsed = 0;
  let pending = 0;
  for (const r of nextList) {
    const state = next ? confirmState(r, next) : "confirmed";
    if (state === "lapsed") {
      lapsed++;
      continue;
    }
    if (state === "pending") pending++;
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
        // Members have no Planning surface; they answer inside their squad.
        href: "/hq/squads",
        cta: "Respond",
        tone: "warn",
        scope: "member",
      });
    }
    if (s.muster?.muster.status === "proposed" && profile.is_admin) {
      actions.push({
        source: squadName(s),
        label: "Operation ready to plan",
        // Deep link — the President lands on this request in Command Planning,
        // expanded, rather than on a page they have to search.
        href: `/hq/availability?req=${s.muster.muster.id}`,
        cta: "Review",
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

  // Missed confirmations are the President's problem, not the Court's: the
  // system reports them and a human decides whether it matters. Approving
  // somebody back on is a Captain's call too.
  if (lapsed > 0 && next && profile.is_admin) {
    actions.push({
      source: (next.title || gameById(next.game).name).toUpperCase(),
      label: `${lapsed} never confirmed — off the roster`,
      href: `/hq/operations/${next.id}`,
      cta: "Review",
      tone: "alert",
      scope: "president",
    });
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
    barracks: { id: group?.id ?? null, name: group?.name ?? "Unnamed Barracks" },
    status,
    next,
    live,
    upNext,
    nextRsvps: {
      ...counts,
      undecided: Math.max(0, profiles.length - counts.in - counts.out - counts.maybe),
      /** Carried from the muster, deadline gone, off the roster. */
      lapsed,
      /** Carried from the muster, clock still running. */
      pending,
      confirmBy: next?.confirm_by ?? null,
    },
    upcoming,
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
