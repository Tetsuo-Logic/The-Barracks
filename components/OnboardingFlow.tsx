"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveProfile } from "@/app/actions/profile";
import { NotificationSetup } from "@/components/NotificationSetup";
import { AvatarUpload } from "@/components/AvatarUpload";

// Progress dashes (§5). Photo (step 2) is a placeholder until the photos work;
// the last screen is the notification prompt, straight after setup (§6.2).
const STEPS = ["Name", "Photo", "Setup", "Alerts"] as const;

export function OnboardingFlow({
  initialName,
  colour,
  avatarUrl,
}: {
  initialName: string;
  colour: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  const [nickname, setNickname] = useState("");
  const [platform, setPlatform] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nick = nickname.toUpperCase();

  // Save the profile, then move to the notification prompt (§6.2).
  async function saveAndContinue() {
    setSaving(true);
    setError(null);
    const res = await saveProfile({
      name,
      nickname: nick,
      home_course: platform,
    });
    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }
    setSaving(false);
    setStep(3);
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* progress dashes */}
      <div className="mb-10 flex gap-2">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className="h-0.5 flex-1"
            style={{
              backgroundColor:
                i <= step ? "var(--color-ink)" : "var(--color-rule)",
            }}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="flex flex-1 flex-col">
          <p className="label mb-2">Step one</p>
          <h1 className="mb-6 text-[32px] font-extrabold leading-tight text-ink">
            Who are you?
          </h1>

          <label className="label mb-1 block">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dave"
            className="mb-6 w-full rounded-[3px] border border-rule bg-card px-4 py-3 text-ink outline-none focus:border-ink"
          />

          <label className="label mb-1 block">Nickname — your callsign</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoCapitalize="characters"
            placeholder="MACCA"
            className="w-full rounded-[3px] border border-rule bg-card px-4 py-3 font-mono uppercase tracking-[0.14em] text-ink outline-none focus:border-ink"
          />

          {/* live preview of the callsign tag */}
          <div className="mt-8">
            <p className="label mb-2">Callsign</p>
            <div
              className="inline-flex items-center gap-2 rounded-[4px] px-4 py-2 font-mono font-semibold uppercase tracking-[0.14em] text-paper"
              style={{ backgroundColor: colour }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-paper/80" aria-hidden />
              {nick || "····"}
            </div>
          </div>

          <div className="mt-auto pt-10">
            <button
              onClick={() => setStep(1)}
              disabled={!name.trim() || !nick}
              className="w-full rounded-[3px] bg-ink px-4 py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-1 flex-col">
          <p className="label mb-2">Step two</p>
          <h1 className="mb-6 text-[32px] font-extrabold leading-tight text-ink">
            A photo
          </h1>
          <p className="mb-6 text-ink-soft">
            Take one or pick from your library — it&apos;ll show on your dossier
            and everywhere else. Or skip and add it later.
          </p>

          <AvatarUpload name={name || "You"} colour={colour} avatarUrl={avatarUrl} />

          <div className="mt-auto flex gap-3 pt-10">
            <button
              onClick={() => setStep(0)}
              className="rounded-[3px] border border-rule px-5 py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-ink-soft"
            >
              Back
            </button>
            <button
              onClick={() => setStep(2)}
              className="flex-1 rounded-[3px] bg-ink px-4 py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-paper"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-1 flex-col">
          <p className="label mb-2">Step three</p>
          <h1 className="mb-6 text-[32px] font-extrabold leading-tight text-ink">
            Your setup
          </h1>
          <p className="mb-6 text-ink-soft">Skippable.</p>

          <label className="label mb-1 block">Platform</label>
          <input
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            placeholder="PS5, Xbox, PC…"
            className="w-full rounded-[3px] border border-rule bg-card px-4 py-3 text-ink outline-none focus:border-ink"
          />

          {error && <p className="mt-4 text-sm text-flag">{error}</p>}

          <div className="mt-auto flex gap-3 pt-10">
            <button
              onClick={() => setStep(1)}
              className="rounded-[3px] border border-rule px-5 py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-ink-soft"
            >
              Back
            </button>
            <button
              onClick={saveAndContinue}
              disabled={saving}
              className="flex-1 rounded-[3px] bg-ink px-4 py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
            >
              {saving ? "Saving" : "Next"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-1 flex-col">
          <p className="label mb-2">Last thing</p>
          <h1 className="mb-4 text-[32px] font-extrabold leading-tight text-ink">
            Stay in the loop
          </h1>
          <p className="mb-6 text-ink-soft">
            Get a nudge when a game goes up, when the others chip in, and when
            results land. You choose which in settings later.
          </p>

          <NotificationSetup />

          <div className="mt-auto pt-10">
            <button
              onClick={() => router.replace("/")}
              className="w-full rounded-[3px] bg-ink px-4 py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-paper"
            >
              Into the app
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
