import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getGames } from "@/lib/data";
import { shortDate } from "@/lib/dates";
import { Panel, Stat, Dot, Tag, Row, PageHead, Proto } from "@/components/hq/Kit";
import { PERSONALITIES } from "@/lib/hq/future/systems";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Settings · Barracks HQ" };

// ── Settings ────────────────────────────────────────────────────────────────
// The Barracks' own configuration. Identity, command, discipline and the tone
// the system speaks in. Real values are read from app_settings / groups /
// profiles; writing them from Headquarters is not wired yet, so every control
// that would persist is marked.

export default async function SettingsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [
    { data: settings },
    { data: profileRows },
    { count: squadCount },
    { count: warningCount },
    { count: strikeCount },
    { count: compCount },
    { data: memberships },
    games,
  ] = await Promise.all([
    supabase
      .from("app_settings")
      .select("warnings_per_strike, activity_cleared_before")
      .eq("id", 1)
      .maybeSingle(),
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("squads").select("id", { count: "exact", head: true }),
    supabase.from("warnings").select("id", { count: "exact", head: true }),
    supabase.from("strikes").select("id", { count: "exact", head: true }),
    supabase.from("competitions").select("id", { count: "exact", head: true }),
    supabase.from("memberships").select("group_id").eq("user_id", profile.id).limit(1),
    getGames(),
  ]);

  const cfg = (settings ?? {}) as {
    warnings_per_strike?: number | null;
    activity_cleared_before?: string | null;
  };
  const perStrike = cfg.warnings_per_strike ?? 3;

  const profiles = (profileRows ?? []) as Profile[];
  const president = profiles.find((p) => p.is_president) ?? null;
  const admins = profiles.filter((p) => p.is_admin);

  // The Barracks' own record — real, if this deployment is on the group model.
  const groupId = (memberships ?? [])[0]?.group_id as string | undefined;
  let barracks: { name: string; created_at: string } | null = null;
  if (groupId) {
    const { data: g } = await supabase
      .from("groups")
      .select("name, created_at")
      .eq("id", groupId)
      .maybeSingle();
    barracks = (g as { name: string; created_at: string }) ?? null;
  }
  const barracksName = barracks?.name ?? "The Barracks";

  return (
    <div>
      <PageHead
        eyebrow="System"
        title="Settings"
        right={
          <>
            <Link
              href="/hq/modules"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              Modules →
            </Link>
            <Link
              href="/hq/integrations"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              Integrations →
            </Link>
          </>
        }
      >
        Configuration for {barracksName}
        {profile.is_admin ? " · you hold command privileges" : " · read-only for your rank"}.
      </PageHead>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Panel i={0}>
          <Stat value={profiles.length} label="Operatives" sub={`${admins.length} with command`} />
        </Panel>
        <Panel i={1}>
          <Stat value={squadCount ?? 0} label="Squads" />
        </Panel>
        <Panel i={2}>
          <Stat value={games.length} label="Games configured" />
        </Panel>
        <Panel i={3}>
          <Stat value={compCount ?? 0} label="Operations on file" />
        </Panel>
        <Panel i={4}>
          <Stat
            value={perStrike}
            label="Warnings per strike"
            sub={`${warningCount ?? 0} warnings · ${strikeCount ?? 0} strikes`}
            tone="warn"
          />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* ── Identity ───────────────────────────────────────────────── */}
          <Panel
            i={5}
            label="Barracks identity"
            status={<Dot tone="live" />}
            right={<Proto>Editing not wired</Proto>}
          >
            <div className="mb-3">
              <label className="hq-label mb-1.5 block" htmlFor="brk-name">
                Barracks name
              </label>
              <input
                id="brk-name"
                defaultValue={barracksName}
                className="hq-readout w-full rounded-[3px] border border-rule bg-[rgba(0,0,0,0.28)] px-3 py-2.5 text-[16px] font-bold uppercase tracking-[0.04em] text-ink outline-none focus:border-sand"
              />
            </div>
            <Row k="Formed" v={barracks ? shortDate(barracks.created_at.slice(0, 10)) : "Before records"} />
            <Row k="Record id" v={groupId ? `${groupId.slice(0, 8)}…` : "Single-tenant"} />
            <Row k="Interface" v="Headquarters v0.1 · experimental" tone="warn" />
            <Row k="Phone app" v="Live · same data, same auth" tone="live" />
            <p className="hq-mono mt-3 text-[10px] uppercase leading-relaxed tracking-[0.1em] text-ink-soft">
              The name is stamped on the Dispatch, the Archives and every notice the system sends.
            </p>
          </Panel>

          {/* ── Command ────────────────────────────────────────────────── */}
          <Panel
            i={6}
            label="Command"
            right={<Link href="/hq/leadership" className="hq-label hover:text-ink">Leadership →</Link>}
          >
            <Row
              k="President"
              v={president ? president.name : "Vacant"}
              tone={president ? "warn" : "alert"}
            />
            <Row k="Command privileges" v={`${admins.length} operative${admins.length === 1 ? "" : "s"}`} />
            <Row k="Your rank" v={profile.is_president ? "President" : profile.is_admin ? "Command" : "Operative"} />
            <ul className="mt-3 flex flex-col">
              {profiles.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 border-b border-rule/60 py-1.5 last:border-0"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: p.colour || "var(--color-rule)" }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {p.id === profile.id ? `${p.name} (you)` : p.name}
                  </span>
                  {p.is_president && <Tag tone="warn">President</Tag>}
                  {p.is_admin && !p.is_president && <Tag tone="live">Command</Tag>}
                </li>
              ))}
            </ul>
          </Panel>

          {/* ── Discipline ─────────────────────────────────────────────── */}
          <Panel
            i={7}
            label="Discipline"
            status={<Dot tone={(strikeCount ?? 0) > 0 ? "alert" : "idle"} />}
            right={<Link href="/hq/court" className="hq-label hover:text-ink">Court →</Link>}
          >
            <p className="hq-label mb-2">Warnings per strike</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label
                  key={n}
                  className="relative flex-1 cursor-pointer"
                  aria-label={`${n} warnings per strike`}
                >
                  <input
                    type="radio"
                    name="wps"
                    defaultChecked={n === perStrike}
                    className="peer sr-only"
                  />
                  <span className="pointer-events-none absolute inset-0 rounded-[3px] border border-rule transition-colors peer-checked:border-[var(--color-sand)] peer-checked:bg-[rgba(245,182,61,0.1)]" />
                  <span className="hq-readout relative block py-2.5 text-center text-[18px] font-bold text-ink">
                    {n}
                  </span>
                </label>
              ))}
            </div>
            <p className="hq-mono mt-2 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
              Currently {perStrike} — real value, read from app_settings. {warningCount ?? 0}{" "}
              warnings and {strikeCount ?? 0} strikes are on the record.
            </p>
            <div className="mt-3 flex items-center gap-2 border-t border-rule pt-3">
              <Tag tone="idle">Set from the phone&apos;s organiser tools</Tag>
              <Proto>Write not wired here</Proto>
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          {/* ── System personality ─────────────────────────────────────── */}
          <Panel
            i={8}
            sweep
            label="System personality"
            status={<Dot tone="warn" />}
            right={<Proto />}
          >
            <p className="mb-3 text-[13px] text-ink-soft">
              How the system speaks when it writes on your behalf — notices, the Dispatch, court
              summons, push. This changes the <span className="text-ink">wording only</span>. The
              interface, the colours and the ranks stay exactly as they are.
            </p>
            <div className="flex flex-col gap-2">
              {PERSONALITIES.map((p) => (
                <label key={p.key} className="relative block cursor-pointer">
                  <input
                    type="radio"
                    name="personality"
                    defaultChecked={p.key === "command"}
                    className="peer sr-only"
                  />
                  <span className="pointer-events-none absolute inset-0 rounded-[3px] border border-rule transition-colors peer-checked:border-[var(--color-sand)] peer-checked:bg-[rgba(245,182,61,0.07)]" />
                  <span className="pointer-events-none absolute left-3 top-3.5 h-3 w-3 rounded-full border border-rule transition-colors peer-checked:border-[var(--color-sand)] peer-checked:bg-[var(--color-sand)]" />
                  <span className="relative block py-3 pl-9 pr-3">
                    <span className="hq-readout block text-[14px] font-bold uppercase tracking-[0.04em]">
                      {p.name}
                    </span>
                    <span className="hq-mono mt-1 block text-[11.5px] leading-relaxed text-ink-soft">
                      &ldquo;{p.sample}&rdquo;
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="hq-mono mt-3 text-[10px] uppercase leading-relaxed tracking-[0.1em] text-ink-soft">
              Military command is the default. Savage is not recommended for a Barracks with thin
              skin.
            </p>
          </Panel>

          {/* ── History ────────────────────────────────────────────────── */}
          <Panel i={9} label="Record keeping">
            <Row
              k="Activity cutoff"
              v={
                cfg.activity_cleared_before
                  ? shortDate(cfg.activity_cleared_before.slice(0, 10))
                  : "None — full history shown"
              }
              tone={cfg.activity_cleared_before ? "warn" : "live"}
            />
            <Row k="Operations retained" v="Forever" tone="live" />
            <Row k="Evidence retained" v="Forever · private bucket" tone="live" />
            <Row k="Court record" v="Permanent" />
            <p className="hq-mono mt-3 text-[10px] uppercase leading-relaxed tracking-[0.1em] text-ink-soft">
              Clearing the activity feed hides old entries from the timeline. It deletes nothing —
              the Archives still hold every operation that ran.
            </p>
            <Link
              href="/hq/archives"
              className="hq-label mt-3 inline-block rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-sand hover:text-ink"
            >
              Archives →
            </Link>
          </Panel>

          {/* ── Games ──────────────────────────────────────────────────── */}
          <Panel i={10} label="Games in service" right={<Tag tone="live">Real</Tag>}>
            <ul className="flex flex-col">
              {games.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center gap-3 border-b border-rule/60 py-1.5 last:border-0"
                >
                  <span className="w-5 shrink-0 text-center">{g.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{g.name}</span>
                  {g.hasScorecard && <Tag tone="warn">Scorecard</Tag>}
                  <span className="hq-mono shrink-0 text-[10px] text-ink-soft">{g.id}</span>
                </li>
              ))}
            </ul>
          </Panel>

          {/* ── Elsewhere ──────────────────────────────────────────────── */}
          <Panel i={11} label="Elsewhere">
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/hq/modules", label: "Modules" },
                { href: "/hq/integrations", label: "Integrations" },
                { href: "/hq/link", label: "Barracks Link" },
                { href: "/settings", label: "Account · phone" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="hq-label rounded-[3px] border border-rule px-3 py-2.5 text-center transition-colors hover:border-sand hover:text-ink"
                >
                  {l.label}
                </Link>
              ))}
            </div>
            <p className="hq-mono mt-3 text-[10px] uppercase leading-relaxed tracking-[0.1em] text-ink-soft">
              Notifications, theme and sign-out live on the phone app — one account, two interfaces.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
