import type { Tone } from "@/components/hq/Kit";

// Shared so the page, the drawer and anything built later label a transmission
// the same way. 'dates' is legacy — availability polls belong to Planning now —
// but the rows are real history and still need a name.

export const KIND_LABEL: Record<string, string> = {
  announce: "Notice",
  yesno: "Yes / No",
  ask: "Question",
  poll: "Poll",
  dates: "Dates poll",
};

export const KIND_TONE: Record<string, Tone> = {
  announce: "info",
  yesno: "live",
  ask: "warn",
  poll: "warn",
  dates: "idle",
};
