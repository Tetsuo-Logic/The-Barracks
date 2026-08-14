"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestNight } from "@/app/actions/squads";
import { Portal } from "@/components/hq/Portal";
import { TypeLine } from "@/components/hq/TypeLine";
import { DatePicker } from "@/components/DatePicker";

// REQUEST A NIGHT — the member's one big action.
//
// Wired to the existing `requestNight`, which writes a squad_night_requests row
// and pushes the Captain (or the CO where a squad has no Captain yet). No new
// request architecture: this is the REQUESTED stage that Planning already
// reads, and the Captain already sees in Action Required.
//
// The schema stores a single free-text note, so the "when" answers compose into
// it rather than pretending there are columns for them. If preferred nights
// ever earn their own storage, only this file and the command change.
//
// The confirmation is the point. The old flow sent the push and closed, leaving
// you with no idea whether anything had happened or who now had it — so the
// success state names the Captain, explains what they can do next, and offers
// the way to go and look.

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type When = "any" | "nights" | "date";

export function RequestNight({
  squadId,
  squadName,
  gameName,
  captainName,
  /** Where "view request" goes — the squad's own page. */
  squadHref,
  variant = "primary",
}: {
  squadId: string;
  squadName: string;
  gameName: string;
  captainName: string | null;
  squadHref: string;
  /** `primary` is the card's main action; `inline` sits among other controls. */
  variant?: "primary" | "inline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [when, setWhen] = useState<When>("any");
  const [days, setDays] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setOpen(false);
    setSent(false);
    setWhen("any");
    setDays([]);
    setDate("");
    setNote("");
    setError(null);
  }

  /** The "when" answer and the note, as the one line the Captain will read. */
  function compose(): string {
    const parts: string[] = [];
    if (when === "nights" && days.length) parts.push(`${days.join("/")} preferred`);
    else if (when === "date" && date) parts.push(`Wants ${date}`);
    else parts.push("Any night");
    if (note.trim()) parts.push(note.trim());
    return parts.join(" — ");
  }

  const ready = when !== "date" || date !== "";

  function send() {
    setError(null);
    start(async () => {
      const res = await requestNight(squadId, compose());
      if (!res.ok) {
        setError(res.error ?? "Couldn't send the request.");
        return;
      }
      setSent(true);
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          variant === "primary"
            ? "hq-readout w-full rounded-[3px] border px-4 py-3 text-[14px] font-bold uppercase tracking-[0.08em] transition-colors"
            : "hq-label rounded-[3px] border px-3 py-2 font-semibold transition-colors"
        }
        style={{
          // Loud enough to be the thing your eye lands on, quiet enough not to
          // compete with DEPLOY OPERATION, which is a decision rather than a
          // request.
          borderColor: "var(--color-moss)",
          backgroundColor: "color-mix(in srgb, var(--color-moss) 14%, transparent)",
          color: "var(--color-moss)",
        }}
      >
        Request a night
      </button>

      {open && (
        <Portal>
          <button
            className="fixed inset-0 z-[80] cursor-default"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={reset}
            aria-label="Close"
          />
          {/* Centred by a full-screen flex wrapper rather than
              left-1/2 + -translate-x-1/2: the translate route left the panel
              adrift here, and this is the pattern the boot terminal already
              uses successfully. */}
          <div className="pointer-events-none fixed inset-0 z-[81] flex items-center justify-center px-4">
            <div
              role="dialog"
              aria-modal
              className="hq-panel pointer-events-auto w-[min(520px,94vw)]"
            >
            {!sent ? (
              <>
                <header className="hq-panel-head" style={{ minHeight: 52 }}>
                  <h2 className="min-w-0 truncate">
                    <TypeLine text={`Request a ${gameName} night`} size="21px" />
                  </h2>
                  <button onClick={reset} className="hq-label hover:text-ink" aria-label="Close">
                    ✕
                  </button>
                </header>

                <div className="flex flex-col gap-4 p-5">
                  <div>
                    <p className="hq-label mb-2" style={{ color: "var(--color-ink)" }}>
                      When would you like to play?
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          ["any", "Any night"],
                          ["nights", "Preferred nights"],
                          ["date", "Specific date"],
                        ] as [When, string][]
                      ).map(([k, label]) => {
                        const on = when === k;
                        return (
                          <button
                            key={k}
                            onClick={() => setWhen(k)}
                            className="hq-mono rounded-[3px] border px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors"
                            style={{
                              borderColor: on ? "var(--color-sand)" : "var(--color-rule)",
                              backgroundColor: on ? "rgba(245,182,61,0.1)" : "transparent",
                              color: on ? "var(--color-sand)" : "var(--color-ink-soft)",
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {when === "nights" && (
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS.map((d) => {
                        const on = days.includes(d);
                        return (
                          <button
                            key={d}
                            onClick={() =>
                              setDays((prev) =>
                                prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                              )
                            }
                            className="hq-mono rounded-[3px] border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors"
                            style={{
                              borderColor: on ? "var(--color-moss)" : "var(--color-rule)",
                              backgroundColor: on
                                ? "color-mix(in srgb, var(--color-moss) 14%, transparent)"
                                : "transparent",
                              color: on ? "var(--color-moss)" : "var(--color-ink-soft)",
                            }}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {when === "date" && (
                    <DatePicker
                      value={date}
                      onChange={setDate}
                      min={new Date().toISOString().slice(0, 10)}
                      placeholder="Pick a night"
                    />
                  )}

                  <div>
                    <label className="hq-label mb-1.5 block" style={{ color: "var(--color-ink)" }}>
                      Anything to add?
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      className="hq-mono w-full resize-none rounded-[3px] border px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:border-sand"
                      style={{ borderColor: "var(--color-rule)" }}
                    />
                  </div>

                  {error && (
                    <p className="hq-mono text-[12px]" style={{ color: "var(--color-flag)" }}>
                      {error}
                    </p>
                  )}

                  <div className="flex items-center gap-3 border-t border-rule pt-4">
                    <button
                      onClick={send}
                      disabled={pending || !ready}
                      className="hq-readout rounded-[3px] px-5 py-3 text-[14px] font-bold uppercase tracking-[0.08em] transition-opacity disabled:opacity-40"
                      style={{ backgroundColor: "var(--color-moss)", color: "#0b100e" }}
                    >
                      {pending ? "Sending…" : "Send to captain"}
                    </button>
                    <span className="hq-label opacity-70">
                      {captainName ? `Goes to ${captainName}` : "No captain — goes to Command"}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              /* ── Where it went ────────────────────────────────────────
                 Naming who has it and what happens next is the whole point:
                 the old flow closed silently and left you guessing. */
              <>
                <header className="hq-panel-head" style={{ minHeight: 52 }}>
                  <h2 className="min-w-0 truncate">
                    <TypeLine text="✓ Request sent" size="21px" />
                  </h2>
                </header>
                <div className="flex flex-col gap-3 p-5">
                  <p className="hq-readout text-[17px] font-bold uppercase tracking-[0.02em]">
                    {captainName
                      ? `Sent to ${captainName}`
                      : "Sent to Command — this squad has no Captain"}
                  </p>
                  <p className="hq-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                    {captainName ? `Captain · ${squadName}` : squadName}
                  </p>
                  <p className="text-[13px] text-ink-soft">
                    {captainName ? "Your Captain" : "Command"} can now review the request and call a
                    muster. Once the squad reports its nights, the best one goes up to Command to
                    deploy.
                  </p>
                  <p
                    className="hq-mono rounded-[3px] border px-3 py-2 text-[12px]"
                    style={{ borderColor: "var(--color-rule)" }}
                  >
                    {compose()}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-4">
                    <Link
                      href={squadHref}
                      onClick={reset}
                      className="hq-label rounded-[3px] border px-3 py-2 transition-colors hover:text-ink"
                      style={{ borderColor: "var(--color-rule)" }}
                    >
                      View request →
                    </Link>
                    <button
                      onClick={reset}
                      className="hq-label rounded-[3px] px-4 py-2 font-semibold"
                      style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              </>
            )}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
