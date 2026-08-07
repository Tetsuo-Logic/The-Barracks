import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StrikesManager } from "@/components/StrikesManager";
import { PresidentPicker } from "@/components/PresidentPicker";
import { MegaphoneIcon } from "@/components/Icons";
import type { Profile, Strike } from "@/lib/types";

// The organiser's control room. Admin only.
export default async function AdminPage() {
  const profile = await requireProfile();
  if (!profile.is_admin) redirect("/");

  const supabase = await createClient();
  const [{ data: profiles }, { data: strikes }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("strikes").select("*"),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <p className="label">Organiser</p>

      <Link
        href="/broadcast"
        className="flex items-center justify-between rounded-[3px] border border-rule bg-card px-4 py-3"
      >
        <span className="flex items-center gap-3">
          <MegaphoneIcon />
          <span className="text-ink">Ping the lads</span>
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
        <p className="label mb-1">The president</p>
        <p className="mb-4 text-sm text-ink-soft">
          Hand over the title. You keep every other power.
        </p>
        <PresidentPicker profiles={(profiles ?? []) as Profile[]} />
      </section>

      <section>
        <p className="label mb-1">Strikes</p>
        <p className="mb-4 text-sm text-ink-soft">
          Said they&apos;d turn up and didn&apos;t? Mark it.
        </p>
        <StrikesManager
          profiles={(profiles ?? []) as Profile[]}
          strikes={(strikes ?? []) as Strike[]}
        />
      </section>
    </div>
  );
}
