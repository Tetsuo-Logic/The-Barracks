"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Escape hatch for anything that must be positioned against the viewport.
//
// The top bar carries `backdrop-filter: blur()`, and a filter — backdrop or
// otherwise — makes an element the containing block for `position: fixed`
// descendants. So a fixed overlay or drawer rendered inside the bar is fixed to
// the *bar*, not the window: full-screen click-catchers only covered the 52px
// header, and a full-height drawer came out 52px tall and off the right edge.
//
// Portalling to <body> puts them back on the viewport where they belong — but
// it also takes them out of `.hq`, and every HQ token and panel rule is scoped
// to that class. So the portal carries the scope with it: `hq` for the tokens
// and descendant rules, `hq-portal` to switch off the full-screen background
// and scanline overlays that `.hq` would otherwise paint over the page.

export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted
    ? createPortal(<div className="hq hq-portal">{children}</div>, document.body)
    : null;
}
