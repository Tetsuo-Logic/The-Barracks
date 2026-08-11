"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createSquad,
  deleteSquad,
  joinSquad,
  leaveSquad,
  removeMember,
  setCaptain,
} from "@/app/actions/squads";
import { Avatar } from "@/components/Avatar";
import { useAnnounce } from "@/components/Announce";
import { gameById, type Game } from "@/lib/games";
import type { SquadView } from "@/lib/queries";

// Game-specific squads: form one per game, members self-join the ones they play,
// the CO appoints a Captain.
export function SquadsBoard({
  squads,
  games,
  currentUserId,
  isAdmin,
}: {
  squads: SquadView[];
  games: Game[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [newGame, setNewGame] = useState("");
  const [newName, setNewName] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const taken = new Set(squads.map((s) => s.squad.game));
  const available = games.filter((g) => !taken.has(g.id));

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      announce(res.error ?? "Something went wrong.");
      return;
    }
    if (ok) announce(ok);
    router.refresh();
  }

  async function create() {
    if (!newGame) {
      announce("Pick a game.");
      return;
    }
    setBusy(true);
    const res = await createSquad(newGame, newName);
    setBusy(false);
    if (!res.ok) {
      announce(res.error);
      return;
    }
    setNewGame("");
    setNewName("");
    setComposing(false);
    announce("Squad formed 🪖");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="label">Squads 🪖</p>
        {isAdmin && available.length > 0 && !composing && (
          <button onClick={() => setComposing(true)} className="label text-ink-soft transition-colors hover:text-ink">
            + New squad
          </button>
        )}
      </div>
      <hr className="rule" />

      {composing && (
        <div className="mt-3 rounded-[3px] border border-rule bg-card p-4">
          <label className="label mb-1 block">Game</label>
          <div className="relative">
            <select
              value={newGame}
              onChange={(e) => setNewGame(e.target.value)}
              className="w-full appearance-none rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
            >
              <option value="">Pick a game…</option>
              {available.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.emoji} {g.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft">▾</span>
          </div>
          <label className="label mb-1 mt-4 block">Name (optional)</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. The COD Lads"
            className="w-full rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
          />
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setComposing(false)}
              className="rounded-[3px] border border-rule px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink-soft"
            >
              Cancel
            </button>
            <button
              onClick={create}
              disabled={busy || !newGame}
              className="flex-1 rounded-[3px] bg-ink px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
            >
              Form squad 🪖
            </button>
          </div>
        </div>
      )}

      {squads.length === 0 && !composing ? (
        <p className="mt-4 text-center text-sm text-ink-soft">
          No squads yet. {isAdmin ? "Form one per game your lot play." : "The CO forms squads per game."}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {squads.map(({ squad, members, captainId, mine }) => {
            const g = gameById(squad.game);
            const iAmCaptain = captainId === currentUserId;
            const canManage = isAdmin || iAmCaptain;
            return (
              <div key={squad.id} className="rounded-[3px] border border-rule bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      <span className="mr-1">{g.emoji}</span>
                      {squad.name || `${g.name} Squad`}
                    </p>
                    <p className="mt-0.5 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
                      {members.length} {members.length === 1 ? "operative" : "operatives"}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      run(
                        () => (mine ? leaveSquad(squad.id) : joinSquad(squad.id)),
                        mine ? "Left the squad" : "Joined the squad 🪖",
                      )
                    }
                    disabled={busy}
                    className="shrink-0 rounded-[3px] border px-3 py-1.5 font-narrow text-xs font-semibold uppercase tracking-[0.06em]"
                    style={{
                      backgroundColor: mine ? "transparent" : "var(--color-ink)",
                      borderColor: mine ? "var(--color-rule)" : "var(--color-ink)",
                      color: mine ? "var(--color-ink-soft)" : "var(--color-paper)",
                    }}
                  >
                    {mine ? "Leave" : "Join"}
                  </button>
                </div>

                {members.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-2">
                    {members.map((m) => (
                      <li key={m.profile.id} className="flex items-center gap-2">
                        <Avatar name={m.profile.name} avatarUrl={m.profile.avatar_url} colour={m.profile.colour} size={22} />
                        <span className="flex-1 truncate text-ink">
                          {m.profile.id === currentUserId ? "You" : m.profile.name}
                        </span>
                        {m.is_captain && (
                          <span className="font-narrow text-xs font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--color-sand)" }}>
                            ⭐ Captain
                          </span>
                        )}
                        {isAdmin && !m.is_captain && (
                          <button
                            onClick={() => run(() => setCaptain(squad.id, m.profile.id), "Captain appointed ⭐")}
                            disabled={busy}
                            className="font-mono text-xs uppercase tracking-[0.06em] text-ink-soft hover:text-sand"
                          >
                            Make captain
                          </button>
                        )}
                        {canManage && m.profile.id !== currentUserId && (
                          <button
                            onClick={() => run(() => removeMember(squad.id, m.profile.id))}
                            disabled={busy}
                            className="font-mono text-xs uppercase tracking-[0.06em] text-ink-soft hover:text-flag"
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {isAdmin &&
                  (confirmDel === squad.id ? (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-flag">Disband this squad?</span>
                      <button
                        onClick={() => {
                          setConfirmDel(null);
                          run(() => deleteSquad(squad.id), "Squad disbanded");
                        }}
                        disabled={busy}
                        className="rounded-[3px] bg-flag px-3 py-1 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-paper"
                      >
                        Disband
                      </button>
                      <button onClick={() => setConfirmDel(null)} className="font-mono text-xs uppercase tracking-[0.06em] text-ink-soft">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDel(squad.id)}
                      disabled={busy}
                      className="mt-3 font-mono text-xs uppercase tracking-[0.08em] text-ink-soft transition-colors hover:text-flag"
                    >
                      Disband squad
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
