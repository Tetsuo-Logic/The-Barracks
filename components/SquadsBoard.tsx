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
  requestNight,
  clearNightRequest,
} from "@/app/actions/squads";
import { Avatar } from "@/components/Avatar";
import { Muster } from "@/components/Muster";
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
  const [nightFor, setNightFor] = useState<string | null>(null);
  const [nightNote, setNightNote] = useState("");

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
    if (!newName.trim()) {
      announce("Name the squad.");
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
              <label className="label mb-1 block">Name</label>
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
              disabled={busy || !newGame || !newName.trim()}
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
          {squads.map(({ squad, members, captainId, mine, nightRequests, muster }) => {
            const g = gameById(squad.game);
            const iAmCaptain = captainId === currentUserId;
            // The Captain owns the clan tag; the CO only steps in when a squad
            // has no Captain yet.
            const canManageTag = iAmCaptain || (isAdmin && captainId == null);
            const seesNights = isAdmin || iAmCaptain;
            return (
              <div key={squad.id} className="rounded-[3px] border border-rule bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
                      <span>
                        <span className="mr-1">{g.emoji}</span>
                        {squad.name || `${g.name} Squad`}
                      </span>
                      {squad.clan_tag && (
                        <span className="rounded-[3px] border border-sand/40 bg-sand/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-none text-sand">
                          [{squad.clan_tag}]
                        </span>
                      )}
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

                {/* Clan tag — a clear, tappable control (Captain / CO only) */}
                {canManageTag &&
                  (editingTag === squad.id ? (
                    <div className="mt-3 rounded-[3px] border border-rule bg-paper p-3">
                      <label className="label mb-1 block">Clan tag</label>
                      <div className="flex items-center gap-2">
                        <input
                          value={tagVal}
                          onChange={(e) => setTagVal(e.target.value)}
                          placeholder="TAG"
                          autoFocus
                          maxLength={8}
                          className="w-full rounded-[3px] border border-rule bg-card px-3 py-2.5 text-ink outline-none focus:border-ink"
                        />
                        <button
                          onClick={() => {
                            setEditingTag(null);
                            run(() => setClanTag(squad.id, tagVal), "Clan tag updated");
                          }}
                          disabled={busy}
                          className="shrink-0 rounded-[3px] bg-ink px-4 py-2.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingTag(null)}
                          className="shrink-0 rounded-[3px] border border-rule px-3 py-2.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink-soft"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setTagVal(squad.clan_tag ?? "");
                        setEditingTag(squad.id);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-[3px] border border-rule px-3 py-1.5 font-narrow text-xs font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:border-ink hover:bg-card"
                    >
                      🏷 {squad.clan_tag ? "Edit clan tag" : "Add clan tag"}
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

                {/* The Muster — pre-week arrangement (Captain calls it, squad answers) */}
                <Muster
                  squadId={squad.id}
                  muster={muster}
                  iAmCaptain={iAmCaptain}
                  isAdmin={isAdmin}
                  canCall={iAmCaptain || (isAdmin && captainId == null)}
                  mine={mine}
                  memberCount={members.length}
                />

                {/* Night nudges — the Captain / CO see who wants a game on */}
                {seesNights && nightRequests.length > 0 && (
                  <div className="mt-3 rounded-[3px] border border-sand/40 bg-sand/5 p-3">
                    <p className="label mb-2" style={{ color: "var(--color-sand)" }}>
                      📣 Squad wants a night
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {nightRequests.map((nr) => (
                        <li key={nr.id} className="flex items-center gap-2 text-sm">
                          <span className="shrink-0 text-ink">{nr.requester?.name ?? "Someone"}</span>
                          {nr.note && <span className="min-w-0 truncate text-ink-soft">“{nr.note}”</span>}
                          <button
                            onClick={() => run(() => clearNightRequest(nr.id))}
                            disabled={busy}
                            className="ml-auto shrink-0 font-mono text-xs uppercase tracking-[0.06em] text-ink-soft hover:text-ink"
                          >
                            Clear
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Member nudge — poke the Captain, only when no muster's running */}
                {mine && !iAmCaptain && !muster &&
                  (nightFor === squad.id ? (
                    <div className="mt-3 rounded-[3px] border border-rule bg-paper p-3">
                      <label className="label mb-1 block">Poke your Captain</label>
                      <input
                        value={nightNote}
                        onChange={(e) => setNightNote(e.target.value)}
                        placeholder="Note (optional) — e.g. free most nights this week"
                        className="w-full rounded-[3px] border border-rule bg-card px-3 py-2.5 text-ink outline-none focus:border-ink"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => {
                            const note = nightNote;
                            setNightFor(null);
                            setNightNote("");
                            run(() => requestNight(squad.id, note), "Sent to your Captain 📣");
                          }}
                          disabled={busy}
                          className="rounded-[3px] bg-ink px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
                        >
                          Send
                        </button>
                        <button
                          onClick={() => {
                            setNightFor(null);
                            setNightNote("");
                          }}
                          className="rounded-[3px] border border-rule px-3 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink-soft"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setNightNote("");
                        setNightFor(squad.id);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-[3px] border border-rule px-3 py-1.5 font-narrow text-xs font-semibold uppercase tracking-[0.08em] text-ink transition-colors hover:border-ink hover:bg-card"
                    >
                      📣 Request a night
                    </button>
                  ))}

                {isAdmin && (
                  <div className="mt-4 flex justify-end">
                    {confirmDel === squad.id ? (
                      <div className="flex items-center gap-2 rounded-[3px] border border-flag/50 bg-paper px-3 py-2">
                        <span className="text-xs text-flag">Sure?</span>
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
                        className="rounded-[3px] border border-rule/70 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.08em] text-ink-soft transition-colors hover:border-flag hover:text-flag"
                      >
                        Disband squad
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
