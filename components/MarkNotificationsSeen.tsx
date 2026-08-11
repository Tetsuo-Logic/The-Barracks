"use client";

import { useEffect, useRef } from "react";
import { markNotificationsSeen } from "@/app/actions/inbox";

// Fire-and-forget: once the notification feed is on screen, mark it read so
// those items stop counting toward the bell badge. Runs once per mount; we
// don't refresh, so the list you're looking at stays put until you navigate.
export function MarkNotificationsSeen({ when }: { when: boolean }) {
  const done = useRef(false);
  useEffect(() => {
    if (!when || done.current) return;
    done.current = true;
    markNotificationsSeen();
  }, [when]);
  return null;
}
