-- 0034_squads.sql — Sq-1: squads data model.
--
-- A Barracks holds game-specific squads (one per game — the game is the squad's
-- fixed identity). Members self-join the ones they play; each squad has one
-- Captain; Operations can belong to a squad, optionally with an acting Captain
-- for that single event. Additive, single-group. ⚠️ Staging first. After 0033.

-- 1. Squads — one per game per Barracks.
create table if not exists squads (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups(id),
  game       text not null,   -- hard-locked identity: 'cod', 'fifa', 'threeball', …
  name       text,            -- optional custom name; display falls back to the game
  created_at timestamptz default now(),
  unique (group_id, game)      -- one COD Squad per Barracks
);
alter table squads enable row level security;
drop policy if exists squads_read on squads;
create policy squads_read on squads for select using (public.is_member(group_id));
drop policy if exists squads_insert on squads;
create policy squads_insert on squads for insert with check (public.is_group_admin(group_id));
drop policy if exists squads_update on squads;
create policy squads_update on squads for update
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
drop policy if exists squads_delete on squads;
create policy squads_delete on squads for delete using (public.is_group_admin(group_id));

-- 2. Squad membership — many-to-many; one Captain flagged per squad.
create table if not exists squad_members (
  squad_id   uuid references squads(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  is_captain boolean not null default false,
  created_at timestamptz default now(),
  primary key (squad_id, user_id)
);
create index if not exists squad_members_user_idx on squad_members (user_id);
alter table squad_members enable row level security;

-- Is the caller the Captain of this squad? (SECURITY DEFINER — safe in policies.)
create or replace function public.is_squad_captain(sid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from squad_members where squad_id = sid and user_id = auth.uid() and is_captain
  );
$$;
grant execute on function public.is_squad_captain(uuid) to authenticated;

drop policy if exists squad_members_read on squad_members;
create policy squad_members_read on squad_members for select
  using (public.is_member((select group_id from squads s where s.id = squad_id)));
-- Self-join (opt in), if you're in the Barracks.
drop policy if exists squad_members_insert on squad_members;
create policy squad_members_insert on squad_members for insert
  with check (
    user_id = auth.uid()
    and public.is_member((select group_id from squads s where s.id = squad_id))
  );
-- Leave yourself; the Captain or CO can remove anyone.
drop policy if exists squad_members_delete on squad_members;
create policy squad_members_delete on squad_members for delete
  using (
    user_id = auth.uid()
    or public.is_squad_captain(squad_id)
    or public.is_group_admin((select group_id from squads s where s.id = squad_id))
  );
-- The CO sets / moves the captaincy (the is_captain flag).
drop policy if exists squad_members_update on squad_members;
create policy squad_members_update on squad_members for update
  using (public.is_group_admin((select group_id from squads s where s.id = squad_id)))
  with check (public.is_group_admin((select group_id from squads s where s.id = squad_id)));

-- 3. Operations can belong to a squad, with an optional acting Captain for that
--    one event (the RoleGrant "acting" idea, scoped to a single Operation).
alter table competitions add column if not exists squad_id uuid references squads(id) on delete set null;
alter table competitions add column if not exists acting_captain_id uuid references profiles(id) on delete set null;
