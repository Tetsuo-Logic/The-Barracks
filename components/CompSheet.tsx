"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveCompetition,
  cancelCompetition,
  type CompetitionInput,
} from "@/app/actions/competitions";
import { todayISO } from "@/lib/dates";
import { CoursePicker } from "@/components/CoursePicker";
import type { Competition, CompetitionFormat } from "@/lib/types";

const FORMATS: { value: CompetitionFormat; label: string }[] = [
  { value: "stroke", label: "Stroke" },
  { value: "skins", label: "Skins" },
  { value: "stableford", label: "Stableford" },
];

export function CompSheet({
  open,
  initial,
  recentCourses,
}: {
  open: boolean;
  initial: Competition | null;
  recentCourses: string[];
}) {
  const router = useRouter();
  const editing = Boolean(initial);

  const [shown, setShown] = useState(false);
  const [course, setCourse] = useState("");
  const [date, setDate] = useState(todayISO());
  const [teeTime, setTeeTime] = useState("");
  const [holes, setHoles] = useState<9 | 18>(9);
  const [format, setFormat] = useState<CompetitionFormat>("skins");
  const [forCup, setForCup] = useState(true);
  const [stake, setStake] = useState("");
  const [notes, setNotes] = useState("");
  const [par, setPar] = useState<number[]>(Array(9).fill(4));
  const [showPars, setShowPars] = useState(false);
  const [strokeIndex, setStrokeIndex] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
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
      setCourse(initial.course);
      setDate(initial.date);
      setTeeTime(initial.tee_time?.slice(0, 5) ?? "");
      setHoles(initial.holes);
      setFormat(initial.format);
      setForCup(initial.for_cup);
      setStake(initial.stake ?? "");
      setNotes(initial.notes ?? "");
      setPar(initial.par ?? Array(initial.holes).fill(4));
      setStrokeIndex(initial.stroke_index ?? []);
    } else {
      setCourse("");
      setDate(todayISO());
      setTeeTime("");
      setHoles(9);
      setFormat("skins");
      setForCup(true);
      setStake("");
      setNotes("");
      setPar(Array(9).fill(4));
      setStrokeIndex([]);
    }
    setShowPars(false);
    setConfirmingCancel(false);
    setError(null);
    // trigger slide-up next frame
    requestAnimationFrame(() => setShown(true));
  }, [open, initial]);

  // Keep par/stroke-index arrays the right length when holes change.
  useEffect(() => {
    setPar((p) => resize(p, holes, 4));
    setStrokeIndex((s) => (s.length ? resize(s, holes, 0) : s));
  }, [holes]);

  function close() {
    setShown(false);
    setTimeout(() => router.push("/"), 200);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const input: CompetitionInput = {
      id: initial?.id,
      course,
      date,
      tee_time: teeTime || undefined,
      holes,
      format,
      for_cup: forCup,
      stake: stake || undefined,
      notes: notes || undefined,
      par: showPars ? par : undefined,
      stroke_index:
        format === "stableford" && strokeIndex.some((n) => n > 0)
          ? strokeIndex
          : undefined,
    };
    const res = await saveCompetition(input);
    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }
    close();
  }

  async function doCancel() {
    if (!initial) return;
    setSaving(true);
    const res = await cancelCompetition(initial.id);
    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }
    close();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <button
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-ink/25 transition-opacity duration-200"
        style={{ opacity: shown ? 1 : 0 }}
      />
      <div
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] w-full max-w-[520px] overflow-y-auto overflow-x-hidden rounded-t-[10px] border-t border-rule bg-paper transition-transform duration-[220ms] ease-out"
        style={{ transform: shown ? "translateY(0)" : "translateY(100%)" }}
      >
        <div className="px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-4">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-rule" />
          <p className="label mb-4">
            {editing ? "Edit the date" : "New date"}
          </p>

          {/* Course — searchable dropdown of the PGA Tour 2K25 courses */}
          <label className="label mb-1 block">Course</label>
          <CoursePicker value={course} onChange={setCourse} recent={recentCourses} />

          {/* Date + tee time — min-w-0 lets native inputs shrink instead of
              overflowing the sheet (§10-style mobile fix) */}
          <div className="mt-4 flex gap-3">
            <div className="min-w-0 flex-1">
              <label className="label mb-1 block">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-w-0 rounded-[3px] border border-rule bg-card px-3 py-3 text-ink outline-none focus:border-ink"
              />
            </div>
            <div className="min-w-0 flex-1">
              <label className="label mb-1 block">Tee</label>
              <input
                type="time"
                value={teeTime}
                onChange={(e) => setTeeTime(e.target.value)}
                className="w-full min-w-0 rounded-[3px] border border-rule bg-card px-3 py-3 text-ink outline-none focus:border-ink"
              />
            </div>
          </div>

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

          {/* Cup or casual */}
          <div className="mt-4">
            <label className="label mb-1 block">Counts for</label>
            <Segmented
              options={[
                { value: "cup", label: "Threeball Cup" },
                { value: "casual", label: "Casual" },
              ]}
              value={forCup ? "cup" : "casual"}
              onChange={(v) => setForCup(v === "cup")}
            />
          </div>

          {/* Stake */}
          <div className="mt-4">
            <label className="label mb-1 block">Stake</label>
            <input
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder="£5 a skin, loser buys lunch"
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

          {/* Pars — collapsed, defaults to all 4s (§5) */}
          <div className="mt-4">
            <button
              onClick={() => setShowPars((s) => !s)}
              className="label flex items-center gap-1"
            >
              {showPars ? "Hide pars" : "Set the pars"}
              <span className="text-ink-soft">{showPars ? "▲" : "▼"}</span>
            </button>
            {showPars && (
              <NumberGrid values={par} onChange={setPar} min={2} max={7} />
            )}
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

          {error && <p className="mt-4 text-sm text-flag">{error}</p>}

          {/* Primary action */}
          <button
            onClick={submit}
            disabled={saving || !course.trim()}
            className="mt-6 w-full rounded-[3px] bg-ink px-4 py-3.5 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
          >
            {saving ? "Saving" : editing ? "Save changes" : "Add the date"}
          </button>

          {/* Cancel the competition (edit only) */}
          {editing && (
            <div className="mt-6 border-t border-rule pt-5">
              {!confirmingCancel ? (
                <button
                  onClick={() => setConfirmingCancel(true)}
                  className="text-sm font-medium text-flag"
                >
                  Cancel this date
                </button>
              ) : (
                <div>
                  <p className="mb-2 text-sm text-ink">
                    Cancel it for everyone? This can&apos;t be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmingCancel(false)}
                      className="rounded-[3px] border border-rule px-4 py-2 text-sm text-ink-soft"
                    >
                      Keep it
                    </button>
                    <button
                      onClick={doCancel}
                      disabled={saving}
                      className="rounded-[3px] bg-flag px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
                    >
                      Cancel the date
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
