"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addRadarGame, setRadarInterest, deleteRadarGame } from "@/app/actions/radar";
import { addGame } from "@/app/actions/games";
import { useAnnounce } from "@/components/Announce";
import { shortDate } from "@/lib/dates";
import type { RadarItem } from "@/lib/queries";
import { DatePicker } from "@/components/DatePicker";

// The games wishlist: what to get next. Add a title (+ optional release date and
// note); everyone marks Interested / Not.
export function RadarBoard({
  items,
  currentUserId,
  isAdmin,
}: {
  items: RadarItem[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [release, setRelease] = useState("");
  const [note, setNote] = useState("");
  const [trailer, setTrailer] = useState("");
  const [platform, setPlatform] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    const res = await addRadarGame({
      title,
      releaseDate: release || undefined,
      note,
      youtubeUrl: trailer || undefined,
      platform: platform || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTitle("");
    setRelease("");
    setNote("");
    setTrailer("");
    setPlatform("");
    setComposing(false);
    announce(`On the radar · ${title.trim()}`);
    router.refresh();
  }

  async function toGames(title: string) {
    setBusy(true);
    const res = await addGame(title);
    setBusy(false);
    announce(res.ok ? `Added to games list · ${title}` : res.error);
    router.refresh();
  }

  async function mark(id: string, interested: boolean) {
    setBusy(true);
    await setRadarInterest(id, interested);
    setBusy(false);
    router.refresh();
  }

  async function remove(id: string, label: string) {
    if (!confirm(`Clear ${label} off the radar?`)) return;
    setBusy(true);
    await deleteRadarGame(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="label">On the radar 🛰️</p>
        {!composing && (
          <button
            onClick={() => setComposing(true)}
            className="rounded-[4px] border border-rule px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            🛰 Add a game
          </button>
        )}
      </div>

      {composing && (
        <div className="mb-6 rounded-[3px] border border-rule bg-card p-4">
          <label className="label mb-1 block">Game</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="GTA VI, EA FC 26…"
            className="mb-3 w-full rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
          />
          <label className="label mb-1 block">Platform (optional)</label>
          <div className="relative mb-3">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full appearance-none rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
            >
              <option value="">Any / not sure</option>
              <option value="PC">PC</option>
              <option value="PlayStation">PlayStation</option>
              <option value="Xbox">Xbox</option>
              <option value="VR">VR</option>
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft">
              ▾
            </span>
          </div>

          <label className="label mb-1 block">Release date (optional)</label>
          <div className="mb-3">
            <DatePicker value={release} onChange={setRelease} placeholder="Release date" />
          </div>
          <label className="label mb-1 block">Trailer link (optional)</label>
          <input
            value={trailer}
            onChange={(e) => setTrailer(e.target.value)}
            inputMode="url"
            placeholder="Paste a YouTube link…"
            className="mb-3 w-full rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
          />
          <label className="label mb-1 block">Note (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Co-op campaign, worth a look…"
            className="w-full rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
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
              onClick={add}
              disabled={busy || !title.trim()}
              className="flex-1 rounded-[3px] bg-ink px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
            >
              {busy ? "Adding" : "Put it on the radar 🛰️"}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-10 text-center text-ink-soft">
          Nothing on the radar. What&apos;s coming out? 🛰️
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((g) => {
            const mineYes = g.mine === true;
            const mineNo = g.mine === false;
            const canDelete = g.added_by === currentUserId || isAdmin;
            return (
              <li key={g.id} className="rounded-[3px] border border-rule bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{g.title}</p>
                    <p className="mt-0.5 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
                      {g.release_date ? `Out ${shortDate(g.release_date)}` : "No date"}
                      {g.platform ? ` · ${g.platform}` : ""} · {g.adderName}
                    </p>
                    {g.note && <p className="mt-1 text-sm text-ink-soft">{g.note}</p>}
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => remove(g.id, g.title)}
                      disabled={busy}
                      className="shrink-0 font-mono text-xs uppercase tracking-[0.08em] text-ink-soft hover:text-flag disabled:opacity-50"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => mark(g.id, true)}
                    disabled={busy}
                    className="rounded-[3px] border py-2 font-narrow text-sm font-semibold uppercase tracking-[0.06em] transition-colors disabled:opacity-60"
                    style={{
                      backgroundColor: mineYes ? "var(--color-moss)" : "transparent",
                      borderColor: mineYes ? "var(--color-moss)" : "var(--color-rule)",
                      color: mineYes ? "var(--color-paper)" : "var(--color-ink)",
                    }}
                  >
                    Interested{g.yes > 0 ? ` · ${g.yes}` : ""}
                  </button>
                  <button
                    onClick={() => mark(g.id, false)}
                    disabled={busy}
                    className="rounded-[3px] border py-2 font-narrow text-sm font-semibold uppercase tracking-[0.06em] transition-colors disabled:opacity-60"
                    style={{
                      backgroundColor: mineNo ? "var(--color-flag)" : "transparent",
                      borderColor: mineNo ? "var(--color-flag)" : "var(--color-rule)",
                      color: mineNo ? "var(--color-paper)" : "var(--color-ink)",
                    }}
                  >
                    Not for me{g.no > 0 ? ` · ${g.no}` : ""}
                  </button>
                </div>

                {(g.youtube_url || isAdmin) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {g.youtube_url && (
                      <a
                        href={g.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-[3px] border border-rule px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-ink transition-colors hover:border-ink"
                      >
                        ▶ Watch trailer
                      </a>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => toGames(g.title)}
                        disabled={busy}
                        className="rounded-[3px] border border-sand/60 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-sand transition-colors hover:border-sand disabled:opacity-50"
                      >
                        + Add to games
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
