import { requireProfile } from "@/lib/auth";
import { previewingAsPlayer } from "@/lib/preview";
import { getInbox } from "@/lib/queries";
import { Header } from "@/components/Header";
import { TabBar } from "@/components/TabBar";
import { AnnounceProvider } from "@/components/Announce";
import { PreviewBanner } from "@/components/PreviewControls";
import { PullToRefresh } from "@/components/PullToRefresh";

// The four-tab app shell. Everything inside requires a completed profile;
// login and onboarding live outside this group.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const preview = await previewingAsPlayer();
  const isAdmin = profile.is_admin && !preview;
  const { total: pendingCount } = await getInbox(profile);

  return (
    <AnnounceProvider>
      {profile.is_admin && preview && <PreviewBanner />}
      <div className="flex min-h-[100dvh] flex-col">
        <Header profile={profile} pendingCount={pendingCount} isAdmin={isAdmin} />
        {/* pad-bottom clears the fixed tab bar (56px) + safe area */}
        <main className="mx-auto w-full max-w-[520px] flex-1 px-4 pb-[calc(72px+env(safe-area-inset-bottom))] pt-5">
          <PullToRefresh>{children}</PullToRefresh>
        </main>
        <TabBar />
      </div>
    </AnnounceProvider>
  );
}
