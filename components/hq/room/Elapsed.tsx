"use client";

import { useEffect, useState } from "react";

// Time on station. Renders a stable placeholder on the server, then ticks.
export function Elapsed({
  from,
  to,
  label = "Elapsed",
  size = 40,
}: {
  from: string;
  to?: string | null;
  label?: string;
  size?: number;
}) {
  const [text, setText] = useState("--:--:--");

  useEffect(() => {
    const startMs = new Date(from).getTime();
    const tick = () => {
      const endMs = to ? new Date(to).getTime() : Date.now();
      const s = Math.max(0, Math.floor((endMs - startMs) / 1000));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      setText(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`,
      );
    };
    tick();
    if (to) return;
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [from, to]);

  return (
    <div>
      <div
        className="hq-readout font-bold leading-none"
        style={{ fontSize: size, color: to ? "var(--color-ink)" : "var(--color-moss)" }}
      >
        {text}
      </div>
      <div className="hq-label mt-1.5">{label}</div>
    </div>
  );
}
