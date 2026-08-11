"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  requestGame,
  setGameRequestStatus,
  deleteGameRequest,
} from "@/app/actions/requests";
import { gameById, DEFAULT_GAME, type Game } from "@/lib/games";
import { useAnnounce } from "@/components/Announce";
import { shortDate } from "@/lib/dates";
import type { GameRequestWithPlayer } from "@/lib/queries";

// Human-readable availability window + squad-size, for the request cards.
function windowText(from: string | null, to: string | null): string | null {
  if (from && to) return `${shortDate(from)} – ${shortDate(to)}`;
  if (from) return `From ${shortDate(from)}`;
  if (to) return `Until ${shortDate(to)}`;
  return null;
}
function playersText(min: number | null, max: number | null): string | null {
  if (min && max) return `${min}–${max} players`;
  if (min) return `${min}+ players`;
  if (max) return `Up to ${max} players`;
  return null;
}

// Player-initiated "request a game" entry point + the open-requests board. Any
// player can float a game; the CO turns a request into a poll (existing
// broadcast flow) or clears it.
export function GameRequests({
  requests,
  isAdmin,
  currentUserId,
  games,
}: {
  requests: GameRequestWithPlayer[];
  isAdmin: boolean;
  currentUserId: string;
  games: Game[];
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const firstGame = games[0]?.id ?? DEFAULT_GAME;
  const [composing, setComposing] = useState(false);
  const [game, setGame] = useState<string>(firstGame);
  const [customName, setCustomName] = useState("");
  const [note, setNote] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minP, setMinP] = useState("");
  const [maxP, setMaxP] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOther = game === "__other__";

  async function send() {
    if (isOther && !customName.trim()) {
      setError("Type the game's name.");
      return;
    }
    if (to && from && to < from) {
      setError("The end of your window is before the start.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await requestGame({
      game: isOther ? "" : game,
      note,
      customName: isOther ? customName : undefined,
      availableFrom: from || undefined,
      availableTo: to || undefined,
      minPlayers: minP ? Number(minP) : undefined,
      maxPlayers: maxP ? Number(maxP) : undefined,
    });
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    const label = isOther ? customName.trim() : gameById(game).name;
    setNote("");
    setCustomName("");
    setFrom("");
    setTo("");
    setMinP("");
    setMaxP("");
    setGame(firstGame);
    setComposing(false);
    setBusy(false);
    announce(`Game request raised · ${label}`);
    router.refresh();
  }

  async function planPoll(id: string) {
    setBusy(true);
    await setGameRequestStatus(id, "planning");
    setBusy(false);
    // Hand the CO to the compose screen to run a vote / deployment-check poll.
    router.push("/broadcast");
  }

  async function clearReq(id: string) {
    setBusy(true);
    await deleteGameRequest(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="mt-8">
      <div className="mb-1 flex items-center justify-between">
        <p className="label">Requests 🎮</p>
        {!composing && (
          <button
            onClick={() => setComposing(true)}
            className="label text-ink-soft transition-colors hover:text-ink"
          >
            + Request a game
          </button>
        )}
      </div>
      <hr className="rule" />

      {/* Compose */}
      {composing && (
        <div className="mt-3 rounded-[3px] border border-rule bg-card p-4">
          <label className="label mb-1 block">Game</label>
          <div className="relative">
            <select
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="w-full appearance-none rounded-[3px] border border-rule bg-paper px-4 py-3 text-ink outline-none focus:border-ink"
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.emoji} {g.name}
                </option>
              ))}
              <option value="__other__">➕ Other — type it</option>
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-soft">
              ▼
            </span>
          </div>

          {isOther && (
            <>
              <label className="label mb-1 mt-4 block">New game</label>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Rocket League, Tekken 8…"
                className="w-full rounded-[3px] border border-rule bg-paper px-4 py-3 text-ink outline-none focus:border-ink"
              />
              <p className="mt-1 text-xs text-ink-soft">
                Added to the games list automatically — the CO gets a heads-up.
              </p>
            </>
          )}

          <label className="label mb-1 mt-4 block">When are you free? (optional)</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="mb-1 block font-narrow text-[11px] uppercase tracking-[0.06em] text-ink-soft">From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-[3px] border border-rule bg-paper px-3 py-3 text-ink outline-none focus:border-ink"
              />
            </div>
            <div>
              <span className="mb-1 block font-narrow text-[11px] uppercase tracking-[0.06em] text-ink-soft">To</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-[3px] border border-rule bg-paper px-3 py-3 text-ink outline-none focus:border-ink"
              />
            </div>
          </div>

          <label className="label mb-1 mt-4 block">Players (optional)</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="mb-1 block font-narrow text-[11px] uppercase tracking-[0.06em] text-ink-soft">Min</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={minP}
                onChange={(e) => setMinP(e.target.value)}
                placeholder="2"
                className="w-full rounded-[3px] border border-rule bg-paper px-3 py-3 text-ink outline-none focus:border-ink"
              />
            </div>
            <div>
              <span className="mb-1 block font-narrow text-[11px] uppercase tracking-[0.06em] text-ink-soft">Max</span>
              <input
                type="number"
                inputMode="numeric"
                min={minP || 1}
                value={maxP}
                onChange={(e) => setMaxP(e.target.value)}
                placeholder="4"
                className="w-full rounded-[3px] border border-rule bg-paper px-3 py-3 text-ink outline-none focus:border-ink"
              />
            </div>
          </div>

          <label className="label mb-1 mt-4 block">Note (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder=""
            className="w-full rounded-[3px] border border-rule bg-paper px-4 py-3 text-ink outline-none focus:border-ink"
          />

          {error && <p className="mt-3 text-sm text-flag">{error}</p>}

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => {
                setComposing(false);
                setError(null);
              }}
              className="rounded-[3px] border border-rule px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink-soft"
            >
              Cancel
            </button>
            <button
              onClick={send}
              disabled={busy}
              className="flex-1 rounded-[3px] bg-ink px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
            >
              {busy ? "Sending" : "Send request 📡"}
            </button>
          </div>
        </div>
      )}

      {/* Open requests */}
      {requests.length > 0 ? (
        <ul className="divide-y divide-rule">
          {requests.map((r) => {
            const g = gameById(r.game);
            const mine = r.requested_by === currentUserId;
            return (
              <li key={r.id} className="py-3">
                <div className="flex items-start gap-3">
                  <span className="text-lg leading-none">{g.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ink">
                      <span className="font-semibold">{g.name}</span>
                      <span className="text-ink-soft">
                        {" "}
                        · {r.requester?.name ?? "Someone"}
                      </span>
                    </p>
                    {(windowText(r.available_from, r.available_to) ||
                      playersText(r.min_players, r.max_players)) && (
                      <p className="mt-0.5 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
                        {[
                          windowText(r.available_from, r.available_to) &&
                            `📅 ${windowText(r.available_from, r.available_to)}`,
                          playersText(r.min_players, r.max_players) &&
                            `👥 ${playersText(r.min_players, r.max_players)}`,
                        ]
                          .filter(Boolean)
                          .join("  ·  ")}
                      </p>
                    )}
                    {r.note && (
                      <p className="mt-0.5 truncate text-sm text-ink-soft">
                        “{r.note}”
                      </p>
                    )}
                  </div>
                </div>

                {(isAdmin || mine) && (
                  <div className="mt-2 flex flex-wrap gap-2 pl-8">
                    {isAdmin && (
                      <button
                        onClick={() => planPoll(r.id)}
                        disabled={busy}
                        className="rounded-[3px] bg-ink px-3 py-1.5 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-paper disabled:opacity-50"
                      >
                        Rally a poll →
                      </button>
                    )}
                    <button
                      onClick={() => clearReq(r.id)}
                      disabled={busy}
                      className="rounded-[3px] border border-rule px-3 py-1.5 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft disabled:opacity-50"
                    >
                      {isAdmin ? "Dismiss" : "Withdraw"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        !composing && (
          <p className="mt-3 text-sm text-ink-soft">
            No requests on the board.
          </p>
        )
      )}
    </section>
  );
}
