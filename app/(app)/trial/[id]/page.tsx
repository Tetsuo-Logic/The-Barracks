import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { previewingAsPlayer } from "@/lib/preview";
import { canRule } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { TrialView } from "@/components/TrialView";
import type { Profile, Trial, TrialVote } from "@/lib/types";

export default async function TrialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const preview = await previewingAsPlayer();
  const supabase = await createClient();

  const { data: trial } = await supabase.from("trials").select("*").eq("id", id).single();
  if (!trial) notFound();

  const [{ data: votes }, { data: profiles }] = await Promise.all([
    supabase.from("trial_votes").select("*").eq("trial_id", id),
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
  ]);

  // Mirror president_rule (0042): a case with a nominated judge — i.e. a carried
  // mutiny, where the President is in the dock — is theirs alone to rule on.
  // Every other case stays with the President/CO.
  const t = trial as Trial;
  const mayRule = t.judge_id
    ? t.judge_id === profile.id
    : canRule(profile, preview);

  return (
    <div>
      <Link href="/trial" className="label mb-4 inline-block text-ink-soft">
        ← The Courtroom
      </Link>
      <TrialView
        trial={t}
        votes={(votes ?? []) as TrialVote[]}
        profiles={(profiles ?? []) as Profile[]}
        currentUserId={profile.id}
        canRule={mayRule}
      />
    </div>
  );
}
