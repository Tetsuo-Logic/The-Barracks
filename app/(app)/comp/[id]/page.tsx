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
        isAdmin={effectiveAdmin(profile, await previewingAsPlayer())}
      />
    </div>
  );
}
