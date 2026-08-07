import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { NotificationPrefs } from "@/lib/types";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

// Which notification_prefs column gates each kind of message (§6.4).
export type NotifKind =
  | "new_comp"
  | "rsvp_changes"
  | "comments"
  | "results"
  | "day_of"
  | "chase_undecided";

let configured = false;
function ensureVapid(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:noreply@example.com";
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
  }
  return true;
}

/**
 * Send a push to a set of players, honouring their notification_prefs. Expired
 * subscriptions (404/410) are deleted so the loop can't throw next time (§6.3).
 * Best-effort and non-blocking-critical: never throws to the caller.
 */
export async function sendToPlayers(
  playerIds: string[],
  kind: NotifKind,
  payload: PushPayload,
): Promise<void> {
  try {
    if (!ensureVapid()) return;
    if (playerIds.length === 0) return;
    // Prefer the service-role client (needed by the cron, no session there).
    // Fall back to the request-scoped client for immediate sends — the read
    // policies on subscriptions/prefs allow any signed-in user, so instant
    // notifications work without the service key configured.
    const admin = createAdminClient() ?? (await createClient());

    // Filter by prefs.
    const { data: prefs } = await admin
      .from("notification_prefs")
      .select("*")
      .in("player_id", playerIds);
    const allowed = new Set(
      ((prefs ?? []) as NotificationPrefs[])
        .filter((p) => p[kind] !== false)
        .map((p) => p.player_id),
    );
    // Players with no prefs row default to allowed.
    const targets = playerIds.filter(
      (id) => allowed.has(id) || !(prefs ?? []).some((p) => p.player_id === id),
    );
    if (targets.length === 0) return;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("*")
      .in("player_id", targets);
    if (!subs || subs.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
        } catch (err: unknown) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      }),
    );
  } catch {
    // swallow — a failed push must never break the write that triggered it
  }
}
