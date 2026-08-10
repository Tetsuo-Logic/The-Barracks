"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postBroadcastMessage } from "@/app/actions/broadcasts";
import { Avatar } from "@/components/Avatar";
import { relativeTime } from "@/lib/dates";
import type { BroadcastMessage, Profile } from "@/lib/types";

// The reply thread on a ping — append-only, so the timeline shows who said what
// and when. Optionally aim a reply at one player (everyone still gets the ping).
export function BroadcastThread({
  broadcastId,
  messages,
  profiles,
  currentUserId,
}: {
  broadcastId: string;
  messages: BroadcastMessage[];
  profiles: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const others = profiles.filter((p) => p.id !== currentUserId);
  const [body, setBody] = useState("");
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const raw = body.trim();
    if (!raw) return;
    const target = to ? byId.get(to) : null;
    const text = target ? `@${target.name} ${raw}` : raw;
    setSending(true);
    setError(null);
    setBody("");
    const res = await postBroadcastMessage(broadcastId, text);
    if (!res.ok) {
      setError(res.error);
      setBody(raw);
    }
    setSending(false);
    router.refresh();
  }

  return (
    <div className="mt-6">
      <p className="label mb-2">Replies 💬</p>

      {messages.length === 0 ? (
        <p className="mb-3 text-sm text-ink-soft">No replies yet.</p>
      ) : (
        <div className="mb-3 flex flex-col gap-3">
          {messages.map((m) => {
            const a = m.author_id ? byId.get(m.author_id) : null;
            const mine = m.author_id === currentUserId;
            return (
              <div key={m.id} className="flex gap-3">
                <Avatar name={a?.name ?? "?"} avatarUrl={a?.avatar_url} colour={a?.colour} size={28} />
                <div className="flex-1">
                  <p className="flex items-baseline gap-2">
                    <span className="font-semibold text-ink">
                      {mine ? "You" : a?.name ?? "Someone"}
                    </span>
                    <span className="text-xs text-ink-soft">{relativeTime(m.created_at)}</span>
                  </p>
                  <p className="text-ink">{m.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={send} className="flex flex-col gap-2">
        {others.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="label shrink-0">To</span>
            <div className="relative flex-1">
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full appearance-none rounded-[3px] border border-rule bg-card px-3 py-2 font-mono text-xs uppercase tracking-[0.08em] text-ink outline-none focus:border-ink"
              >
                <option value="">Everyone</option>
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft">
                ▾
              </span>
            </div>
          </label>
        )}
        <div className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={to ? `Message ${byId.get(to)?.name ?? ""}…` : "Add a reply"}
            className="flex-1 rounded-[3px] border border-rule bg-card px-4 py-2.5 text-ink outline-none focus:border-ink"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="rounded-[3px] bg-ink px-4 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-flag">{error}</p>}
    </div>
  );
}
