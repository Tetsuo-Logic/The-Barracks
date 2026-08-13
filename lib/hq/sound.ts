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

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  // Always try. A suspended context resumes the moment the page has had any
  // interaction, and asking early costs nothing — gating the resume behind our
  // own "unlocked" flag just meant staying silent long after we were allowed
  // to play.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call once from the shell so audio is live the instant it's permitted. */
export function armAudio(): () => void {
  if (typeof window === "undefined") return () => {};
  const arm = () => void context()?.resume();
  // Not `once`: the first gesture may arrive before the browser is willing,
  // and pointerdown fires before click, which is the earliest we can ask.
  //
  // Deliberately NOT called eagerly here. A context constructed outside a user
  // gesture is born suspended and tends to stay that way; constructing it
  // inside the first real gesture is what actually gets us a running one.
  window.addEventListener("pointerdown", arm);
  window.addEventListener("keydown", arm);
  return () => {
    window.removeEventListener("pointerdown", arm);
    window.removeEventListener("keydown", arm);
  };
}

/** True when a sound would actually be heard right now. */
export function audioReady(): boolean {
  return !isMuted() && context()?.state === "running";
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

// Levels are deliberately well above where they started. A 16ms tick at 2%
// gain is technically a sound and practically silence on laptop speakers —
// which is what "the sound doesn't work" turned out to mean. High frequencies
// also get rolled off badly by small drivers, so the key click sits lower and
// drops in pitch, the way a real key does.

/** One keystroke. Detuned a little each time so a line doesn't sound looped. */
export function playKey() {
  const f = 820 + Math.random() * 260;
  blip({ freq: f, to: f * 0.55, ms: 30, gain: 0.09, type: "square" });
}

/** A line of output landing — softer and lower than a keystroke. */
export function playLine() {
  blip({ freq: 480, to: 700, ms: 70, gain: 0.07, type: "triangle" });
}

/** The lock giving. Two notes, the second a fifth up. */
export function playGranted() {
  blip({ freq: 660, ms: 120, gain: 0.13, type: "triangle" });
  window.setTimeout(() => blip({ freq: 990, to: 1320, ms: 300, gain: 0.14, type: "triangle" }), 100);
}
