import { Panel, Dot, Tag, Row, Proto } from "@/components/hq/Kit";
import { LINK, ADAPTERS } from "@/lib/hq/future/systems";

// Diagnostics for however this room is capturing evidence. The mode itself is
// chosen in the console next to the games table — this panel answers "is the
// thing that's supposed to be watching actually watching?".
export function CaptureSources({ i = 0, game }: { i?: number; game: string }) {
  const online = LINK.online;

  return (
    <Panel
      i={i}
      label="Capture sources"
      status={<Dot tone={online ? "live" : "alert"} pulse={online} />}
      right={<Proto />}
    >
      <Row k="Barracks Link" v={online ? `Online · ${LINK.version}` : "Offline"} tone={online ? "live" : "alert"} />
      <Row k="Host" v={LINK.host} />
      <Row k="OBS websocket" v={LINK.obs ? "Connected" : "Not detected"} tone={LINK.obs ? "live" : "idle"} />
      <Row k="Process match" v={LINK.detected} tone="warn" />
      <Row k="Battle linked" v={LINK.battleLinked ? "Yes · this room" : "No"} tone={LINK.battleLinked ? "live" : "idle"} />

      <p className="hq-label mt-3 mb-1.5">Adapters</p>
      <ul className="flex flex-col gap-1">
        {ADAPTERS.map((a) => {
          const active = a.game.toLowerCase().includes(game.toLowerCase());
          return (
            <li key={a.game} className="flex items-center gap-2 py-0.5">
              <Dot tone={active ? "live" : "idle"} />
              <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: active ? "var(--color-ink)" : undefined }}>
                {a.game}
                <span className="hq-mono ml-1.5 text-[10px] text-ink-soft">{a.detect}</span>
              </span>
              <Tag tone={a.state === "Supported" ? "live" : a.state === "Beta" ? "warn" : "info"}>{a.state}</Tag>
            </li>
          );
        })}
      </ul>

      <p className="hq-label mt-3 mb-1.5">Link log</p>
      <ul className="max-h-[132px] overflow-y-auto">
        {LINK.log.map((l, idx) => (
          <li key={`${l.t}-${idx}`} className="flex items-center gap-2 py-[3px]">
            <Dot tone={l.tone} />
            <span className="hq-mono min-w-0 flex-1 truncate text-[10px] tracking-[0.06em]">{l.m}</span>
            <span className="hq-mono shrink-0 text-[9px] text-ink-soft">{l.t}</span>
          </li>
        ))}
      </ul>

      <p className="hq-mono mt-3 border-t border-rule/60 pt-2 text-[10px] uppercase leading-[1.6] tracking-[0.08em] text-ink-soft">
        Capture is a convenience. If nothing is connected, Captains type the result in by hand
        and the battle proceeds exactly the same.
      </p>
    </Panel>
  );
}
