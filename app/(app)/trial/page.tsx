import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConveneTrial } from "@/components/ConveneTrial";
import { EmptyState } from "@/components/EmptyState";
import { Avatar } from "@/components/Avatar";
import { relativeTime } from "@/lib/dates";
import { ConsoleHeader } from "@/components/ConsoleHeader";
import type { Profile, Trial } from "@/lib/types";

export default async function TrialsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: trials }, { data: profiles }] = await Promise.all([
    supabase.from("trials").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
  ]);

  const list = (trials ?? []) as Trial[];
  const allProfiles = (profiles ?? []) as Profile[];
  const byId = new Map(allProfiles.map((p) => [p.id, p]));

  return (
    <div>
      <ConsoleHeader
        title="The Courtroom"
        tag="⚖️ Judicial"
        right={<Link href="/" className="label text-ink-soft">← Games</Link>}
      />

      {profile.is_admin && (
        <div className="mb-8">
          <ConveneTrial candidates={allProfiles.filter((p) => p.id !== profile.id)} />
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState>The court is not in session. Nobody&apos;s flaked… yet.</EmptyState>
      ) : (
        <div>
          {list.map((t) => {
            const d = byId.get(t.defendant_id);
            return (
              <Link key={t.id} href={`/trial/${t.id}`} className="flex items-center gap-3 border-b border-rule py-3">
                <Avatar name={d?.name ?? "?"} avatarUrl={d?.avatar_url} colour={d?.colour} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink">
                    <span className="font-semibold">{d?.name}</span> — {t.charge}
                  </p>
                  <p className="font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
                    {relativeTime(t.created_at)}
                  </p>
                </div>
                <span
                  className="shrink-0 font-narrow text-xs font-semibold uppercase tracking-[0.08em]"
                  style={{
                    color:
                      t.status === "open"
                        ? "var(--color-sand)"
                        : t.verdict === "guilty"
                          ? "var(--color-flag)"
                          : t.verdict == null
                            ? "var(--color-ink-soft)"
                            : "var(--color-moss)",
                  }}
                >
                  {t.status === "open"
                    ? "In session"
                    : t.verdict === "guilty"
                      ? "Guilty"
                      : t.verdict == null
                        ? "Dismissed"
                        : "Not guilty"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
