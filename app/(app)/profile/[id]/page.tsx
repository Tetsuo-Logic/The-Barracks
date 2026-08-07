import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getPlayerRecord } from "@/lib/queries";
import { ProfileView } from "@/components/ProfileView";
import { EditProfile } from "@/components/EditProfile";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [me, record] = await Promise.all([requireProfile(), getPlayerRecord(id)]);
  if (!record) notFound();

  const isSelf = me.id === id;

  return (
    <div>
      <Link href="/standings" className="label mb-4 inline-block text-ink-soft">
        ← Standings
      </Link>
      <ProfileView record={record} />
      {isSelf && (
        <div className="mt-6">
          <EditProfile profile={record.profile} />
        </div>
      )}
    </div>
  );
}
