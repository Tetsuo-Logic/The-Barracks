import { requireProfile } from "@/lib/auth";
import { getPlayerRecord } from "@/lib/queries";
import { ProfileView } from "@/components/ProfileView";
import { EditProfile } from "@/components/EditProfile";

// /you — your own profile, editable in place (§5).
export default async function YouPage() {
  const profile = await requireProfile();
  const record = await getPlayerRecord(profile.id);

  return (
    <div>
      <p className="label mb-4">You</p>
      {record && <ProfileView record={record} />}
      <div className="mt-6">
        <EditProfile profile={profile} />
      </div>
    </div>
  );
}
