"use client";

import { useEffect, useState } from "react";

// Live countdown to kick-off. Renders a stable placeholder on the server so
// there's no hydration mismatch, then ticks once a second.
export function Countdown({ iso, label = "Until deployment" }: { iso: string; label?: string }) {
  const [left, setLeft] = useState<string>("--:--:--");
  const [past, setPast] = useState(false);

  useEffect(() => {
    const target = new Date(iso).getTime();
    const tick = () => {
      const ms = target - Date.now();
      setPast(ms <= 0);
      const s = Math.floor(Math.abs(ms) / 1000);
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      setLeft(
        d > 0
          ? `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`
          : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`,
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [iso]);

  return (
    <div>
      <div
        className="hq-readout text-[40px] font-bold leading-none"
        style={{ color: past ? "var(--color-moss)" : "var(--color-sand)" }}
      >
        {left}
      </div>
      <div className="hq-label mt-1.5">{past ? "Elapsed since kick-off" : label}</div>
    </div>
  );
}
