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
// Portalling to <body> puts them back on the viewport where they belong.

export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
