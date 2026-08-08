"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { postComment, deleteComment } from "@/app/actions/comments";
import { Avatar } from "@/components/Avatar";
import { relativeTime } from "@/lib/dates";
import type { Comment, Profile } from "@/lib/types";

// Three men slagging each other off (§5): oldest at top, live via Realtime,
// nothing threaded, no reactions, no editing.
export function Chat({
  competitionId,
  initial,
  profiles,
  currentUserId,
  isAdmin = false,
}: {
  competitionId: string;
  initial: Comment[];
  profiles: Profile[];
  currentUserId: string;
  isAdmin?: boolean;
}) {
  const [comments, setComments] = useState<Comment[]>(initial);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`comments-${competitionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `competition_id=eq.${competitionId}`,
        },
        (payload) => {
          const c = payload.new as Comment;
          setComments((prev) =>
            prev.some((x) => x.id === c.id) ? prev : [...prev, c],
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "comments" },
        (payload) => {
          const id = (payload.old as { id?: string })?.id;
          if (id) setComments((prev) => prev.filter((x) => x.id !== id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [competitionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    setBody("");
    const res = await postComment(competitionId, text);
    if (!res.ok) {
      setError(res.error);
      setBody(text);
    }
    setSending(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this comment?")) return;
    const prev = comments;
    setComments((cs) => cs.filter((c) => c.id !== id)); // optimistic
    const res = await deleteComment(id, competitionId);
    if (!res.ok) {
      setComments(prev); // put it back
      setError(res.error);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-4 pb-4">
        {comments.length === 0 && (
          <p className="py-8 text-center text-ink-soft">
            Nothing said yet. Someone start.
          </p>
        )}
        {comments.map((c) => {
          const author = c.author_id ? profileById.get(c.author_id) : null;
          const mine = c.author_id === currentUserId;
          const canDelete = mine || isAdmin;
          return (
            <div key={c.id} className="flex gap-3">
              <Avatar
                name={author?.name ?? "?"}
                avatarUrl={author?.avatar_url}
                colour={author?.colour}
                size={30}
              />
              <div className="flex-1">
                <p className="flex items-baseline gap-2">
                  <span className="font-semibold text-ink">
                    {mine ? "You" : (author?.name ?? "Someone")}
                  </span>
                  <span className="text-xs text-ink-soft">
                    {relativeTime(c.created_at)}
                  </span>
                  {canDelete && (
                    <button
                      onClick={() => remove(c.id)}
                      className="ml-auto shrink-0 text-xs text-ink-soft hover:text-flag"
                      aria-label="Delete comment"
                    >
                      Delete
                    </button>
                  )}
                </p>
                <p className="text-ink">{c.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={send}
        className="sticky bottom-0 flex gap-2 border-t border-rule bg-paper py-3"
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Say something"
          className="flex-1 rounded-[3px] border border-rule bg-card px-4 py-2.5 text-ink outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="rounded-[3px] bg-ink px-4 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
        >
          Send
        </button>
      </form>
      {error && <p className="pb-2 text-sm text-flag">{error}</p>}
    </div>
  );
}
