"use client";

import { useEffect, useState } from "react";
import { armAudio, isMuted, setMuted } from "@/lib/hq/sound";

// Sound you can't turn off is the fastest way to make flair annoying, so the
// mute lives in the bar and is remembered across sessions.

export function SoundToggle() {
  const [muted, setLocal] = useState(false);

  useEffect(() => {
    setLocal(isMuted());
    // Browsers won't let audio start until the page has been interacted with;
    // arm it on the first gesture so the next thing that wants to click, can.
    return armAudio();
  }, []);

  return (
    <button
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setLocal(next);
      }}
      title={muted ? "Sound off" : "Sound on"}
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
      className="hq-label rounded-[3px] border px-2 py-1.5 transition-colors"
      style={{
        borderColor: muted ? "var(--color-rule)" : "color-mix(in srgb, var(--color-moss) 40%, transparent)",
        color: muted ? "#6d8076" : "var(--color-moss)",
      }}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
