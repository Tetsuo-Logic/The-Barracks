"use client";

import { useEffect, useRef, useState } from "react";

// ── The Barracks date picker ───────────────────────────────────────────────
// One calendar, used everywhere a date is chosen — HQ and the phone both.
//
// It replaces <input type="date">, which renders whatever the operating system
// feels like: a white sheet on iOS, a grey drop-down on Chrome, nothing like
// the rest of the product. This is the same month grid the Calendar board uses,
// at the size of a field.
//
// Deliberately dependency-free and theme-driven: it reads --color-sand,
// --color-moss and --color-rule, so it looks right inside HQ and inside the
// phone's light, dim and dark themes without knowing which it's in.
//
// It styles the monospace face inline rather than using .hq-mono, because that
// class lives in hq.css and phone routes never load it — the same picker has to
// look the same on both.

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const MON = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** hq-mono is HQ-only; the tokens behind it are global. */
const MONO = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;

const pad = (n: number) => String(n).padStart(2, "0");
/** Wall-clock ISO, never through UTC — a date is a date, not an instant. */
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parse(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Monday-first grid covering the whole month, padded to full weeks. */
function gridFor(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // getDay() is Sunday-first; the Barracks weeks start Monday.
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  // Drop a trailing all-next-month week rather than always showing six.
  return cells.slice(0, cells[35].getMonth() === month ? 42 : 35);
}

export function DatePicker({
  value,
  onChange,
  /** Nothing before this is selectable. Defaults to allowing any date. */
  min,
  max,
  placeholder = "Pick a date",
  className = "",
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parse(value);
  const [cursor, setCursor] = useState(() => selected ?? new Date());
  const box = useRef<HTMLDivElement>(null);

  // Reopen on the selected month rather than wherever you last browsed.
  useEffect(() => {
    if (open && selected) setCursor(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const today = iso(new Date());
  const cells = gridFor(cursor.getFullYear(), cursor.getMonth());
  const blocked = (d: string) => (min != null && d < min) || (max != null && d > max);

  const label = selected
    ? `${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][(selected.getDay() + 6) % 7]} ${selected.getDate()} ${MON[selected.getMonth()].slice(0, 3)} ${selected.getFullYear()}`
    : placeholder;

  const step = (months: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + months, 1));

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-[3px] border px-3 py-2.5 text-left text-[13px] transition-colors"
        style={{
          ...MONO,
          borderColor: open ? "var(--color-sand)" : "var(--color-rule)",
          color: selected ? "var(--color-ink)" : "var(--color-ink-soft)",
          background: "rgba(0,0,0,0.2)",
        }}
      >
        <span className="min-w-0 flex-1 truncate uppercase tracking-[0.08em]">{label}</span>
        {selected && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            onKeyDown={(e) => e.key === "Enter" && onChange("")}
            className="shrink-0 text-[11px] opacity-60 hover:opacity-100"
          >
            ✕
          </span>
        )}
        <span aria-hidden className="shrink-0 text-[11px]" style={{ color: "var(--color-sand)" }}>
          ▦
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date"
          className="absolute left-0 top-full z-50 mt-2 w-[290px] rounded-[4px] border p-3"
          style={{
            borderColor: "color-mix(in srgb, var(--color-sand) 42%, transparent)",
            background: "var(--color-paper, #0b100e)",
            boxShadow: "0 0 0 1px rgba(245,182,61,0.05), 0 24px 60px -28px rgba(0,0,0,0.95)",
          }}
        >
          {/* Month bar */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <Step onClick={() => step(-1)} label="Previous month">
              ‹
            </Step>
            <span
              className="flex-1 text-center text-[12px] font-semibold uppercase tracking-[0.16em]"
              style={{ ...MONO, color: "var(--color-sand)" }}
            >
              {MON[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <Step onClick={() => step(1)} label="Next month">
              ›
            </Step>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {DOW.map((d, i) => (
              <span
                key={i}
                className="py-1 text-center text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{ ...MONO, color: "var(--color-ink-soft)", opacity: 0.7 }}
              >
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d) => {
              const key = iso(d);
              const outside = d.getMonth() !== cursor.getMonth();
              const isToday = key === today;
              const isSel = key === value;
              const off = blocked(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={off}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className="rounded-[2px] py-1.5 text-[12px] transition-colors disabled:cursor-not-allowed"
                  style={{
                    ...MONO,
                    color: isSel
                      ? "#0b100e"
                      : off
                        ? "var(--color-rule)"
                        : outside
                          ? "var(--color-ink-soft)"
                          : "var(--color-ink)",
                    opacity: off ? 0.5 : outside ? 0.45 : 1,
                    background: isSel ? "var(--color-sand)" : "transparent",
                    fontWeight: isSel || isToday ? 700 : 400,
                    // Today is ringed rather than filled, so it never competes
                    // with the date you've actually chosen.
                    boxShadow:
                      isToday && !isSel
                        ? "inset 0 0 0 1px color-mix(in srgb, var(--color-moss) 60%, transparent)"
                        : undefined,
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--color-rule)" }}>
            <button
              type="button"
              onClick={() => {
                if (blocked(today)) return;
                onChange(today);
                setOpen(false);
              }}
              disabled={blocked(today)}
              className="rounded-[3px] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors disabled:opacity-40"
              style={{ ...MONO, color: "var(--color-moss)" }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-[3px] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ ...MONO, color: "var(--color-ink-soft)" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="h-7 w-7 shrink-0 rounded-[3px] border text-[14px] leading-none transition-colors"
      style={{ ...MONO, borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
    >
      {children}
    </button>
  );
}
