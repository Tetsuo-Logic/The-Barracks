"use client";

import { useEffect, useState } from "react";
import { armAudio, isMuted, setMuted, playKey, audioReady } from "@/lib/hq/sound";

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
        // Click to unmute and you hear it immediately — the click itself is the
        // gesture that lets audio start, so this doubles as the proof it works.
        if (!next) window.setTimeout(playKey, 0);
      }}
      title={
        muted
          ? "Sound off — click to turn on"
          : audioReady()
            ? "Sound on"
            : "Sound on — click anywhere to start audio"
      }
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
