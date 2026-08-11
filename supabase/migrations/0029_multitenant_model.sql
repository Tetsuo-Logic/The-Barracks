-- 0029_multitenant_model.sql — Phase 2: additive multi-tenant DATA MODEL.
-- Adds groups + memberships, tags every group-scoped table with group_id, seeds
-- one group ("The Barracks") and backfills all existing rows/members.
--
-- Deliberately additive: RLS is UNCHANGED (reads still "any signed-in user"),
-- roles stay on profiles, the app is untouched → behaviour is identical.
-- Phase 3 will switch RLS to group-scoped and move roles onto memberships.
-- Run after 0028. Idempotent — safe to re-run.

-- 1. Groups — the neutral "Barracks".
create table if not exists groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);
alter table groups enable row level security;
drop policy if exists groups_read on groups;
create policy groups_read on groups for select using (auth.uid() is not null);

-- 2. Memberships — user ↔ group. Cascades from groups are fine here (roles move
--    onto memberships in Phase 3). Index user_id for "which Barracks am I in?".
create table if not exists memberships (
  group_id   uuid references groups(id)   on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (group_id, user_id)
);
create index if not exists memberships_user_id_idx on memberships (user_id);
alter table memberships enable row level security;
drop policy if exists memberships_read on memberships;
create policy memberships_read on memberships for select using (auth.uid() is not null);

-- 3. Seed ONE group (fixed id) and enrol everyone.
insert into groups (id, name)
values ('00000000-0000-0000-0000-000000000001', 'The Barracks')
on conflict (id) do nothing;

insert into memberships (group_id, user_id)
select '00000000-0000-0000-0000-000000000001', id from profiles
on conflict do nothing;

-- 4. Tag every group-scoped table with group_id + an index, defaulting to the
--    seed group so existing inserts keep working unchanged. The FK is
--    'on delete no action' by design: a group can't be hard-deleted while its
--    history exists (Barracks deletion becomes a soft-delete workflow later).
do $$
declare t text;
begin
  foreach t in array array[
    'competitions','game_requests','radar_games','broadcasts',
    'complaints','trials','strikes','warnings','player_notes'
  ] loop
    execute format(
      'alter table %I add column if not exists group_id uuid references groups(id) '
      || 'default ''00000000-0000-0000-0000-000000000001'';', t);
    execute format(
      'update %I set group_id = ''00000000-0000-0000-0000-000000000001'' '
      || 'where group_id is null;', t);
    execute format('alter table %I alter column group_id set not null;', t);
    execute format(
      'create index if not exists %I on %I (group_id);', t || '_group_id_idx', t);
  end loop;
end $$;
