import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { formatToPar } from "@/lib/scoring";
import { shortDate } from "@/lib/dates";
import type { PlayerRecord } from "@/lib/queries";

// Read-only profile: identity, record, last five rounds as thin bars, photos.
export function ProfileView({ record }: { record: PlayerRecord }) {
  const { profile, played, wins, skins, lastRounds, photos } = record;

  return (
    <div>
      <div className="flex items-center gap-4">
        <Avatar name={profile.name} avatarUrl={profile.avatar_url} colour={profile.colour} size={64} />
        <div>
          <h1 className="text-[20px] font-bold text-ink">{profile.name}</h1>
          <p className="text-ink-soft">
            {profile.nickname && (
              <span className="font-narrow uppercase tracking-[0.08em]">{profile.nickname}</span>
            )}
            {profile.home_course ? ` · ${profile.home_course}` : ""}
            {profile.handicap != null ? ` · hcp ${profile.handicap}` : ""}
          </p>
        </div>
      </div>

      {/* record */}
      <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-[3px] border border-rule">
        <Stat label="Played" value={played} />
        <Stat label="Won" value={wins} border />
        <Stat label="Skins" value={skins} border />
      </div>

      {/* last five */}
      {lastRounds.length > 0 && (
        <div className="mt-6">
          <p className="label mb-2">Last five</p>
          <div className="flex items-end gap-2">
            {lastRounds.map((r) => {
              const tp = r.toPar ?? 0;
              const height = Math.min(56, 20 + Math.abs(tp) * 4);
              const colour =
                tp < 0 ? "var(--color-moss)" : tp === 0 ? "var(--color-ink)" : "var(--color-flag)";
              return (
                <Link key={r.compId} href={`/comp/${r.compId}`} className="flex flex-1 flex-col items-center gap-1">
                  <span className="font-narrow text-[11px] font-semibold tabular-nums text-ink-soft">
                    {formatToPar(tp)}
                  </span>
                  <span className="w-full rounded-[2px]" style={{ height, backgroundColor: colour }} />
                  <span className="font-narrow text-[9px] uppercase tracking-[0.04em] text-ink-soft">
                    {shortDate(r.date)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* photos */}
      {photos.length > 0 && (
        <div className="mt-6">
          <p className="label mb-2">Photos</p>
          <div className="grid grid-cols-3 gap-1">
            {photos.map((p) => (
              <Link key={p.id} href={`/comp/${p.competition_id}`} className="aspect-square overflow-hidden rounded-[2px] bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? ""} loading="lazy" className="h-full w-full object-cover" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, border }: { label: string; value: number; border?: boolean }) {
  return (
    <div className="px-3 py-3 text-center" style={{ borderLeft: border ? "1px solid var(--color-rule)" : undefined }}>
      <div className="font-narrow text-[24px] font-bold tabular-nums text-ink">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
