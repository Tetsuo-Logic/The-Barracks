-- The Barracks: multiple games, not just golf. Every competition now names a
-- game; only The Threeball Cup ('threeball') keeps the golf machinery. And any
-- player can request a game, which pings the CO to organise it. Run after 0019.

-- 1. Which game an op is. Existing rows are golf (the Threeball Cup).
alter table competitions add column if not exists game text not null default 'threeball';

-- 2. Non-golf ops have no course — make it optional. Golf still supplies one.
alter table competitions alter column course drop not null;

-- 3. Game requests: any player floats a game; the CO turns it into a poll/op.
create table if not exists game_requests (
  id           uuid primary key default gen_random_uuid(),
  requested_by uuid references profiles(id) on delete set null,
  game         text not null,
  note         text,
  status       text not null default 'open' check (status in ('open','planning','done','declined')),
  created_at   timestamptz default now()
);

alter table game_requests enable row level security;

-- Everyone signed in can see the requests board.
drop policy if exists game_requests_read on game_requests;
create policy game_requests_read on game_requests
  for select using (auth.uid() is not null);

-- You can only file a request as yourself.
drop policy if exists game_requests_insert on game_requests;
create policy game_requests_insert on game_requests
  for insert with check (requested_by = auth.uid());

-- Only the CO (admin) acts on a request (mark planning / done / declined).
drop policy if exists game_requests_update on game_requests;
create policy game_requests_update on game_requests
  for update using (public.is_admin())
  with check (public.is_admin());

-- The filer can withdraw their own; the CO can clear any.
drop policy if exists game_requests_delete on game_requests;
create policy game_requests_delete on game_requests
  for delete using (requested_by = auth.uid() or public.is_admin());
