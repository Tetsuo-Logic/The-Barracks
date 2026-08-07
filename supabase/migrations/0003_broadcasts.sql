-- Ad-hoc broadcasts: the organiser pings the group any time, optionally as a
-- yes/no or an open question, and collects the answers. Run after 0002.

create table if not exists broadcasts (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid references profiles(id),
  kind        text not null check (kind in ('announce','yesno','ask')),
  title       text,
  body        text not null,
  created_at  timestamptz default now()
);

create table if not exists broadcast_responses (
  broadcast_id uuid references broadcasts(id) on delete cascade,
  player_id    uuid references profiles(id) on delete cascade,
  answer       text check (answer in ('yes','no')),  -- null for open questions
  comment      text,
  created_at   timestamptz default now(),
  primary key (broadcast_id, player_id)
);

alter table broadcasts          enable row level security;
alter table broadcast_responses enable row level security;

-- Everyone signed in can read both.
drop policy if exists broadcasts_read on broadcasts;
create policy broadcasts_read on broadcasts
  for select using (auth.uid() is not null);
drop policy if exists broadcast_responses_read on broadcast_responses;
create policy broadcast_responses_read on broadcast_responses
  for select using (auth.uid() is not null);

-- Only the organiser can send a broadcast.
drop policy if exists broadcasts_insert on broadcasts;
create policy broadcasts_insert on broadcasts
  for insert with check (public.is_admin());
drop policy if exists broadcasts_delete on broadcasts;
create policy broadcasts_delete on broadcasts
  for delete using (public.is_admin());

-- A player answers only for themselves.
drop policy if exists broadcast_responses_write on broadcast_responses;
create policy broadcast_responses_write on broadcast_responses
  for insert with check (player_id = auth.uid());
drop policy if exists broadcast_responses_update on broadcast_responses;
create policy broadcast_responses_update on broadcast_responses
  for update using (player_id = auth.uid()) with check (player_id = auth.uid());
