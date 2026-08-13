"use client";

// Tiny synthesised UI sound. No audio files — every noise here is a couple of
// oscillator cycles with a fast envelope, so it costs nothing to ship and can
// be retuned by changing a number.
//
// Two things worth knowing:
//
//  · Browsers block audio until the page has been interacted with. The boot
//    terminal runs before you've touched anything, so on a genuinely cold load
//    the first few keystrokes may be silent until the context is unlocked. We
//    resume on the first gesture rather than pretending otherwise.
//  · Muted is remembered in localStorage. Sound you can't turn off is the
//    fastest way to make flair annoying.

const MUTE_KEY = "hq-muted";

let ctx: AudioContext | null = null;
let unlocked = false;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended" && unlocked) void ctx.resume();
  return ctx;
}

/** Call once from the shell: the first real gesture unlocks audio for good. */
export function armAudio(): () => void {
  if (typeof window === "undefined") return () => {};
  const arm = () => {
    unlocked = true;
    void context()?.resume();
  };
  window.addEventListener("pointerdown", arm, { once: true });
  window.addEventListener("keydown", arm, { once: true });
  return () => {
    window.removeEventListener("pointerdown", arm);
    window.removeEventListener("keydown", arm);
  };
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(v: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MUTE_KEY, v ? "1" : "0");
}

function blip(opts: {
  freq: number;
  ms: number;
  gain: number;
  type?: OscillatorType;
  /** Slide to this frequency over the life of the note. */
  to?: number;
}) {
  if (isMuted()) return;
  const c = context();
  if (!c || c.state !== "running") return;

  const now = c.currentTime;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = opts.type ?? "square";
  osc.frequency.setValueAtTime(opts.freq, now);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, now + opts.ms / 1000);

  // Near-instant attack, quick decay — a click, not a beep.
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(opts.gain, now + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + opts.ms / 1000);

  osc.connect(amp).connect(c.destination);
  osc.start(now);
  osc.stop(now + opts.ms / 1000 + 0.02);
}

/** One keystroke. Detuned a little each time so a line doesn't sound looped. */
export function playKey() {
  blip({
    freq: 1500 + Math.random() * 420,
    ms: 16,
    gain: 0.022,
    type: "square",
  });
}

/** A line of output landing — softer and lower than a keystroke. */
export function playLine() {
  blip({ freq: 620, to: 880, ms: 45, gain: 0.02, type: "triangle" });
}

/** The lock giving. Two notes, the second a fifth up. */
export function playGranted() {
  blip({ freq: 660, ms: 90, gain: 0.05, type: "triangle" });
  window.setTimeout(() => blip({ freq: 990, to: 1320, ms: 260, gain: 0.055, type: "triangle" }), 90);
}
