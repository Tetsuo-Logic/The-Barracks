"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

// A URL-backed filter dropdown. Chips are fine for three squads and useless for
// twenty, so anything open-ended goes here instead. Still drives the same query
// params as the chip links, so a filtered view stays server-rendered and
// linkable — the only client behaviour is navigating on change.

export type SelectOption = { value: string; label: string };

export function FilterSelect({
  param,
  options,
  value,
  allLabel = "All",
  width = 168,
}: {
  param: string;
  options: SelectOption[];
  value: string;
  allLabel?: string;
  width?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = value !== "all";

  function pick(next: string) {
    const q = new URLSearchParams(params.toString());
    if (next === "all") q.delete(param);
    else q.set(param, next);
    // A filter change invalidates paging.
    q.delete("all");
    const s = q.toString();
    router.push(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  return (
    <div className="relative" style={{ width }}>
      <select
        value={value}
        onChange={(e) => pick(e.target.value)}
        aria-label={param}
        className="hq-mono w-full cursor-pointer appearance-none rounded-[3px] border px-2.5 py-1 pr-7 text-[10px] font-semibold uppercase tracking-[0.12em] outline-none transition-colors"
        style={{
          borderColor: active ? "var(--color-sand)" : "var(--color-rule)",
          backgroundColor: active
            ? "color-mix(in srgb, var(--color-sand) 14%, transparent)"
            : "transparent",
          color: active ? "var(--color-sand)" : "var(--color-ink-soft)",
        }}
      >
        <option value="all">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px]"
        style={{ color: active ? "var(--color-sand)" : "var(--color-ink-soft)" }}
      >
        ▾
      </span>
    </div>
  );
}
