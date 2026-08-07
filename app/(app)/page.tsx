import { requireProfile } from "@/lib/auth";
import { getFixturesData, getCompetition } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { NextUpCard } from "@/components/NextUpCard";
import { CompListRow } from "@/components/CompListRow";
import { AddDateButton } from "@/components/AddDateButton";
import { CompSheet } from "@/components/CompSheet";
import { GolfBanner } from "@/components/GolfScene";
import { PendingAsks } from "@/components/PendingAsks";
import type { Broadcast } from "@/lib/types";

// / — Fixtures (home). Next-up hero, upcoming + recent lists, add/edit sheet.
export default async function FixturesPage({
  searchParams,
}: {
  searchParams: Promise<{ sheet?: string }>;
}) {
  const [profile, data, sp] = await Promise.all([
    requireProfile(),
    getFixturesData(),
    searchParams,
  ]);
  const { profiles, next, upcoming, recent, rsvpsByComp } = data;

  const isAdmin = profile.is_admin;
  // Only the organiser gets the create/edit sheet.
  const sheet = isAdmin ? sp.sheet : undefined;
  const sheetOpen = Boolean(sheet);
  const editComp =
    sheet && sheet !== "new" ? await getCompetition(sheet) : null;

  const recentCourses = Array.from(
    new Set(
      [next, ...upcoming, ...recent]
        .filter(Boolean)
        .map((c) => (c as { course: string }).course),
    ),
  ).slice(0, 6);

  // Questions put to you (yes/no or ask) that you haven't answered — surfaced
  // here so they always reach you, notification or not.
  const supabase = await createClient();
  const [{ data: bx }, { data: myResp }] = await Promise.all([
    supabase
      .from("broadcasts")
      .select("*")
      .in("kind", ["yesno", "ask"])
      .neq("created_by", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("broadcast_responses")
      .select("broadcast_id")
      .eq("player_id", profile.id),
  ]);
  const answered = new Set((myResp ?? []).map((r) => r.broadcast_id));
  const pendingAsks = ((bx ?? []) as Broadcast[]).filter(
    (b) => !answered.has(b.id),
  );

  return (
    <div>
      {/* course-horizon banner — the illustration you meet every visit */}
      <div className="mb-6 overflow-hidden rounded-[3px] border border-rule">
        <GolfBanner className="block h-24 w-full" />
      </div>

      <PendingAsks pending={pendingAsks} />

      {next ? (
        <NextUpCard
          comp={next}
          profiles={profiles}
          rsvps={rsvpsByComp[next.id] ?? []}
          currentUserId={profile.id}
          isAdmin={isAdmin}
        />
      ) : (
        <>
          <p className="label mb-2">Next up</p>
          <EmptyState action={isAdmin ? <AddDateButton /> : undefined}>
            {isAdmin
              ? "No dates in the diary. Someone has to go first."
              : "No dates in the diary yet."}
          </EmptyState>
        </>
      )}

      {upcoming.length > 0 && (
        <section className="mt-8">
          <p className="label mb-1">Upcoming</p>
          <hr className="rule" />
          <div className="divide-y divide-rule">
            {upcoming.map((c) => (
              <CompListRow key={c.id} comp={c} rsvps={rsvpsByComp[c.id] ?? []} />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="mt-8">
          <p className="label mb-1">Recent</p>
          <hr className="rule" />
          <div className="divide-y divide-rule">
            {recent.map((c) => (
              <CompListRow key={c.id} comp={c} rsvps={rsvpsByComp[c.id] ?? []} />
            ))}
          </div>
        </section>
      )}

      {next && isAdmin && (
        <div className="mt-10 text-center">
          <AddDateButton />
        </div>
      )}

      {isAdmin && (
        <CompSheet
          open={sheetOpen}
          initial={editComp}
          recentCourses={recentCourses}
        />
      )}
    </div>
  );
}
