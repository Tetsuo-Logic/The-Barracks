import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { previewingAsPlayer } from "@/lib/preview";
import { canRule, effectiveAdmin } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { ComplaintBoard } from "@/components/ComplaintBoard";
import { MutinyPanel } from "@/components/MutinyPanel";
import { ConsoleHeader } from "@/components/ConsoleHeader";
import type { Complaint, Mutiny, Profile } from "@/lib/types";

export default async function BoardPage() {
  const profile = await requireProfile();
  const preview = await previewingAsPlayer();
  const supabase = await createClient();

  // RLS decides what comes back here: a President simply cannot select a live
  // motion against themselves, so the secrecy holds even if the UI slipped.
  const [{ data: complaints }, { data: profiles }, { data: mutinies }, { data: myVotes }] =
    await Promise.all([
      supabase.from("complaints").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      supabase
        .from("mutinies")
        .select("*")
        .in("status", ["voting", "carried", "failed"])
        .order("created_at", { ascending: false })
        .limit(1),
      supabase.from("mutiny_votes").select("mutiny_id, agree"),
    ]);

  const allProfiles = (profiles ?? []) as Profile[];
  const president = allProfiles.find((p) => p.is_president);
  const mutiny = ((mutinies ?? []) as Mutiny[])[0] ?? null;
  const myVote = mutiny
    ? (((myVotes ?? []) as { mutiny_id: string; agree: boolean }[]).find(
        (v) => v.mutiny_id === mutiny.id,
      )?.agree ?? null)
    : null;

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

      <MutinyPanel
        mutiny={mutiny}
        profiles={allProfiles}
        currentUserId={profile.id}
        president={president ?? null}
        myVote={myVote}
      />

      <ComplaintBoard
        complaints={(complaints ?? []) as Complaint[]}
        profiles={allProfiles}
        currentUserId={profile.id}
        currentPresidentId={president?.id ?? null}
        canRule={canRule(profile, preview)}
        isAdmin={effectiveAdmin(profile, preview)}
      />
    </div>
  );
}
