import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { previewingAsPlayer } from "@/lib/preview";
import { canRule, effectiveAdmin } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { ComplaintBoard } from "@/components/ComplaintBoard";
import { ConsoleHeader } from "@/components/ConsoleHeader";
import type { Complaint, Profile } from "@/lib/types";

export default async function BoardPage() {
  const profile = await requireProfile();
  const preview = await previewingAsPlayer();
  const supabase = await createClient();

  const [{ data: complaints }, { data: profiles }] = await Promise.all([
    supabase.from("complaints").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
  ]);

  const allProfiles = (profiles ?? []) as Profile[];
  const president = allProfiles.find((p) => p.is_president);

  return (
    <div>
      <ConsoleHeader
        title="The Board"
        tag="Grievances"
        right={<Link href="/" className="label text-ink-soft">← Games</Link>}
      />

      {president && (
        <p className="mb-5 rounded-[3px] border border-rule bg-card px-4 py-2 text-sm text-ink">
          President: <span className="font-semibold">{president.name}</span>
          {president.id === profile.id && " — that's you. Rule wisely."}
        </p>
      )}

      <ComplaintBoard
        complaints={(complaints ?? []) as Complaint[]}
        profiles={allProfiles}
        currentUserId={profile.id}
        canRule={canRule(profile, preview)}
        isAdmin={effectiveAdmin(profile, preview)}
      />
    </div>
  );
}
