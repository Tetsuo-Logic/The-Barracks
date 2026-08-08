"use client";

import { useEffect, useRef } from "react";
import { markInboxSeen } from "@/app/actions/inbox";

// Fire-and-forget: once the inbox is on screen, stamp "seen" so new comments
// stop counting toward the bell badge. Runs once per mount, and only when
// there's fresh activity to clear. We deliberately don't refresh the page, so
// the list you're looking at stays put — the header badge catches up on your
// next navigation.
export function MarkInboxSeen({ when }: { when: boolean }) {
  const done = useRef(false);
  useEffect(() => {
    if (!when || done.current) return;
    done.current = true;
    markInboxSeen();
  }, [when]);
  return null;
}
