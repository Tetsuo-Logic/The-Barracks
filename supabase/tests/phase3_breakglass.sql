-- phase3_breakglass.sql — EMERGENCY UNDO for Phase 3 (0030).
-- If the live app misbehaves after applying 0030, paste-and-run this. It
-- instantly reverts to pre-Phase-3 access (any signed-in user sees everything;
-- admin = the old global check) by redefining the four helper functions every
-- policy delegates to — so it touches NO policies and needs no deploy.
-- The group_id data, memberships and columns all stay; only visibility reverts.

create or replace function public.is_member(gid uuid) returns boolean
  language sql security definer set search_path = public stable as $$ select auth.uid() is not null $$;

create or replace function public.is_group_admin(gid uuid) returns boolean
  language sql security definer set search_path = public stable as $$ select public.is_admin() $$;

create or replace function public.is_group_president(gid uuid) returns boolean
  language sql security definer set search_path = public stable as $$ select public.is_admin() or public.is_president() $$;

create or replace function public.shares_group(other uuid) returns boolean
  language sql security definer set search_path = public stable as $$ select auth.uid() is not null $$;
