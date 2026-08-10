import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getPrefs } from "@/app/actions/prefs";
import { signOut } from "@/app/actions/auth";
import { NotificationSettings } from "@/components/NotificationSettings";
import { InstallCard } from "@/components/InstallCard";
import { ConsoleHeader } from "@/components/ConsoleHeader";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function SettingsPage() {
  const profile = await requireProfile();
  const prefs = await getPrefs();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <ConsoleHeader title="Settings" tag="Config" className="mb-3" />
        <p className="text-ink-soft">Signed in as {profile.name}.</p>
      </div>

      {profile.is_admin && (
        <Link
          href="/admin"
          className="flex items-center justify-between rounded-[3px] border border-ink bg-card px-4 py-3"
        >
          <span className="font-narrow font-semibold uppercase tracking-[0.08em] text-ink">
            Organiser tools
          </span>
          <span className="label text-ink-soft">Strikes · Messages →</span>
        </Link>
      )}

      <InstallCard />

      <section>
        <p className="label mb-3">Display</p>
        <ThemeToggle />
      </section>

      <section>
        <p className="label mb-3">Notifications</p>
        <NotificationSettings prefs={prefs} />
      </section>

      <form action={signOut}>
        <button
          type="submit"
          className="rounded-[3px] border border-flag px-5 py-2.5 font-narrow font-semibold uppercase tracking-[0.08em] text-flag"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
