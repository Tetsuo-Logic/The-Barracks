-- ============================================================
-- Run once in the Supabase SQL editor, AFTER 0001_init.sql.
-- Applies 0002-0011. Fully idempotent — safe to re-run.
-- ============================================================

-- ==================== 0002_admin.sql ====================
-- Organiser model: one admin (Paul) creates/edits dates; the others only RSVP.
-- Run this in the Supabase SQL editor after 0001.

-- 1. Flag on profiles.
alter table profiles add column if not exists is_admin boolean not null default false;

-- 2. Make Paul the organiser. (Edit the email if yours differs.)
update profiles p
set is_admin = true
from auth.users u
where u.id = p.id
  and u.email = 'paul.mikey.hyde@googlemail.com';

-- 3. Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- 4. Restrict competition writes to admins (replace the open policies from 0001).
drop policy if exists competitions_insert on competitions;
drop policy if exists competitions_update on competitions;
drop policy if exists competitions_delete on competitions;

create policy competitions_insert on competitions
  for insert with check (public.is_admin());
create policy competitions_update on competitions
  for update using (public.is_admin());
create policy competitions_delete on competitions
  for delete using (public.is_admin());

-- ==================== 0003_broadcasts.sql ====================
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

-- ==================== 0004_strikes.sql ====================
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

-- ==================== 0005_courtroom.sql ====================
-- The Courtroom: when someone who said they'd turn up flakes, the organiser
-- convenes a trial. The accused enters a defence; the other players are the
-- jury. Unanimous guilty → an automatic strike. Run after 0004.

create table if not exists trials (
  id             uuid primary key default gen_random_uuid(),
  defendant_id   uuid references profiles(id) on delete cascade,
  competition_id uuid references competitions(id) on delete set null,
  charge         text not null,
  defence        text,
  status         text not null default 'open' check (status in ('open','closed')),
  verdict        text check (verdict in ('guilty','not_guilty')),
  created_by     uuid references profiles(id),
  created_at     timestamptz default now()
);

create table if not exists trial_votes (
  trial_id   uuid references trials(id) on delete cascade,
  juror_id   uuid references profiles(id) on delete cascade,
  vote       text not null check (vote in ('guilty','not_guilty')),
  comment    text,
  created_at timestamptz default now(),
  primary key (trial_id, juror_id)
);

alter table trials      enable row level security;
alter table trial_votes enable row level security;

drop policy if exists trials_read on trials;
create policy trials_read on trials for select using (auth.uid() is not null);
drop policy if exists trial_votes_read on trial_votes;
create policy trial_votes_read on trial_votes for select using (auth.uid() is not null);

-- Organiser convenes; the accused (or organiser) can edit the defence.
drop policy if exists trials_insert on trials;
create policy trials_insert on trials for insert with check (public.is_admin());
drop policy if exists trials_update on trials;
create policy trials_update on trials
  for update using (defendant_id = auth.uid() or public.is_admin())
  with check (defendant_id = auth.uid() or public.is_admin());
drop policy if exists trials_delete on trials;
create policy trials_delete on trials for delete using (public.is_admin());

-- A juror casts only their own vote, and can't judge their own case.
drop policy if exists trial_votes_write on trial_votes;
create policy trial_votes_write on trial_votes
  for insert with check (
    juror_id = auth.uid()
    and juror_id <> (select defendant_id from trials where id = trial_id)
  );
drop policy if exists trial_votes_update on trial_votes;
create policy trial_votes_update on trial_votes
  for update using (juror_id = auth.uid()) with check (juror_id = auth.uid());

