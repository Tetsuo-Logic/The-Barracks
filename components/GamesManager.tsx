"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addGame, deleteGame } from "@/app/actions/games";
import type { Game } from "@/lib/games";

// CO-only: the editable games list. Add anything; remove any. Only the seed
// Threeball Cup keeps golf scoring — added games are plain games.
export function GamesManager({ games }: { games: Game[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    const res = await addGame(name);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setName("");
    router.refresh();
  }

  async function remove(id: string, label: string) {
    if (!confirm(`Remove ${label} from the games list?`)) return;
    setBusy(true);
    await deleteGame(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <ul className="mb-3 divide-y divide-rule rounded-[3px] border border-rule">
        {games.map((g) => (
          <li key={g.id} className="flex items-center gap-2.5 px-3 py-2.5">
            <span className="text-lg leading-none">{g.emoji}</span>
            <span className="flex-1 text-ink">{g.name}</span>
            {g.hasScorecard && (
              <span className="label" style={{ color: "var(--color-sand)" }}>
                Golf
              </span>
            )}
            <button
              onClick={() => remove(g.id, g.name)}
              disabled={busy}
              className="font-mono text-xs uppercase tracking-[0.08em] text-flag disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a game — e.g. Rocket League"
          className="flex-1 rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
        />
        <button
          onClick={add}
          disabled={busy || !name.trim()}
          className="rounded-[3px] bg-ink px-4 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-flag">{error}</p>}
    </div>
  );
}
