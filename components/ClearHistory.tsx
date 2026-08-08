"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearHistory } from "@/app/actions/inbox";
import { shortDate } from "@/lib/dates";

// Organiser-only control to trim the activity history. Clear everything up to
// now, or everything on/before a chosen date. Non-destructive — it only hides
// items from the feed, and "Show all again" brings them back.
export function ClearHistory({ clearedBefore }: { clearedBefore: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply(before: string | null) {
    setBusy(true);
    await clearHistory(before);
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="mt-6 border-t border-rule pt-4">
      {clearedBefore && (
        <p className="mb-2 text-sm text-ink-soft">
          History is hidden before {shortDate(clearedBefore.slice(0, 10))}.{" "}
          <button
            onClick={() => apply(null)}
            disabled={busy}
            className="font-semibold text-moss underline"
          >
            Show all again
          </button>
        </p>
      )}

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-flag"
        >
          Clear history
        </button>
      ) : (
        <div>
          <p className="label mb-2">Clear history</p>
          <p className="mb-3 text-sm text-ink-soft">
            This hides old activity for everyone. Nothing is deleted — you can
            bring it back any time.
          </p>

          <div className="mb-3">
            <label className="label mb-1 block">Clear on or before</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="min-w-0 flex-1 rounded-[3px] border border-rule bg-card px-3 py-2.5 text-ink outline-none focus:border-ink"
              />
              <button
                onClick={() => apply(new Date(`${date}T23:59:59`).toISOString())}
                disabled={busy || !date}
                className="shrink-0 rounded-[3px] border border-ink px-4 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => apply(new Date().toISOString())}
              disabled={busy}
              className="rounded-[3px] bg-flag px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
            >
              Clear everything
            </button>
            <button
              onClick={() => setOpen(false)}
              disabled={busy}
              className="text-sm text-ink-soft"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
