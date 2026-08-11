"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createSquad,
  requestSquad,
  approveRequest,
  declineRequest,
  deleteSquad,
  joinSquad,
  leaveSquad,
  removeMember,
  setCaptain,
  setClanTag,
} from "@/app/actions/squads";
import { Avatar } from "@/components/Avatar";
import { useAnnounce } from "@/components/Announce";
import { gameById, type Game } from "@/lib/games";
import type { SquadView, SquadRequestView } from "@/lib/queries";

// Game-specific squads: members request one, the President approves; members
// self-join; the President appoints a Captain. Clan tag editable by Captain/CO.
export function SquadsBoard({
  squads,
  requests,
  games,
  currentUserId,
  isAdmin,
}: {
  squads: SquadView[];
  requests: SquadRequestView[];
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
  const [newTag, setNewTag] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [tagVal, setTagVal] = useState("");

  // Games that don't already have a squad or an open request.
  const taken = new Set([...squads.map((s) => s.squad.game), ...requests.map((r) => r.game)]);
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

  async function submit() {
    if (!newGame) {
      announce("Pick a game.");
      return;
    }
    setBusy(true);
    const res = isAdmin
      ? await createSquad(newGame, newName, newTag)
      : await requestSquad({ game: newGame, name: newName, clanTag: newTag });
    setBusy(false);
    if (!res.ok) {
      announce(res.error);
      return;
    }
    setNewGame("");
    setNewName("");
    setNewTag("");
    setComposing(false);
    announce(isAdmin ? "Squad formed 🪖" : "Request sent to the President 🪖");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="label">Squads 🪖</p>
        {available.length > 0 && !composing && (
          <button onClick={() => setComposing(true)} className="label text-ink-soft transition-colors hover:text-ink">
            + {isAdmin ? "New squad" : "Request squad"}
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
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="label mb-1 block">Name (optional)</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="The COD Lads"
                className="w-full rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
              />
            </div>
            <div>
              <label className="label mb-1 block">Clan tag</label>
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="TAG"
                className="w-full rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setComposing(false)}
              className="rounded-[3px] border border-rule px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink-soft"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || !newGame}
              className="flex-1 rounded-[3px] bg-ink px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
            >
              {isAdmin ? "Form squad 🪖" : "Send request 🪖"}
            </button>
          </div>
        </div>
      )}

      {/* Requests before the President */}
      {isAdmin && requests.length > 0 && (
        <div className="mt-4">
          <p className="label mb-2">Squad requests before the President</p>
          <div className="flex flex-col gap-2">
            {requests.map((r) => {
              const g = gameById(r.game);
              return (
                <div key={r.id} className="rounded-[3px] border border-sand/50 bg-card p-3">
                  <p className="font-semibold text-ink">
                    {g.emoji} {r.name || `${g.name} Squad`}
                    {r.clan_tag && <span className="ml-1 font-mono text-xs text-ink-soft">[{r.clan_tag}]</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">Requested by {r.requester?.name ?? "someone"}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => run(() => approveRequest(r.id), "Squad approved 🪖")}
                      disabled={busy}
                      className="rounded-[3px] bg-moss px-4 py-1.5 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-paper disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => run(() => declineRequest(r.id))}
                      disabled={busy}
                      className="rounded-[3px] border border-rule px-4 py-1.5 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {squads.length === 0 && !composing ? (
        <p className="mt-4 text-center text-sm text-ink-soft">
          No squads yet. {isAdmin ? "Form one per game your lot play." : "Request one for a game you play."}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {squads.map(({ squad, members, captainId, mine }) => {
            const g = gameById(squad.game);
            const iAmCaptain = captainId === currentUserId;
            const canManageTag = isAdmin || iAmCaptain;
            return (
              <div key={squad.id} className="rounded-[3px] border border-rule bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      <span className="mr-1">{g.emoji}</span>
                      {squad.name || `${g.name} Squad`}
                      {squad.clan_tag && <span className="ml-1 font-mono text-xs text-ink-soft">[{squad.clan_tag}]</span>}
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

                {/* Clan tag edit */}
                {canManageTag &&
                  (editingTag === squad.id ? (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={tagVal}
                        onChange={(e) => setTagVal(e.target.value)}
                        placeholder="Clan tag"
                        className="w-28 rounded-[3px] border border-rule bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-ink"
                      />
                      <button
                        onClick={() => {
                          setEditingTag(null);
                          run(() => setClanTag(squad.id, tagVal), "Clan tag updated");
                        }}
                        disabled={busy}
                        className="font-mono text-xs uppercase tracking-[0.06em] text-ink-soft hover:text-ink"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditingTag(null)} className="font-mono text-xs uppercase tracking-[0.06em] text-ink-soft">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setTagVal(squad.clan_tag ?? "");
                        setEditingTag(squad.id);
                      }}
                      className="mt-1 font-mono text-xs uppercase tracking-[0.06em] text-ink-soft transition-colors hover:text-ink"
                    >
                      {squad.clan_tag ? "Edit clan tag" : "+ Clan tag"}
                    </button>
                  ))}

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
                        {(isAdmin || iAmCaptain) && m.profile.id !== currentUserId && (
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
