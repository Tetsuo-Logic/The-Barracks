"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestSquad } from "@/app/actions/squads";
import { Portal } from "@/components/hq/Portal";

// REQUEST A SQUAD — the member's route to a new squad.
//
// Forming one is the President's call: RLS only lets a group admin insert into
// `squads`, which is why members ask rather than do. The request carries who
// should run it, and approval seats them as Captain of that squad (0046).
//
// Captaincy is per-squad and stays that way. Being Captain of COD Squad grants
// nothing over FIFA Squad and no power to form more — the flag lives on the
// squad_members row, and squad creation is admin-only at the database.

export type GameOption = { id: string; name: string };
export type PersonOption = { id: string; name: string };

export function RequestSquad({
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
  const [sent, setSent] = useState(false);
  const [game, setGame] = useState(games[0]?.id ?? "");
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [captain, setCaptain] = useState(meId);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setOpen(false);
    setSent(false);
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
      const res = await requestSquad({
        game,
        name: name.trim(),
        clanTag: tag.trim() || undefined,
        captainId: captain || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Couldn't send the request.");
        return;
      }
      setSent(true);
      router.refresh();
    });
  }

  const field =
    "hq-mono w-full rounded-[3px] border px-3 py-2.5 text-[13px] outline-none transition-colors focus:border-sand";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hq-label rounded-[3px] border px-3 py-2 font-semibold transition-colors hover:text-ink"
        style={{ borderColor: "var(--color-rule)" }}
      >
        Request a squad
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
              {!sent ? (
                <>
                  <header className="hq-panel-head">
                    <h2 className="hq-label" style={{ color: "var(--color-sand)" }}>
                      Request a squad
                    </h2>
                    <button onClick={reset} className="hq-label hover:text-ink" aria-label="Close">
                      ✕
                    </button>
                  </header>

                  <div className="flex flex-col gap-4 p-5">
                    <div>
                      <label className="hq-label mb-1.5 block">Game</label>
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
                        <label className="hq-label mb-1.5 block">Squad name</label>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="COD Squad"
                          className={field}
                          style={{ borderColor: "var(--color-rule)" }}
                        />
                      </div>
                      <div>
                        <label className="hq-label mb-1.5 block">Clan tag</label>
                        <input
                          value={tag}
                          onChange={(e) => setTag(e.target.value)}
                          placeholder="COD"
                          maxLength={6}
                          className={field}
                          style={{ borderColor: "var(--color-rule)" }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="hq-label mb-1.5 block">Who should captain it?</label>
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
                        They run this squad only — musters, requests and its roster. Nothing else.
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
                        {pending ? "Sending…" : "Send to the President"}
                      </button>
                      <span className="hq-label opacity-70">Only the President can form a squad</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <header className="hq-panel-head">
                    <h2 className="hq-label" style={{ color: "var(--color-moss)" }}>
                      ✓ Request sent
                    </h2>
                  </header>
                  <div className="flex flex-col gap-3 p-5">
                    <p className="hq-readout text-[17px] font-bold uppercase tracking-[0.02em]">
                      Sent to the President
                    </p>
                    <p className="text-[13px] text-ink-soft">
                      If it&apos;s approved, {name.trim() || "the squad"} is formed and{" "}
                      <span className="text-ink">{captainName}</span> takes the captaincy — of that
                      squad, and nothing else. You&apos;ll be told either way.
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
