import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StrikesManager } from "@/components/StrikesManager";
import { PresidentPicker } from "@/components/PresidentPicker";
import { GamesManager } from "@/components/GamesManager";
import { PreviewToggle } from "@/components/PreviewControls";
import { ConsoleHeader } from "@/components/ConsoleHeader";
import { MegaphoneIcon } from "@/components/Icons";
import { getGames } from "@/lib/queries";
import { previewingAsPlayer } from "@/lib/preview";
import { effectiveAdmin } from "@/lib/permissions";
import type { Profile, Strike, Warning } from "@/lib/types";

// The organiser's control room. Admin only.
export default async function AdminPage() {
  const profile = await requireProfile();
  if (!effectiveAdmin(profile, await previewingAsPlayer())) redirect("/");

  const supabase = await createClient();
  const [{ data: profiles }, { data: strikes }, { data: warnings }, games] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("strikes").select("*"),
    supabase.from("warnings").select("*"),
    getGames(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <ConsoleHeader title="Control Room" tag="Command" className="" />

      <Link
        href="/broadcast"
        className="flex items-center justify-between rounded-[3px] border border-rule bg-card px-4 py-3"
      >
        <span className="flex items-center gap-3">
          <MegaphoneIcon />
          <span className="text-ink">Comms 📡</span>
        </span>
        <span className="label text-ink-soft">Open →</span>
      </Link>

      <Link
        href="/trial"
        className="flex items-center justify-between rounded-[3px] border border-rule bg-card px-4 py-3"
      >
        <span className="text-ink">The Courtroom</span>
        <span className="label text-ink-soft">Convene →</span>
      </Link>

      <section>
        <p className="label mb-1">Testing</p>
        <p className="mb-3 text-sm text-ink-soft">
          See the app as a normal player. Exit from the banner up top.
        </p>
        <PreviewToggle />
      </section>

      <section>
        <p className="label mb-1">Games 🎮</p>
        <p className="mb-4 text-sm text-ink-soft">
          Add any game, remove any. Only The Threeball Cup keeps golf scoring.
        </p>
        <GamesManager games={games} />
      </section>

      <section>
        <p className="label mb-1">The president</p>
        <p className="mb-4 text-sm text-ink-soft">
          Hand over the title. You keep every other power.
        </p>
        <PresidentPicker profiles={(profiles ?? []) as Profile[]} />
      </section>

      <section>
        <p className="label mb-1">Strikes &amp; warnings</p>
        <p className="mb-4 text-sm text-ink-soft">
          Said they&apos;d turn up and didn&apos;t? Mark it.
        </p>
        <StrikesManager
          profiles={(profiles ?? []) as Profile[]}
          strikes={(strikes ?? []) as Strike[]}
          warnings={(warnings ?? []) as Warning[]}
        />
      </section>
    </div>
  );
}