-- Close the trial once every juror has voted, and add a strike if the verdict
-- is unanimous guilty. SECURITY DEFINER so it may write strikes (organiser-only
-- table) on behalf of a juror's vote.
create or replace function public.finalize_trial(p_trial uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_defendant uuid;
  v_charge    text;
  v_jurors    int;
  v_votes     int;
  v_guilty    int;
begin
  select defendant_id, charge into v_defendant, v_charge
  from trials where id = p_trial and status = 'open';
  if v_defendant is null then return null; end if;

  select count(*) into v_jurors from profiles where id <> v_defendant;
  select count(*), count(*) filter (where vote = 'guilty')
    into v_votes, v_guilty
  from trial_votes where trial_id = p_trial;

  if v_jurors = 0 or v_votes < v_jurors then
    return null; -- not everyone has voted yet
  end if;

  if v_guilty = v_jurors then
    update trials set status = 'closed', verdict = 'guilty' where id = p_trial;
    insert into strikes (player_id, reason, competition_id, created_by)
    select v_defendant, 'Guilty in the Courtroom: ' || v_charge, competition_id, created_by
    from trials where id = p_trial;
    return 'guilty';
  else
    update trials set status = 'closed', verdict = 'not_guilty' where id = p_trial;
    return 'not_guilty';
  end if;
end $$;

grant execute on function public.finalize_trial(uuid) to authenticated;

-- ==================== 0006_cup.sql ====================
-- Split competitions into the Threeball Cup (ranked) and casual, non-cup
-- rounds. Standings show the two separately. Run after 0005.

alter table competitions
  add column if not exists for_cup boolean not null default true;

-- ==================== 0007_self_trial.sql ====================
-- Allow a player to put themselves on trial — used when they back out of a
-- competition they'd committed to (the strike hearing). The organiser can
-- still convene against anyone. Run after 0006.

drop policy if exists trials_insert on trials;
create policy trials_insert on trials
  for insert with check (public.is_admin() or defendant_id = auth.uid());

-- ==================== 0008_password_auth.sql ====================
-- Support the switch to email + password sign-in. Run after 0007.
-- (a) Deleting a player no longer blocks on the things they created — those
--     references just go null. Lets you wipe old test accounts for a clean start.
-- (b) The president (Paul) is auto-flagged admin whenever the profile is created,
--     so recreating the account keeps the crown.

alter table competitions drop constraint if exists competitions_created_by_fkey;
alter table competitions add constraint competitions_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table scores drop constraint if exists scores_updated_by_fkey;
alter table scores add constraint scores_updated_by_fkey
  foreign key (updated_by) references profiles(id) on delete set null;

alter table comments drop constraint if exists comments_author_id_fkey;
alter table comments add constraint comments_author_id_fkey
  foreign key (author_id) references profiles(id) on delete set null;

alter table photos drop constraint if exists photos_uploader_id_fkey;
alter table photos add constraint photos_uploader_id_fkey
  foreign key (uploader_id) references profiles(id) on delete set null;

alter table broadcasts drop constraint if exists broadcasts_created_by_fkey;
alter table broadcasts add constraint broadcasts_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table strikes drop constraint if exists strikes_created_by_fkey;
alter table strikes add constraint strikes_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table trials drop constraint if exists trials_created_by_fkey;
alter table trials add constraint trials_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

-- Auto-crown the president on profile creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email = 'paul.mikey.hyde@googlemail.com'
  )
  on conflict (id) do nothing;

  insert into public.notification_prefs (player_id)
  values (new.id)
  on conflict (player_id) do nothing;

  return new;
end $$;

-- ==================== 0009_board.sql ====================
-- The board: complaints any player can file (reason / action / comment) that
-- must be ruled on by the President. The President is a nameable title, separate
-- from the admin/owner (who keeps every power). Run after 0008.

-- President title (separate from is_admin).
alter table profiles add column if not exists is_president boolean not null default false;

-- Default the president to Paul until he hands it over.
update profiles p set is_president = true
from auth.users u
where u.id = p.id and u.email = 'paul.mikey.hyde@googlemail.com';

-- Is the current user the sitting President?
create or replace function public.is_president()
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce((select is_president from profiles where id = auth.uid()), false);
$$;

create table if not exists complaints (
  id           uuid primary key default gen_random_uuid(),
  filed_by     uuid references profiles(id) on delete set null,
  reason       text not null,
  action       text,                         -- the action being requested
  comment      text,
  status       text not null default 'open' check (status in ('open','addressed')),
  ruling       text,                         -- the President's response
  addressed_by uuid references profiles(id) on delete set null,
  created_at   timestamptz default now(),
  addressed_at timestamptz
);

alter table complaints enable row level security;

drop policy if exists complaints_read on complaints;
create policy complaints_read on complaints
  for select using (auth.uid() is not null);

drop policy if exists complaints_insert on complaints;
create policy complaints_insert on complaints
  for insert with check (filed_by = auth.uid());

-- Only the President (or the admin) can rule on a complaint.
drop policy if exists complaints_update on complaints;
create policy complaints_update on complaints
  for update using (public.is_admin() or public.is_president())
  with check (public.is_admin() or public.is_president());

-- ==================== 0010_avatars.sql ====================
-- Profile photos: a public 'avatars' bucket so the URL is stable and shows
-- everywhere (scorecard, RSVP, jury) without signing. Run after 0009.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars read" on storage.objects;
create policy "avatars read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars insert" on storage.objects;
create policy "avatars insert" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid() is not null);

drop policy if exists "avatars update" on storage.objects;
create policy "avatars update" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid() is not null);

-- ==================== 0011_date_polls.sql ====================
-- "Dates" question type: the organiser offers a few candidate dates and
-- everyone ticks which they can make, so you find the day that suits the most.
-- Run after 0010.

alter table broadcasts drop constraint if exists broadcasts_kind_check;
alter table broadcasts add constraint broadcasts_kind_check
  check (kind in ('announce','yesno','ask','dates'));

alter table broadcasts add column if not exists option_dates date[];
alter table broadcast_responses add column if not exists available_dates date[];
