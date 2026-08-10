"use client";

import { useRouter } from "next/navigation";

// Enter "preview as player" — sets the cookie and drops you on the home screen
// seeing exactly what a normal player sees.
export function PreviewToggle() {
  const router = useRouter();
  function enter() {
    document.cookie = "preview-player=1; path=/; max-age=86400; samesite=lax";
    router.push("/");
    router.refresh();
  }
  return (
    <button
      onClick={enter}
      className="rounded-[4px] border border-rule px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:border-sand hover:text-sand"
    >
      👁 Preview as player
    </button>
  );
}

// The sticky banner shown while previewing, with a way back out.
export function PreviewBanner() {
  const router = useRouter();
  function exit() {
    document.cookie = "preview-player=; path=/; max-age=0; samesite=lax";
    router.refresh();
  }
  return (
    <div className="sticky top-0 z-30 mx-auto flex w-full max-w-[520px] items-center justify-between gap-3 bg-sand px-4 py-2 text-paper">
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
        👁 Previewing as player
      </span>
      <button
        onClick={exit}
        className="rounded-[3px] border border-paper/50 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em]"
      >
        Exit
      </button>
    </div>
  );
}
