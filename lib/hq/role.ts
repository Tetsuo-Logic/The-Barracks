import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// ── Role view, shared by every HQ page ─────────────────────────────────────
// The dev switch lives in the shell, so each page just resolves `?as=` through
// here. This is a RENDER filter: it decides what a screen shows, never what a
// caller may do. Authorisation stays where it belongs — in RLS and in the
// server actions, which always check the real role.

export type HqScope = "member" | "captain" | "president";

/** What each role is allowed to see. A president sees everything below them. */
export const VISIBLE_TO: Record<HqScope, HqScope[]> = {
  president: ["member", "captain", "president"],
  captain: ["member", "captain"],
  member: ["member"],
};

/** The caller's actual standing in this Barracks. */
export async function realRoleOf(profile: Profile): Promise<HqScope> {
  if (profile.is_admin || profile.is_president) return "president";
  const supabase = await createClient();
  const { data } = await supabase
    .from("squad_members")
    .select("squad_id")
    .eq("user_id", profile.id)
    .eq("is_captain", true)
    .limit(1);
  return (data ?? []).length > 0 ? "captain" : "member";
}

/**
 * Resolve the role a page should render as. You can only ever preview *down*
 * from what you actually are — asking for a role above your own is ignored, so
 * the switch can't be used to peek at command surfaces you don't hold.
 */
export function resolveViewRole(asked: string | undefined, real: HqScope): HqScope {
  if (!asked) return real;
  const wanted = asked as HqScope;
  return VISIBLE_TO[real].includes(wanted) ? wanted : real;
}

/** Does this role see items owned by `scope`? */
export function canSee(view: HqScope, scope: HqScope): boolean {
  return VISIBLE_TO[view].includes(scope);
}
