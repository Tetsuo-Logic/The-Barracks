import { requireProfile } from "@/lib/auth";
import { previewingAsPlayer } from "@/lib/preview";
import { effectiveAdmin } from "@/lib/permissions";
import {
  getFixturesData,
  getCompetition,
  getInbox,
  getOpenGameRequests,
  getGames,
} from "@/lib/queries";
import { EmptyState } from "@/components/EmptyState";
import { NextUpCard } from "@/components/NextUpCard";
import { CompListRow } from "@/components/CompListRow";
import { AddDateButton } from "@/components/AddDateButton";
import { CompSheet } from "@/components/CompSheet";
import { GameRequests } from "@/components/GameRequests";
import { CommandBanner } from "@/components/CommandBanner";
import { Inbox } from "@/components/Inbox";

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
  const [inbox, gameRequests, games] = await Promise.all([
    getInbox(profile),
    getOpenGameRequests(),
    getGames(),
  ]);

  const isAdmin = effectiveAdmin(profile, await previewingAsPlayer());
  // Only the organiser gets the create/edit sheet.
  const sheet = isAdmin ? sp.sheet : undefined;
  const sheetOpen = Boolean(sheet);
  const editComp =
    sheet && sheet !== "new" ? await getCompetition(sheet) : null;

  const recentCourses = Array.from(
    new Set(
      [next, ...upcoming, ...recent]
        .filter(Boolean)
        .map((c) => (c as { course: string | null }).course)
        .filter((c): c is string => Boolean(c)),
    ),
  ).slice(0, 6);

  return (
    <div>
      <CommandBanner operators={profiles.length} callsign={profile.nickname} />

      <Inbox inbox={inbox} />

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
          <p className="label mb-2" style={{ color: "var(--color-sand)" }}>▸ Next up</p>
          <EmptyState action={isAdmin ? <AddDateButton /> : undefined}>
            {isAdmin
              ? "No games on the board. Deploy one, or put a request in below. 🎮"
              : "No games on the board yet — put a request in below. 🎮"}
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

      {/* Player-initiated game requests — anyone can float a game */}
      <GameRequests
        requests={gameRequests}
        isAdmin={isAdmin}
        currentUserId={profile.id}
        games={games}
      />

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
          games={games}
        />
      )}
    </div>
  );
}
