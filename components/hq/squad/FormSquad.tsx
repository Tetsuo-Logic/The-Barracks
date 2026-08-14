"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formSquad } from "@/app/actions/squads";
import { Portal } from "@/components/hq/Portal";
import { TypeLine } from "@/components/hq/TypeLine";
import type { GameOption, PersonOption } from "./RequestSquad";

// FORM SQUAD — the President's version of Request a Squad.
//
// It used to send you off to the phone's squad page to fill in an inline form.
// Same dialog as every other request now: opened in place, same width, same
// typed green header. Forming a squad shouldn't feel like a different product
// from asking for one.
//
// Behind it, `formSquad` writes the request and approves it in one go, which is
// what lets the President seat a Captain — see the command for why that route.

export function FormSquad({
  games,
  people,
  meId,
}: {
  games: GameOption[];
  people: PersonOption[];
  meId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [game, setGame] = useState(games[0]?.id ?? "");
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [captain, setCaptain] = useState(meId);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setOpen(false);
    setDone(false);
    setName("");
    setTag("");
    setCaptain(meId);
    setError(null);
  }

  const captainName = people.find((p) => p.id === captain)?.name ?? "—";
  const ready = game !== "" && name.trim() !== "";

  function send() {
    setError(null);
    start(async () => {
      const res = await formSquad({
        game,
        name: name.trim(),
        clanTag: tag.trim() || undefined,
        captainId: captain || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Couldn't form the squad.");
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  const field =
    "hq-mono w-full rounded-[3px] border px-3 py-2.5 text-[13px] outline-none transition-colors focus:border-sand";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hq-label rounded-[3px] px-3 py-2 font-semibold"
        style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
      >
        + Form squad
      </button>

      {open && (
        <Portal>
          <button
            className="fixed inset-0 z-[80] cursor-default"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={reset}
            aria-label="Close"
          />
          <div className="pointer-events-none fixed inset-0 z-[81] flex items-center justify-center px-4">
            <div role="dialog" aria-modal className="hq-panel pointer-events-auto w-[min(520px,94vw)]">
              {!done ? (
                <>
                  <header className="hq-panel-head" style={{ minHeight: 52 }}>
                    <h2 className="min-w-0 truncate">
                      <TypeLine text="Form a squad" size="21px" />
                    </h2>
                    <button onClick={reset} className="hq-label hover:text-ink" aria-label="Close">
                      ✕
                    </button>
                  </header>

                  <div className="flex flex-col gap-4 p-5">
                    <div>
                      <label
                        className="hq-label mb-1.5 block"
                        style={{ color: "var(--color-ink)" }}
                      >
                        Game
                      </label>
                      <select
                        value={game}
                        onChange={(e) => setGame(e.target.value)}
                        className={`${field} cursor-pointer`}
                        style={{ borderColor: "var(--color-rule)" }}
                      >
                        {games.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                      <div>
                        <label
                          className="hq-label mb-1.5 block"
                          style={{ color: "var(--color-ink)" }}
                        >
                          Squad name
                        </label>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={field}
                          style={{ borderColor: "var(--color-rule)" }}
                        />
                      </div>
                      <div>
                        <label
                          className="hq-label mb-1.5 block"
                          style={{ color: "var(--color-ink)" }}
                        >
                          Clan tag
                        </label>
                        <input
                          value={tag}
                          onChange={(e) => setTag(e.target.value)}
                          maxLength={6}
                          className={field}
                          style={{ borderColor: "var(--color-rule)" }}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        className="hq-label mb-1.5 block"
                        style={{ color: "var(--color-ink)" }}
                      >
                        Who captains it?
                      </label>
                      <select
                        value={captain}
                        onChange={(e) => setCaptain(e.target.value)}
                        className={`${field} cursor-pointer`}
                        style={{ borderColor: "var(--color-rule)" }}
                      >
                        {people.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.id === meId ? `${p.name} (you)` : p.name}
                          </option>
                        ))}
                      </select>
                      <p className="hq-mono mt-1.5 text-[11px] text-ink-soft">
                        They run this squad only — musters, requests and its roster.
                      </p>
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
                        style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
                      >
                        {pending ? "Forming…" : "Form squad"}
                      </button>
                      <span className="hq-label opacity-70">Live the moment you press it</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <header className="hq-panel-head" style={{ minHeight: 52 }}>
                    <h2 className="min-w-0 truncate">
                      <TypeLine text="✓ Squad formed" size="21px" />
                    </h2>
                  </header>
                  <div className="flex flex-col gap-3 p-5">
                    <p className="hq-readout text-[17px] font-bold uppercase tracking-[0.02em]">
                      {name.trim() || "The squad"} is on strength
                    </p>
                    <p className="text-[13px] text-ink-soft">
                      <span className="text-ink">{captainName}</span> has the captaincy and can call
                      a muster. Anyone in the Barracks can join it from the directory.
                    </p>
                    <div className="border-t border-rule pt-4">
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
