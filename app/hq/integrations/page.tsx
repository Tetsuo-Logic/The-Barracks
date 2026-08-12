import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getSquads } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { gameById } from "@/lib/games";
import { Panel, Stat, Dot, Tag, Row, Meter, PageHead, Proto } from "@/components/hq/Kit";
import { DISCORD, discordTemplate } from "@/lib/hq/future/systems";
import { EventToggles } from "@/components/hq/integrations/EventToggles";
import { ServerTemplate } from "@/components/hq/integrations/ServerTemplate";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Integrations · Barracks HQ" };

// ── Integrations ────────────────────────────────────────────────────────────
// Discord, taken seriously: routing, role mapping, and a server template
// generated from the Barracks' REAL squads. The adapter lives in
// lib/hq/future/systems.ts — swap its body for a bot and this screen is done.

export default async function IntegrationsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [squadViews, { data: profileRows }] = await Promise.all([
    getSquads(profile.id),
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
  ]);
  const profiles = (profileRows ?? []) as Profile[];

  // The template is seeded from the squads that actually exist.
  const squads = squadViews.map((s) => ({
    name: s.squad.name || gameById(s.squad.game).name,
    game: s.squad.game,
  }));
  const categories = discordTemplate(squads);
  const channelTotal = categories.reduce((n, c) => n + c.channels.length, 0);

  const channels = [...new Set(DISCORD.events.map((e) => e.channel))];
  const routed = DISCORD.events.filter((e) => e.on).length;

  // Linked accounts — deterministic against the real roster until OAuth lands.
  const linked = profiles.map((p, i) => ({ profile: p, linked: i < DISCORD.linked }));
  const linkedCount = linked.filter((l) => l.linked).length;
  const linkPct = profiles.length ? Math.round((linkedCount / profiles.length) * 100) : 0;

  return (
    <div>
      <PageHead
        eyebrow="System"
        title="Integrations"
        right={
          <>
            <button
              type="button"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              Reconnect
            </button>
            <Proto />
          </>
        }
      >
        One Barracks, mirrored where the lads already are. Events leave the platform; nothing
        important lives outside it.
      </PageHead>

      {/* ── Connection ───────────────────────────────────────────────────── */}
      <Panel
        i={0}
        sweep
        label="Discord"
        status={<Dot tone="live" pulse />}
        right={<Tag tone="live" solid>Connected</Tag>}
        className="mb-4"
      >
        <div className="grid gap-6 xl:grid-cols-[1.2fr_2fr]">
          <div>
            <p
              className="hq-readout text-[28px] font-bold uppercase leading-none tracking-[0.04em]"
              style={{ color: "var(--color-moss)" }}
            >
              Discord // Connected
            </p>
            <p className="hq-mono mt-2 text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Guild <span className="text-ink">{DISCORD.guild}</span> · bot online · gateway v10
            </p>
            <div className="mt-4">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="hq-label">Accounts linked</span>
                <span className="hq-mono text-[12px]">
                  {linkedCount}/{profiles.length}
                </span>
              </div>
              <Meter pct={linkPct} tone={linkPct >= 70 ? "live" : "warn"} />
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <Tag tone="live">Guild scope</Tag>
              <Tag tone="live">Manage channels</Tag>
              <Tag tone="warn">Manage roles</Tag>
              <Tag tone="idle">Voice bridge · pending</Tag>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat value={DISCORD.members} label="Server members" />
            <Stat value={DISCORD.linked} label="Linked to Barracks" tone="live" />
            <Stat value={routed} label="Events routed" sub={`of ${DISCORD.events.length}`} tone="warn" />
            <Stat value={channels.length} label="Channels mapped" />
          </div>
        </div>
      </Panel>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        {/* ── Event routing ─────────────────────────────────────────────── */}
        <Panel
          i={1}
          label="Event routing"
          right={
            <>
              <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                Barracks event → channel
              </span>
              <Proto />
            </>
          }
        >
          <EventToggles events={DISCORD.events} />
        </Panel>

        <div className="flex flex-col gap-4">
          {/* ── Role mapping ───────────────────────────────────────────── */}
          <Panel i={2} label="Role mapping" right={<Proto />}>
            <ul className="flex flex-col">
              {DISCORD.roleMap.map((r) => (
                <li
                  key={r.barracks}
                  className="flex items-center gap-3 border-b border-rule/60 py-2 last:border-0"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: r.colour }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{r.barracks}</span>
                  <span className="hq-mono shrink-0 text-[11px] text-ink-soft">→</span>
                  <span
                    className="hq-mono w-28 shrink-0 truncate text-right text-[12px]"
                    style={{ color: r.colour }}
                  >
                    @{r.discord}
                  </span>
                </li>
              ))}
            </ul>
            <p className="hq-mono mt-3 text-[10px] uppercase leading-relaxed tracking-[0.1em] text-ink-soft">
              Rank in The Barracks sets rank in the server. Promote a Captain here, the role follows
              them there.
            </p>
          </Panel>

          {/* ── Channel map ────────────────────────────────────────────── */}
          <Panel i={3} label="Mapped channels">
            {channels.map((ch) => {
              const uses = DISCORD.events.filter((e) => e.channel === ch);
              return (
                <Row
                  key={ch}
                  k={ch}
                  v={`${uses.filter((u) => u.on).length}/${uses.length} events`}
                  tone={uses.some((u) => u.on) ? "live" : "idle"}
                />
              );
            })}
          </Panel>
        </div>
      </div>

      {/* ── Server template ──────────────────────────────────────────────── */}
      <Panel
        i={4}
        sweep
        label="Use Barracks template"
        status={<Dot tone="warn" pulse />}
        right={
          <>
            <Tag tone="warn">
              {categories.length} categories · {channelTotal} channels
            </Tag>
            <Proto />
          </>
        }
        className="mb-4"
      >
        <p className="mb-4 max-w-3xl text-[13px] text-ink-soft">
          Generated from your{" "}
          <span className="text-ink">
            {squads.length} real squad{squads.length === 1 ? "" : "s"}
          </span>
          {squads.length > 0 && (
            <span className="text-ink-soft"> ({squads.map((s) => s.name).join(", ")})</span>
          )}{" "}
          — a whole server laid out the way The Barracks runs. Untick anything you don&apos;t want,
          then create the lot in one go.
        </p>
        <ServerTemplate categories={categories} guild={DISCORD.guild} squadCount={squads.length} />
      </Panel>

      {/* ── Linked accounts + other integrations ─────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel i={5} label="Linked accounts" right={<Proto />}>
          <ul className="flex flex-col">
            {linked.map((l) => (
              <li
                key={l.profile.id}
                className="flex items-center gap-3 border-b border-rule/60 py-2 last:border-0"
              >
                <Dot tone={l.linked ? "live" : "idle"} />
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {l.profile.id === profile.id ? `${l.profile.name} (you)` : l.profile.name}
                </span>
                <span className="hq-mono shrink-0 text-[11px] text-ink-soft">
                  {l.linked ? `@${(l.profile.nickname || l.profile.name).toLowerCase()}` : "not linked"}
                </span>
                {l.profile.is_president && <Tag tone="warn">Command</Tag>}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel i={6} label="Other integrations">
          <ul className="flex flex-col">
            {[
              { name: "Barracks Link", detail: "Desktop companion · result detection", tone: "warn" as const, href: "/hq/link", state: "Beta" },
              { name: "Calendar feed", detail: "Subscribe to operations (.ics)", tone: "live" as const, href: "/hq/calendar", state: "Live" },
              { name: "Web push", detail: "Operation and court notifications", tone: "live" as const, href: "/hq/settings", state: "Live" },
              { name: "Twitch / stream", detail: "Watch a room you're not in", tone: "idle" as const, href: "/hq/modules", state: "Planned" },
              { name: "Steam / Xbox presence", detail: "Real presence, not a guess", tone: "idle" as const, href: "/hq/modules", state: "Planned" },
            ].map((i) => (
              <li key={i.name} className="flex items-center gap-3 border-b border-rule/60 py-2.5 last:border-0">
                <Dot tone={i.tone} />
                <Link href={i.href} className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] transition-colors hover:text-ink">
                    {i.name}
                  </span>
                  <span className="hq-mono block truncate text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                    {i.detail}
                  </span>
                </Link>
                <Tag tone={i.tone}>{i.state}</Tag>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
