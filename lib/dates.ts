// Date helpers. Competitions store a bare 'YYYY-MM-DD' date and a bare 'HH:MM'
// time — never a timestamptz (§10). We treat both as wall-clock at the course
// and never convert through UTC.

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/** Parse 'YYYY-MM-DD' into a local Date at midnight (no tz shift). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Today's local date as 'YYYY-MM-DD'. */
export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isToday(iso: string): boolean {
  return iso === todayISO();
}

export function isPast(iso: string): boolean {
  return iso < todayISO();
}

/** The three parts of the hero date stack: SAT / 12 / SEP. */
export function heroDate(iso: string): { dow: string; day: string; mon: string } {
  const d = parseDate(iso);
  return {
    dow: DOW[d.getDay()],
    day: String(d.getDate()),
    mon: MON[d.getMonth()],
  };
}

/** Compact list date: "26 SEP". */
export function shortDate(iso: string): string {
  const d = parseDate(iso);
  return `${d.getDate()} ${MON[d.getMonth()]}`;
}

/** 'HH:MM:SS' or 'HH:MM' → 'HH:MM'. Empty for null. */
export function shortTime(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

/** Human relative time for comments etc: "3m", "2h", "yesterday". */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.floor((Date.now() - then) / 1000);
  if (secs < 60) return "now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d`;
  return shortDate(iso.slice(0, 10));
}

const FORMAT_LABEL: Record<string, string> = {
  stroke: "STROKE",
  skins: "SKINS",
  stableford: "STABLEFORD",
};

export function formatLabel(format: string): string {
  return FORMAT_LABEL[format] ?? format.toUpperCase();
}

/** Dot colours per format, for the calendar and list ticks. */
export const FORMAT_COLOUR: Record<string, string> = {
  stroke: "#2F6B4C", // moss
  skins: "#B4372A", // flag
  stableford: "#C9A227", // sand
};
