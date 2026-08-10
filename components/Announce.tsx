"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// A sci-fi terminal readout. Any action can call announce("MESSAGE") and a
// console panel types the message out character-by-character, then waits for OK.
type AnnounceFn = (message: string) => void;
const AnnounceContext = createContext<AnnounceFn>(() => {});

export function useAnnounce(): AnnounceFn {
  return useContext(AnnounceContext);
}

export function AnnounceProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const announce = useCallback((m: string) => setMessage(m.toUpperCase()), []);

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      {message !== null && (
        <AnnounceOverlay message={message} onClose={() => setMessage(null)} />
      )}
    </AnnounceContext.Provider>
  );
}

function AnnounceOverlay({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);

  // Type it out.
  useEffect(() => {
    setTyped("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(message.slice(0, i));
      if (i >= message.length) {
        clearInterval(id);
        setDone(true);
      }
    }, 42);
    return () => clearInterval(id);
  }, [message]);

  // Enter / Esc dismiss once it's finished typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done && (e.key === "Enter" || e.key === "Escape")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={done ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="hud w-full max-w-[420px] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="scanlines pointer-events-none absolute inset-0 opacity-30" aria-hidden />
        <div
          className="scanbeam pointer-events-none absolute inset-x-0 top-0 h-px bg-sand/60 [box-shadow:0_0_10px_1px_var(--color-sand)]"
          aria-hidden
        />
        <div className="relative">
          <p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-moss">
            <span className="pulse h-1.5 w-1.5 rounded-full bg-moss" aria-hidden />
            Barracks OS
          </p>
          <p className="min-h-[3.2em] font-mono text-[15px] uppercase leading-relaxed tracking-[0.05em] text-sand">
            <span className="text-ink-soft">{"> "}</span>
            {typed}
            <span
              className="cursor ml-0.5 inline-block h-[14px] w-[8px] translate-y-[2px] bg-sand"
              aria-hidden
            />
          </p>
          <button
            onClick={onClose}
            disabled={!done}
            className="mt-4 w-full rounded-[4px] border border-sand/60 py-2.5 font-mono text-sm font-semibold uppercase tracking-[0.16em] text-sand transition-opacity hover:[box-shadow:0_0_16px_-4px_var(--color-sand)] disabled:opacity-25"
          >
            [ OK ]
          </button>
        </div>
      </div>
    </div>
  );
}
