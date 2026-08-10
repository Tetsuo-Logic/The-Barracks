"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveCompetition,
  deleteCompetition,
  cancelCompetition,
  type CompetitionInput,
} from "@/app/actions/competitions";
import { todayISO } from "@/lib/dates";
import { CoursePicker } from "@/components/CoursePicker";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { gameHasScorecard, DEFAULT_GAME, type Game } from "@/lib/games";
import { useAnnounce } from "@/components/Announce";
import type { Competition, CompetitionFormat } from "@/lib/types";

const FORMATS: { value: CompetitionFormat; label: string }[] = [
  { value: "stroke", label: "Stroke" },
  { value: "skins", label: "Skins" },
  { value: "stableford", label: "Stableford" },
];

type CompKind = "cup" | "casual" | "oneoff";

export function CompSheet({
  open,
  initial,
  recentCourses,
  games,
}: {
  open: boolean;
  initial: Competition | null;
  recentCourses: string[];
  games: Game[];
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const editing = Boolean(initial);

  const [shown, setShown] = useState(false);
  const [game, setGame] = useState<string>(DEFAULT_GAME);
  const [course, setCourse] = useState("");
  const [date, setDate] = useState(todayISO());
  const [teeTime, setTeeTime] = useState("");
  const [holes, setHoles] = useState<9 | 18>(9);
  const [format, setFormat] = useState<CompetitionFormat>("skins");
  const [kind, setKind] = useState<CompKind>("cup");
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [stake, setStake] = useState("");
  const [notes, setNotes] = useState("");
  const [strokeIndex, setStrokeIndex] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const initialisedFor = useRef<string | null>(null);

  // Seed fields when the sheet opens (once per opened competition / new).
  useEffect(() => {
    if (!open) {
      setShown(false);
      initialisedFor.current = null;
      return;
    }
    const key = initial?.id ?? "new";
    if (initialisedFor.current === key) return;
    initialisedFor.current = key;

    if (initial) {
      setGame(initial.game || DEFAULT_GAME);
      setCourse(initial.course ?? "");
      setDate(initial.date);
      setTeeTime(initial.tee_time?.slice(0, 5) ?? "");
      setHoles(initial.holes);
      setFormat(initial.format);
      // A named/pictured event is a one-off; otherwise cup or casual.
      setKind(
        initial.title || initial.image_url ? "oneoff" : initial.for_cup ? "cup" : "casual",
      );
      setTitle(initial.title ?? "");
      setImageUrl(initial.image_url ?? null);
      setStake(initial.stake ?? "");
      setNotes(initial.notes ?? "");
      setStrokeIndex(initial.stroke_index ?? []);
    } else {
      setGame(games[0]?.id ?? DEFAULT_GAME);
      setCourse("");
      setDate(todayISO());
      setTeeTime("");
      setHoles(9);
      setFormat("skins");
      setKind("cup");
      setTitle("");
      setImageUrl(null);
      setStake("");
      setNotes("");
      setStrokeIndex([]);
    }
    setConfirmingCancel(false);
    setShowCancel(false);
    setCancelReason("");
    setError(null);
    // trigger slide-up next frame
    requestAnimationFrame(() => setShown(true));
  }, [open, initial]);

  // Keep the stroke-index array the right length when holes change.
  useEffect(() => {
    setStrokeIndex((s) => (s.length ? resize(s, holes, 0) : s));
  }, [holes]);

  function close() {
    setShown(false);
    setTimeout(() => router.push("/"), 200);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const isGolf = gameHasScorecard(game);
    const oneoff = kind === "oneoff";
    const input: CompetitionInput = isGolf
      ? {
          id: initial?.id,
          game,
          course,
          title: oneoff ? title : "",
          image_url: oneoff ? imageUrl : null,
          date,
          tee_time: teeTime || undefined,
          holes,
          format,
          for_cup: kind === "cup",
          stake: stake || undefined,
          notes: notes || undefined,
          stroke_index:
            format === "stableford" && strokeIndex.some((n) => n > 0)
              ? strokeIndex
              : undefined,
        }
      : {
          // Non-golf op: just a name, a night and a start time.
          id: initial?.id,
          game,
          title: title || undefined,
          date,
          tee_time: teeTime || undefined,
          holes,
          format,
        };
    const res = await saveCompetition(input);
    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }
    announce(editing ? "Game updated" : "Game deployed · squad notified");
    close();
  }

  async function doDelete() {
    if (!initial) return;
    setSaving(true);
    const res = await deleteCompetition(initial.id);
    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }
    announce("Game deleted · stood down");
    close();
  }

  async function doCancelFixture() {
    if (!initial) return;
    setSaving(true);
    const res = await cancelCompetition(initial.id, cancelReason);
    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }
    announce("Fixture cancelled · squad notified");
    close();
  }

  const isGolf = gameHasScorecard(game);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <button
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px] transition-opacity duration-200"
        style={{ opacity: shown ? 1 : 0 }}
      />
      <div
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] w-full max-w-[520px] overflow-y-auto overflow-x-hidden rounded-t-[10px] border-t border-rule bg-paper transition-transform duration-[220ms] ease-out"
        style={{ transform: shown ? "translateY(0)" : "translateY(100%)" }}
      >
        <div className="px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-4">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-rule" />
          <p className="label mb-4" style={{ color: "var(--color-sand)" }}>
            {editing ? "▸ Edit game" : "▸ New game"}
          </p>

          {/* Game — the whole form pivots on this */}
          <label className="label mb-1 block">Game</label>
          <div className="relative">
            <select
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="w-full appearance-none rounded-[3px] border border-rule bg-card px-4 py-3 text-ink outline-none focus:border-ink"
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.emoji} {g.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-soft">
              ▼
            </span>
          </div>

          {/* Course — golf only (searchable dropdown of the PGA Tour 2K25 courses) */}
          {isGolf && (
            <div className="mt-4">
              <label className="label mb-1 block">Course (optional)</label>
              <CoursePicker value={course} onChange={setCourse} recent={recentCourses} />
            </div>
          )}

          {/* Name — non-golf ops get an optional label (defaults to the game name) */}
          {!isGolf && (
            <div className="mt-4">
              <label className="label mb-1 block">Name (optional)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="General play, tournament, grand final…"
                className="w-full rounded-[3px] border border-rule bg-card px-4 py-3 text-ink outline-none focus:border-ink"
              />
            </div>
          )}

          {/* Date and tee stacked, each full width — native date/time inputs
              are unreliable side-by-side on mobile, so we don't risk it. */}
          <div className="mt-4">
            <label className="label mb-1 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block w-full max-w-full rounded-[3px] border border-rule bg-card px-3 py-3 text-ink outline-none focus:border-ink"
            />
          </div>
          <div className="mt-4">
            <label className="label mb-1 block">{isGolf ? "Tee time" : "Start time"}</label>
            <input
              type="time"
              value={teeTime}
              onChange={(e) => setTeeTime(e.target.value)}
              className="block w-full max-w-full rounded-[3px] border border-rule bg-card px-3 py-3 text-ink outline-none focus:border-ink"
            />
          </div>

          {/* ── Golf-only kit — holes, format, cup, pars, stroke index ── */}
          {isGolf && (
            <>
              {/* Holes */}
              <div className="mt-4">
                <label className="label mb-1 block">Holes</label>
                <Segmented
                  options={[
                    { value: 9, label: "9" },
                    { value: 18, label: "18" },
                  ]}
                  value={holes}
                  onChange={(v) => setHoles(v)}
                />
              </div>

              {/* Format */}
              <div className="mt-4">
                <label className="label mb-1 block">Format</label>
                <Segmented
                  options={FORMATS}
                  value={format}
                  onChange={(v) => setFormat(v)}
                />
              </div>

              {/* Type — cup, casual, or a named one-off (testimonial, random cup) */}
              <div className="mt-4">
                <label className="label mb-1 block">Type</label>
                <Segmented
                  options={[
                    { value: "cup", label: "Threeball" },
                    { value: "casual", label: "Casual" },
                    { value: "oneoff", label: "One-off" },
                  ]}
                  value={kind}
                  onChange={(v) => setKind(v)}
                />
              </div>

              {/* One-off events get a name and an optional picture */}
              {kind === "oneoff" && (
                <>
                  <div className="mt-4">
                    <label className="label mb-1 block">Event name</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Grand final, charity night…"
                      className="w-full rounded-[3px] border border-rule bg-card px-4 py-3 text-ink outline-none focus:border-ink"
                    />
                  </div>
                  <div className="mt-4">
                    <label className="label mb-1 block">Picture</label>
                    <CompImagePicker value={imageUrl} onChange={setImageUrl} />
                  </div>
                </>
              )}

              {/* Stake */}
              <div className="mt-4">
                <label className="label mb-1 block">Stake (optional)</label>
                <input
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  placeholder="£5 a game, loser buys the drinks"
                  className="w-full rounded-[3px] border border-rule bg-card px-4 py-3 text-ink outline-none focus:border-ink"
                />
              </div>

              {/* Notes */}
              <div className="mt-4">
                <label className="label mb-1 block">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-[3px] border border-rule bg-card px-4 py-3 text-ink outline-none focus:border-ink"
                />
              </div>

              {/* Stroke index — only for stableford (§9) */}
              {format === "stableford" && (
                <div className="mt-4">
                  <p className="label mb-1">
                    Stroke index — needed for stableford
                  </p>
                  <NumberGrid
                    values={
                      strokeIndex.length === holes
                        ? strokeIndex
                        : Array(holes).fill(0)
                    }
                    onChange={setStrokeIndex}
                    min={0}
                    max={18}
                  />
                </div>
              )}
            </>
          )}

          {error && <p className="mt-4 text-sm text-flag">{error}</p>}

          {/* Primary action */}
          <button
            onClick={submit}
            disabled={saving}
            className="mt-6 w-full rounded-[4px] bg-sand px-4 py-3.5 font-mono text-sm font-bold uppercase tracking-[0.12em] text-paper transition-shadow hover:[box-shadow:0_0_20px_-4px_var(--color-sand)] disabled:opacity-50"
          >
            {saving ? "Deploying…" : editing ? "Save changes" : "Deploy request"}
          </button>

          {/* Cancel or delete (edit only) */}
          {editing && (
            <div className="mt-6 space-y-5 border-t border-rule pt-5">
              {/* Cancel the fixture — keeps it, notifies everyone with a reason */}
              {!showCancel ? (
                <button
                  onClick={() => setShowCancel(true)}
                  className="text-sm font-medium text-flag"
                >
                  Cancel fixture
                </button>
              ) : (
                <div>
                  <p className="mb-2 text-sm text-ink">
                    Call it off? Everyone gets told, with your reason.
                  </p>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={2}
                    placeholder="Why it's off — servers down, someone's out…"
                    className="mb-2 w-full resize-none rounded-[3px] border border-rule bg-card px-3 py-2.5 text-ink outline-none focus:border-ink"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCancel(false)}
                      className="rounded-[3px] border border-rule px-4 py-2 text-sm text-ink-soft"
                    >
                      Keep it
                    </button>
                    <button
                      onClick={doCancelFixture}
                      disabled={saving}
                      className="rounded-[3px] bg-flag px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
                    >
                      Cancel &amp; notify
                    </button>
                  </div>
                </div>
              )}

              {/* Delete entirely — removes the row and everything on it */}
              {!confirmingCancel ? (
                <button
                  onClick={() => setConfirmingCancel(true)}
                  className="text-xs text-ink-soft hover:text-flag"
                >
                  Or delete it entirely
                </button>
              ) : (
                <div>
                  <p className="mb-2 text-sm text-ink">
                    Delete it for everyone? This can&apos;t be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmingCancel(false)}
                      className="rounded-[3px] border border-rule px-4 py-2 text-sm text-ink-soft"
                    >
                      Keep it
                    </button>
                    <button
                      onClick={doDelete}
                      disabled={saving}
                      className="rounded-[3px] bg-flag px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
                    >
                      Delete game
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── small helpers ───────────────────────────────────────────────────────────

// Pick a photo from the library (or camera), compress it, upload to the public
// avatars bucket under comps/, and hand back the public URL. Same idea as the
// profile AvatarUpload, shaped for a wide event banner.
function CompImagePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no user");

      const { blob } = await compressImage(file);
      const path = `comps/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      onChange(pub.publicUrl);
    } catch {
      setError("Couldn't upload that. Try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="Event"
          className="mb-2 h-32 w-full rounded-[3px] border border-rule object-cover"
        />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        className="hidden"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-[3px] border border-rule px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink disabled:opacity-60"
        >
          {busy ? "Uploading" : value ? "Change picture" : "Choose a picture"}
        </button>
        {value && !busy && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-sm text-flag"
          >
            Remove
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-flag">{error}</p>}
    </div>
  );
}

function resize<T extends number>(arr: T[], len: number, fill: T): T[] {
  if (arr.length === len) return arr;
  if (arr.length > len) return arr.slice(0, len);
  return [...arr, ...Array<T>(len - arr.length).fill(fill)];
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-[3px] border border-rule">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            className="px-4 py-2.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] transition-colors"
            style={{
              backgroundColor: active ? "var(--color-ink)" : "transparent",
              color: active ? "var(--color-paper)" : "var(--color-ink)",
              borderLeft: i > 0 ? "1px solid var(--color-rule)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function NumberGrid({
  values,
  onChange,
  min,
  max,
}: {
  values: number[];
  onChange: (v: number[]) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="mt-2 grid grid-cols-9 gap-1">
      {values.map((v, i) => (
        <div key={i} className="text-center">
          <div className="font-narrow text-[10px] text-ink-soft">{i + 1}</div>
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={v || ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              const nextArr = [...values];
              nextArr[i] = Number.isNaN(n) ? 0 : n;
              onChange(nextArr);
            }}
            className="w-full rounded-[2px] border border-rule bg-card px-0 py-1.5 text-center text-ink outline-none focus:border-ink"
          />
        </div>
      ))}
    </div>
  );
}
