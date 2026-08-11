-- 0038_musters.sql — the Captain's Muster (pre-week arrangement).
--
-- A Captain calls a Muster for the week ahead (candidate nights + proposed
-- times). Squad members tap which nights they can do. The Captain reads the
-- tally, picks the best night, and proposes it up to the President, who approves
-- → it deploys as a real Operation (competition) and roll call opens.
--
-- Muster = "when COULD we?" (soft, Captain-run). Roll call = "are you IN?"
-- (hard, post-approval). Additive, single-group. ⚠️ Staging first. After 0037.

create table if not exists musters (
  id             uuid primary key default gen_random_uuid(),
  squad_id       uuid not null references squads(id) on delete cascade,
  group_id       uuid not null references groups(id),
  game           text not null,
  created_by     uuid references profiles(id) on delete set null,
  status         text not null default 'open'
                   check (status in ('open','proposed','approved','cancelled')),
  dates          text[] not null default '{}',  -- candidate nights, 'YYYY-MM-DD'
  times          text[] not null default '{}',  -- proposed start times, 'HH:MM'
  note           text,
  chosen_date    text,                           -- set when the Captain proposes
  chosen_time    text,
  competition_id uuid references competitions(id) on delete set null,
  created_at     timestamptz default now()
);
create index if not exists musters_squad_idx on musters (squad_id);
alter table musters enable row level security;

-- Read: anyone in the Barracks. Write: the squad's Captain or the CO.
drop policy if exists musters_read on musters;
create policy musters_read on musters for select using (public.is_member(group_id));
drop policy if exists musters_insert on musters;
create policy musters_insert on musters for insert
  with check (public.is_squad_captain(squad_id) or public.is_group_admin(group_id));
drop policy if exists musters_update on musters;
create policy musters_update on musters for update
  using (public.is_squad_captain(squad_id) or public.is_group_admin(group_id))
  with check (public.is_squad_captain(squad_id) or public.is_group_admin(group_id));
drop policy if exists musters_delete on musters;
create policy musters_delete on musters for delete
  using (public.is_squad_captain(squad_id) or public.is_group_admin(group_id));

-- One response per member per muster: which candidate nights they can do.
create table if not exists muster_responses (
  muster_id       uuid references musters(id) on delete cascade,
  user_id         uuid references profiles(id) on delete cascade,
  available_dates text[] not null default '{}',
  updated_at      timestamptz default now(),
  primary key (muster_id, user_id)
);
alter table muster_responses enable row level security;

drop policy if exists mr_read on muster_responses;
create policy mr_read on muster_responses for select
  using (public.is_member((select group_id from musters where id = muster_id)));
-- Only a member of that squad may answer, and only for themselves.
drop policy if exists mr_insert on muster_responses;
create policy mr_insert on muster_responses for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from musters mu
      join squad_members sm on sm.squad_id = mu.squad_id
      where mu.id = muster_id and sm.user_id = auth.uid()
    )
  );
drop policy if exists mr_update on muster_responses;
create policy mr_update on muster_responses for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists mr_delete on muster_responses;
create policy mr_delete on muster_responses for delete using (user_id = auth.uid());
