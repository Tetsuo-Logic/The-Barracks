// The permissions layer: pure, framework-free predicates over a profile + the
// "preview as player" flag. No React, no Next, no cookies — the caller resolves
// `previewing` (via lib/preview) and passes it in. This is where per-group role
// logic (memberships, role grants) will live once multi-tenancy lands; today it
// encodes the single-Barracks rules exactly as they were inlined in the pages.

type AdminLike = { is_admin: boolean };
type RulerLike = { is_admin: boolean; is_president: boolean };

/**
 * Effective admin (the CO's powers), dropped while previewing as a player.
 * Mirrors the former `profile.is_admin && !previewing`.
 */
export function effectiveAdmin(profile: AdminLike, previewing: boolean): boolean {
  return profile.is_admin && !previewing;
}

/**
 * Can rule on the Board / in the Courtroom: the sitting President or the CO,
 * dropped while previewing. Mirrors `(is_president || is_admin) && !previewing`.
 */
export function canRule(profile: RulerLike, previewing: boolean): boolean {
  return (profile.is_president || profile.is_admin) && !previewing;
}
