-- Radar: a wishlist of games to get. Anyone can add one (title, optional release
-- date + note); everyone marks Interested / Not. Run after 0021.

create table if not exists radar_games (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  note         text,
  release_date date,
  added_by     uuid references profiles(id) on delete set null,
  created_at   timestamptz default now()
);

alter table radar_games enable row level security;

drop policy if exists radar_games_read on radar_games;
create policy radar_games_read on radar_games
  for select using (auth.uid() is not null);

drop policy if exists radar_games_insert on radar_games;
create policy radar_games_insert on radar_games
  for insert with check (added_by = auth.uid());

drop policy if exists radar_games_delete on radar_games;
create policy radar_games_delete on radar_games
  for delete using (added_by = auth.uid() or public.is_admin());

create table if not exists radar_interest (
  radar_id   uuid references radar_games(id) on delete cascade,
  player_id  uuid references profiles(id) on delete cascade,
  interested boolean not null,
  updated_at timestamptz default now(),
  primary key (radar_id, player_id)
);

alter table radar_interest enable row level security;

drop policy if exists radar_interest_read on radar_interest;
create policy radar_interest_read on radar_interest
  for select using (auth.uid() is not null);

drop policy if exists radar_interest_insert on radar_interest;
create policy radar_interest_insert on radar_interest
  for insert with check (player_id = auth.uid());

drop policy if exists radar_interest_update on radar_interest;
create policy radar_interest_update on radar_interest
  for update using (player_id = auth.uid()) with check (player_id = auth.uid());
