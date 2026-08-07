import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { OnboardingFlow } from "@/components/OnboardingFlow";

// /onboarding — first run after auth. Photo (step 2) and the notification
// prompt are wired in later phases; Phase 1 nails the name/nickname moment.
export default async function OnboardingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.nickname) redirect("/"); // already onboarded

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col px-6 py-10">
      <OnboardingFlow
        initialName={profile.name}
        colour={profile.colour}
      />
    </main>
  );
}
