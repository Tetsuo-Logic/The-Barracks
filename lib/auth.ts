import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * The signed-in player's profile row, or null. Use in Server Components.
 * Middleware already redirects unauthenticated users away from private routes.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  // Local JWT verification — no network round-trip to the auth server.
  const { data: claimsData } = await supabase.auth.getClaims();
  const uid = claimsData?.claims?.sub;
  if (!uid) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", uid)
    .single();

  return (data as Profile) ?? null;
}

/**
 * Require a completed profile. Sends unauthenticated users to /login and
 * players who haven't finished onboarding (no nickname yet) to /onboarding.
 */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.nickname) redirect("/onboarding");
  return profile;
}
