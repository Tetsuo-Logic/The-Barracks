import { formatLabel } from "@/lib/dates";
import type { Competition } from "@/lib/types";

// Build a floating-time VEVENT (no timezone) so a 09:40 tee is 09:40 at the
// course, full stop (§10) — never converted through UTC.
export function buildIcs(comp: Competition): string {
  const date = comp.date.replaceAll("-", ""); // YYYYMMDD
  const time = (comp.tee_time ?? "09:00:00").slice(0, 8).replaceAll(":", ""); // HHMMSS
  const start = `${date}T${time}`;

  // rough duration: ~2h for 9, ~4h for 18
  const end = addHours(comp.date, comp.tee_time ?? "09:00:00", comp.holes === 18 ? 4 : 2);

  const title = comp.title
    ? comp.title
    : `Golf — ${comp.course} (${formatLabel(comp.format)})`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Threeball//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${comp.id}@threeball`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(title)}`,
    `LOCATION:${escapeIcs(comp.course)}`,
    comp.stake ? `DESCRIPTION:${escapeIcs(comp.stake)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.join("\r\n");
}

function addHours(date: string, time: string, hours: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh + hours, mm);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}${p(dt.getMonth() + 1)}${p(dt.getDate())}T${p(dt.getHours())}${p(dt.getMinutes())}00`;
}

function escapeIcs(s: string): string {
  return s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}
