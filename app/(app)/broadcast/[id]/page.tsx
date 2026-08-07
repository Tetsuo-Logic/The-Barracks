import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BroadcastRespond } from "@/components/BroadcastRespond";
import { Avatar } from "@/components/Avatar";
import type { Broadcast, BroadcastResponse, Profile } from "@/lib/types";

export default async function BroadcastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: broadcast } = await supabase
    .from("broadcasts")
    .select("*")
    .eq("id", id)
    .single();
  if (!broadcast) notFound();
  const b = broadcast as Broadcast;

  const [{ data: responses }, { data: profiles }] = await Promise.all([
    supabase.from("broadcast_responses").select("*").eq("broadcast_id", id),
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
  ]);
  const rs = (responses ?? []) as BroadcastResponse[];
  const allProfiles = (profiles ?? []) as Profile[];
  const byPlayer = new Map(rs.map((r) => [r.player_id, r]));
  const mine = byPlayer.get(profile.id) ?? null;

  return (
    <div>
      <Link href="/broadcast" className="label mb-4 inline-block text-ink-soft">
        ← Messages
      </Link>

      {b.title && <h1 className="text-[20px] font-bold text-ink">{b.title}</h1>}
      <p className="mt-1 text-[16px] text-ink">{b.body}</p>

      <div className="mt-5">
        <BroadcastRespond broadcast={b} mine={mine} />
      </div>

      {/* everyone can see who said what — it's a group of three */}
      <div className="mt-6">
        <p className="label mb-2">Answers</p>
        <ul className="flex flex-col gap-3">
          {allProfiles.map((p) => {
            const r = byPlayer.get(p.id);
            return (
              <li key={p.id} className="flex items-start gap-2">
                <Avatar name={p.name} avatarUrl={p.avatar_url} colour={p.colour} size={26} />
                <div className="flex-1">
                  <p className="flex items-center gap-2">
                    <span className="text-ink">{p.id === profile.id ? "You" : p.name}</span>
                    {r?.answer && (
                      <span
                        className="font-narrow text-xs font-semibold uppercase tracking-[0.08em]"
                        style={{ color: r.answer === "yes" ? "var(--color-moss)" : "var(--color-flag)" }}
                      >
                        {r.answer}
                      </span>
                    )}
                    {!r && (
                      <span className="font-narrow text-xs font-semibold uppercase tracking-[0.08em] text-rule">
                        —
                      </span>
                    )}
                  </p>
                  {r?.comment && <p className="text-ink-soft">“{r.comment}”</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
