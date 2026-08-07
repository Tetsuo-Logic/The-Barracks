-- Strikes: the organiser marks a player who said they'd turn up and didn't.
-- One row per strike so there's a history and a reason. Run after 0003.

create table if not exists strikes (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid references profiles(id) on delete cascade,
  reason         text,
  competition_id uuid references competitions(id) on delete set null,
  created_by     uuid references profiles(id),
  created_at     timestamptz default now()
);

alter table strikes enable row level security;

-- Everyone sees the shame; only the organiser gives (or rescinds) a strike.
drop policy if exists strikes_read on strikes;
create policy strikes_read on strikes
  for select using (auth.uid() is not null);
drop policy if exists strikes_insert on strikes;
create policy strikes_insert on strikes
  for insert with check (public.is_admin());
drop policy if exists strikes_delete on strikes;
create policy strikes_delete on strikes
  for delete using (public.is_admin());
