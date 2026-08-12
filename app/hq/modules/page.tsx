import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { Panel, Stat, Dot, Tag, PageHead, Proto } from "@/components/hq/Kit";
import { MODULES, type ModuleDef } from "@/lib/hq/future/systems";

export const metadata = { title: "Modules · Barracks HQ" };

// ── Modules ─────────────────────────────────────────────────────────────────
// Every Barracks runs a different shape. Modules turn parts of the platform on
// and off. The honest bit: `live` says whether a module is actually built today
// — the ones that aren't are interface only, and the screen says so plainly.
// The switches are CSS-only (no client bundle) and are not persisted.

function ModuleCard({ m, i }: { m: ModuleDef; i: number }) {
  return (
    <label
      className="hq-rise relative block cursor-pointer overflow-hidden rounded-[3px] border border-rule bg-[rgba(255,255,255,0.012)] px-4 py-3 transition-colors hover:border-ink-soft"
      style={{ ["--i" as string]: i }}
    >
      <input type="checkbox" defaultChecked={m.on} className="peer sr-only" />
      {/* Left rail lights when the module is on */}
      <span className="absolute left-0 top-0 h-full w-[2px] bg-transparent transition-colors peer-checked:bg-[var(--color-moss)]" />
      {/* Switch — track and knob are siblings of the input, so peer-* reaches them */}
      <span className="absolute right-4 top-3 h-[18px] w-[34px] rounded-full border border-[var(--color-rule)] transition-colors peer-checked:border-[var(--color-moss)] peer-checked:bg-[rgba(61,220,132,0.22)]" />
      <span className="absolute right-[36px] top-[15px] h-[12px] w-[12px] rounded-full bg-[var(--color-ink-soft)] transition-all peer-checked:right-[18px] peer-checked:bg-[var(--color-moss)]" />

      <div className="pr-12">
        <p className="hq-readout truncate text-[15px] font-bold uppercase tracking-[0.04em]">
          {m.name}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{m.blurb}</p>
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t border-rule/60 pt-2.5">
        {m.live ? (
          <Tag tone="live">Live in platform</Tag>
        ) : (
          <Tag tone="idle">Interface only</Tag>
        )}
        <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
          {m.live ? "Real data · shipping" : "Prototype · not yet built"}
        </span>
      </div>
    </label>
  );
}

export default async function ModulesPage() {
  await requireProfile();

  const live = MODULES.filter((m) => m.live);
  const proto = MODULES.filter((m) => !m.live);
  const on = MODULES.filter((m) => m.on);
  const liveOn = live.filter((m) => m.on);

  return (
    <div>
      <PageHead
        eyebrow="System"
        title="Modules"
        right={
          <>
            <span className="hq-label rounded-[3px] border border-rule px-3 py-2">
              {on.length}/{MODULES.length} enabled
            </span>
            <Proto>Switches not persisted</Proto>
          </>
        }
      >
        No two Barracks run the same way. Switch off what you don&apos;t use and the interface stops
        mentioning it. The split below is honest: some of these are shipping, some are drawings.
      </PageHead>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Panel i={0}>
          <Stat value={MODULES.length} label="Modules available" />
        </Panel>
        <Panel i={1}>
          <Stat value={live.length} label="Built today" sub={`${liveOn.length} switched on`} tone="live" />
        </Panel>
        <Panel i={2}>
          <Stat value={proto.length} label="Prototype" sub="interface only" tone="warn" />
        </Panel>
        <Panel i={3}>
          <Stat
            value={MODULES.length - on.length}
            label="Switched off"
            sub="hidden from the interface"
            tone={MODULES.length - on.length ? "idle" : undefined}
          />
        </Panel>
      </div>

      <Panel
        i={4}
        sweep
        label="Live in the platform today"
        status={<Dot tone="live" pulse />}
        right={
          <span className="hq-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--color-moss)" }}>
            Real data · real screens
          </span>
        }
        className="mb-4"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {live.map((m, i) => (
            <ModuleCard key={m.key} m={m} i={i} />
          ))}
        </div>
      </Panel>

      <Panel
        i={5}
        label="Prototype modules"
        status={<Dot tone="warn" />}
        right={
          <>
            <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
              Interface exists · backend does not
            </span>
            <Proto />
          </>
        }
        className="mb-4"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {proto.map((m, i) => (
            <ModuleCard key={m.key} m={m} i={i} />
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel i={6} label="What switching off actually does">
          <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-ink-soft">
            <li>
              <span className="text-ink">The rail loses the entry.</span> A Barracks with no Court
              never sees the word again.
            </li>
            <li>
              <span className="text-ink">Nothing is deleted.</span> Turn Archives off and the record
              stays — it just stops being shown.
            </li>
            <li>
              <span className="text-ink">Notifications follow.</span> A muted module raises no
              comms, sends no push, and posts nothing to Discord.
            </li>
            <li>
              <span className="text-ink">Prototype modules never invent data.</span> They read the
              same rows as everything else or they show you an empty board.
            </li>
          </ul>
        </Panel>

        <Panel i={7} label="Related">
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/hq/integrations", label: "Integrations" },
              { href: "/hq/settings", label: "Barracks settings" },
              { href: "/hq/link", label: "Barracks Link" },
              { href: "/hq/dispatch", label: "The Dispatch" },
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
            Module state would live on the Barracks record (app_settings), read by both the phone
            and Headquarters.
          </p>
        </Panel>
      </div>
    </div>
  );
}
