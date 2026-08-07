-- The Threeball — initial schema
-- Run in the Supabase SQL editor (or `supabase db push`).

-- ── Tables ────────────────────────────────────────────────────────────────

-- Players
create table if not exists profiles (
  id           uuid primary key references auth.users on delete cascade,
  name         text not null,
  nickname     text,                                   -- scorecard grid, max 4 chars
  avatar_url   text,
  handicap     numeric(3,1),
  home_course  text,
  colour       text not null default '#2F6B4C',        -- their ink colour across the app
  created_at   timestamptz default now()
);

-- Competitions
create table if not exists competitions (
  id           uuid primary key default gen_random_uuid(),
  created_by   uuid references profiles(id),
  title        text,                                   -- optional, e.g. "September Medal"
  course       text not null,
  date         date not null,                          -- bare date, no tz
  tee_time     time,                                   -- bare time, no tz
  holes        int not null default 9 check (holes in (9,18)),
  format       text not null check (format in ('stroke','skins','stableford')),
  stake        text,
  notes        text,
  par          int[],                                  -- length must equal holes; default all 4s
  stroke_index int[],                                  -- optional, for stableford
  status       text not null default 'upcoming' check (status in ('upcoming','played','cancelled')),
  created_at   timestamptz default now()
);

-- Availability
create table if not exists rsvps (
  competition_id uuid references competitions(id) on delete cascade,
  player_id      uuid references profiles(id) on delete cascade,
  status         text not null check (status in ('in','out','maybe')),
  note           text,
  updated_at     timestamptz default now(),
  primary key (competition_id, player_id)
);

-- Scores: one row per player per competition, strokes as an ordered array
create table if not exists scores (
  competition_id uuid references competitions(id) on delete cascade,
  player_id      uuid references profiles(id) on delete cascade,
  strokes        int[] not null,                       -- nulls allowed inside for unplayed holes
  updated_by     uuid references profiles(id),         -- who last kept the card
  updated_at     timestamptz default now(),
  primary key (competition_id, player_id)
);

create table if not exists comments (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid references competitions(id) on delete cascade,
  author_id      uuid references profiles(id),
  body           text not null,
  created_at     timestamptz default now()
);

create table if not exists photos (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid references competitions(id) on delete cascade,
  uploader_id    uuid references profiles(id),
  storage_path   text not null,
  caption        text,
  width          int,
  height         int,
  created_at     timestamptz default now()
);

-- One row per device, not per player.
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid references profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz default now()
);

create table if not exists notification_prefs (
  player_id       uuid primary key references profiles(id) on delete cascade,
  new_comp        boolean default true,
  rsvp_changes    boolean default false,
  comments        boolean default true,
  results         boolean default true,
  day_of          boolean default true,
  chase_undecided boolean default true
);

-- Idempotency ledger for scheduled sends (chase / day-of) so a cron retry can't double-send.
create table if not exists sent_notifications (
  competition_id uuid references competitions(id) on delete cascade,
  kind           text not null,                        -- 'chase' | 'dayof' | ...
  player_id      uuid references profiles(id) on delete cascade,
  sent_at        timestamptz default now(),
  primary key (competition_id, kind, player_id)
);

-- ── Row Level Security ────────────────────────────────────────────────────
-- All three players see everything. Read = signed in. Writes scoped where it matters.

alter table profiles            enable row level security;
alter table competitions        enable row level security;
alter table rsvps               enable row level security;
alter table scores              enable row level security;
alter table comments            enable row level security;
alter table photos              enable row level security;
alter table push_subscriptions  enable row level security;
alter table notification_prefs  enable row level security;
alter table sent_notifications  enable row level security;

-- Read: anyone signed in, everywhere.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','competitions','rsvps','scores','comments','photos',
    'push_subscriptions','notification_prefs','sent_notifications'
  ] loop
    execute format(
      'create policy %I on %I for select using (auth.uid() is not null);',
      t || '_read', t
    );
  end loop;
end $$;

-- profiles: a player edits only their own row.
create policy profiles_insert on profiles for insert with check (id = auth.uid());
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- competitions: anyone signed in can create/edit/cancel.
create policy competitions_insert on competitions for insert with check (auth.uid() is not null);
create policy competitions_update on competitions for update using (auth.uid() is not null);
create policy competitions_delete on competitions for delete using (auth.uid() is not null);

-- rsvps: a player edits only their own answer.
create policy rsvps_write on rsvps for insert with check (player_id = auth.uid());
create policy rsvps_update on rsvps for update using (player_id = auth.uid()) with check (player_id = auth.uid());
create policy rsvps_delete on rsvps for delete using (player_id = auth.uid());

-- scores: any player may enter anyone's scores (one person keeps the card). updated_by records who.
create policy scores_write on scores for insert with check (auth.uid() is not null);
create policy scores_update on scores for update using (auth.uid() is not null);

-- comments: anyone signed in can post; authors delete their own.
create policy comments_insert on comments for insert with check (author_id = auth.uid());
create policy comments_delete on comments for delete using (author_id = auth.uid());

-- photos: anyone signed in can upload; uploader deletes their own.
create policy photos_insert on photos for insert with check (uploader_id = auth.uid());
create policy photos_delete on photos for delete using (uploader_id = auth.uid());

-- push_subscriptions & notification_prefs: a player manages only their own.
create policy push_write  on push_subscriptions for insert with check (player_id = auth.uid());
create policy push_delete on push_subscriptions for delete using (player_id = auth.uid());
create policy prefs_write  on notification_prefs for insert with check (player_id = auth.uid());
create policy prefs_update on notification_prefs for update using (player_id = auth.uid()) with check (player_id = auth.uid());

-- sent_notifications is written by the service role (cron), which bypasses RLS.
-- No client write policy on purpose.

-- ── Storage ───────────────────────────────────────────────────────────────
-- Create the private 'photos' bucket and allow authenticated read.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "photos read authenticated"
  on storage.objects for select
  using (bucket_id = 'photos' and auth.uid() is not null);

create policy "photos insert authenticated"
  on storage.objects for insert
  with check (bucket_id = 'photos' and auth.uid() is not null);

create policy "photos delete authenticated"
  on storage.objects for delete
  using (bucket_id = 'photos' and auth.uid() is not null);

-- ── New-user bootstrap ────────────────────────────────────────────────────
-- Create a bare profile + default notification prefs when an auth user appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.notification_prefs (player_id)
  values (new.id)
  on conflict (player_id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
