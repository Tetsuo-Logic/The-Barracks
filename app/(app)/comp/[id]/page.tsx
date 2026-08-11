import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { previewingAsPlayer } from "@/lib/preview";
import { effectiveAdmin } from "@/lib/permissions";
import { getCompetitionDetail } from "@/lib/queries";
import { CompDetail } from "@/components/CompDetail";

export default async function CompPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [profile, detail] = await Promise.all([
    requireProfile(),
    getCompetitionDetail(id),
  ]);
  if (!detail) notFound();

  const isAdmin = effectiveAdmin(profile, await previewingAsPlayer());
  // CO of this room = the President/organiser, or the squad's Captain, or a
  // stand-in Captain named for this one event (Sq-3).
  const isCO =
    isAdmin ||
    detail.squadCaptainId === profile.id ||
    detail.comp.acting_captain_id === profile.id;

  return (
    <div>
      <Link
        href="/"
        className="label mb-4 inline-block text-ink-soft"
      >
        ← Games
      </Link>
      <CompDetail
        detail={detail}
        currentUserId={profile.id}
        isAdmin={isAdmin}
        isCO={isCO}
      />
    </div>
  );
}
