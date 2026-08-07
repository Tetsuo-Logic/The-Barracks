// Line-art icons — 1.5px strokes, currentColor, no fills (§4.6 tab bar).
import type { SVGProps } from "react";

const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function FlagIcon(props: SVGProps<SVGSVGElement>) {
  // Fixtures — a flag on a pin.
  return (
    <svg {...base} {...props}>
      <path d="M6 21V4" />
      <path d="M6 4h11l-2.5 3L17 10H6" />
    </svg>
  );
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    </svg>
  );
}

export function TrophyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4v1a3 3 0 0 0 3 3M17 5h3v1a3 3 0 0 1-3 3M10 13.5h4M9 20h6M12 13.5V16a4 4 0 0 1-1 4" />
    </svg>
  );
}

export function PersonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function GearIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={20} height={20} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" />
    </svg>
  );
}

export function MegaphoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={20} height={20} {...props}>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l1.5 4h2l-1-4 8 3V6l-8 3H5a1 1 0 0 0-1 1Z" />
    </svg>
  );
}

export function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={22} height={22} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
