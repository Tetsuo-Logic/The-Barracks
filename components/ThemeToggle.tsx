"use client";

import { useEffect, useState } from "react";

const THEMES = [
  { key: "dark", label: "Dark" },
  { key: "light", label: "Light" },
] as const;

type ThemeKey = (typeof THEMES)[number]["key"];

// Dark is the default (baked into globals). Dim/Light swap the colour tokens via
// a data-theme on <html>; the choice persists in localStorage and is applied
// before paint by an inline script in the root layout.
export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeKey>("dark");

  useEffect(() => {
    let saved: ThemeKey = "dark";
    try {
      if (localStorage.getItem("barracks-theme") === "light") saved = "light";
    } catch {}
    setTheme(saved);
  }, []);

  function apply(t: ThemeKey) {
    setTheme(t);
    const root = document.documentElement;
    if (t === "dark") root.removeAttribute("data-theme");
    else root.dataset.theme = t;
    try {
      localStorage.setItem("barracks-theme", t);
    } catch {}
    // Keep the mobile status-bar colour roughly in step.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "light" ? "#e6e0d0" : "#0b100e");
  }

  return (
    <div className="inline-flex overflow-hidden rounded-[4px] border border-rule">
      {THEMES.map((t, i) => {
        const on = theme === t.key;
        return (
          <button
            key={t.key}
            onClick={() => apply(t.key)}
            className="px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.12em] transition-colors"
            style={{
              backgroundColor: on ? "var(--color-sand)" : "transparent",
              color: on ? "var(--color-paper)" : "var(--color-ink)",
              borderLeft: i > 0 ? "1px solid var(--color-rule)" : "none",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
