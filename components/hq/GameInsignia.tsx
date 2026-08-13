// ── Game insignia ──────────────────────────────────────────────────────────
// A unit-patch series, not an icon set: every game shares the same notched
// octagonal frame and only the device inside changes, so a squad's mark reads
// as issued kit rather than clip-art. Single stroke, currentColor, no fills —
// it has to sit quietly next to the operation name without competing with it.

type Device = "shooter" | "football" | "racing" | "golf" | "generic";

function deviceFor(game: string): Device {
  const g = game.toLowerCase();
  if (/(cod|call|warzone|battlefield|shoot|halo|counter|valorant)/.test(g)) return "shooter";
  if (/(fifa|fc|football|soccer|pes)/.test(g)) return "football";
  if (/(f1|forza|gt|gran|race|racing|dirt|moto)/.test(g)) return "racing";
  if (/(golf|threeball|pga)/.test(g)) return "golf";
  return "generic";
}

export function GameInsignia({
  game,
  size = 46,
  tone = "var(--color-sand)",
}: {
  game: string;
  size?: number;
  tone?: string;
}) {
  const device = deviceFor(game);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label={`${game} insignia`}
      style={{ color: tone, flex: "none" }}
    >
      {/* Shared frame — the thing that makes them a series */}
      <path
        d="M15 3.5H33L44.5 15V33L33 44.5H15L3.5 33V15L15 3.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.45"
      />
      {/* Corner ticks, echoing the panel brackets */}
      <path
        d="M15 3.5H20M28 44.5H33M3.5 20V15L8 10.5M44.5 28V33L40 37.5"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.8"
        strokeLinecap="square"
      />

      {device === "shooter" && (
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
          <circle cx="24" cy="24" r="7.5" opacity="0.9" />
          <path d="M24 12.5V17M24 31V35.5M12.5 24H17M31 24H35.5" />
          <circle cx="24" cy="24" r="1.6" fill="currentColor" stroke="none" />
        </g>
      )}

      {device === "football" && (
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
          <circle cx="24" cy="24" r="8" opacity="0.9" />
          <path d="M24 16v16M16.4 21.5h15.2M16.4 26.5h15.2" opacity="0.75" />
        </g>
      )}

      {device === "racing" && (
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
          <path d="M16 17.5L23 24l-7 6.5" />
          <path d="M24 17.5L31 24l-7 6.5" opacity="0.6" />
          <path d="M12 24h2.5" opacity="0.5" />
        </g>
      )}

      {device === "golf" && (
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
          <path d="M20 33V15l10 4.5-10 4.5" />
          <path d="M15.5 33h17" opacity="0.6" />
        </g>
      )}

      {device === "generic" && (
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
          <path d="M24 15.5L32.5 24 24 32.5 15.5 24 24 15.5Z" opacity="0.9" />
          <circle cx="24" cy="24" r="1.6" fill="currentColor" stroke="none" />
        </g>
      )}
    </svg>
  );
}
