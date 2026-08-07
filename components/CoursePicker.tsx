"use client";

import { useMemo, useState } from "react";
import { COURSES } from "@/lib/courses";

// A searchable course dropdown, seeded with the PGA Tour 2K25 courses plus any
// courses already used. Typing something not in the list lets you add it.
export function CoursePicker({
  value,
  onChange,
  recent = [],
}: {
  value: string;
  onChange: (v: string) => void;
  recent?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const all = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const c of [...recent, ...COURSES]) {
      const key = c.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push(c);
      }
    }
    return list;
  }, [recent]);

  const filtered = query.trim()
    ? all.filter((c) => c.toLowerCase().includes(query.trim().toLowerCase()))
    : all;

  const showCustom =
    query.trim() !== "" &&
    !all.some((c) => c.toLowerCase() === query.trim().toLowerCase());

  function pick(c: string) {
    onChange(c);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-[3px] border border-rule bg-card px-4 py-3 text-left outline-none focus:border-ink"
      >
        <span className={value ? "text-ink" : "text-ink-soft/60"}>
          {value || "Choose a course"}
        </span>
        <span className="text-ink-soft">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-[3px] border border-ink bg-paper shadow-[var(--shadow-card)]">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses"
            className="w-full border-b border-rule bg-card px-4 py-2.5 text-ink outline-none"
          />
          <ul className="max-h-60 overflow-y-auto">
            {showCustom && (
              <li>
                <button
                  type="button"
                  onClick={() => pick(query.trim())}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-ink"
                >
                  <span className="label text-ink-soft">Add</span>
                  <span>“{query.trim()}”</span>
                </button>
              </li>
            )}
            {filtered.map((c) => {
              const active = c.toLowerCase() === value.toLowerCase();
              return (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left"
                    style={{ backgroundColor: active ? "rgba(22,36,27,0.05)" : undefined }}
                  >
                    <span className="text-ink">{c}</span>
                    {active && <span className="text-moss">✓</span>}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && !showCustom && (
              <li className="px-4 py-3 text-sm text-ink-soft">No courses match.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
