import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. SERVER ONLY. Used for push fan-out and
// the cron sweep, which need to read every player's subscriptions and prefs.
// Returns null if the service key isn't configured (push simply no-ops).
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
