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

-- ==================== 0012_date_poll_times.sql ====================
-- Tee time per available date, chosen by each player. When a player ticks a
-- date they can make, they also say what tee-off time suits them that day.
-- Stored as a text[] of bare 'HH:MM' strings, index-aligned with
-- broadcast_responses.available_dates ('' = no time given). Run after 0011.

alter table broadcast_responses add column if not exists date_times text[];

-- ==================== 0013_inbox_seen.sql ====================
-- Notification bell / inbox: one "last looked" timestamp per player so we can
-- show a count of new comments since they last opened the inbox. Answered
-- questions and outstanding RSVPs are task-based (no timestamp needed); this is
-- only for informational activity that clears once seen. Run after 0012.
-- Defaults to now() so a new player has a baseline and never sees pre-existing
-- chatter as unread; existing players are backfilled the same way.

alter table profiles add column if not exists inbox_seen_at timestamptz default now();
update profiles set inbox_seen_at = now() where inbox_seen_at is null;

-- ==================== 0014_comp_images.sql ====================
-- One-off / named events: an optional title (already present) plus a banner
-- image. The image reuses the public 'avatars' bucket under a 'comps/' prefix,
-- so no new bucket is needed — only this column, which holds the public URL.
-- Run after 0013.

alter table competitions add column if not exists image_url text;

-- ==================== 0015_app_settings.sql ====================
-- App-wide settings: a single-row table for organiser-controlled globals. The
-- first use is "clear history" — a cutoff timestamp; the activity feed hides
-- anything older, for everyone. Non-destructive: the underlying rounds,
-- comments and messages stay put, they're just filtered from the feed. Run
-- after 0014.

create table if not exists app_settings (
  id                      int primary key default 1,
  activity_cleared_before timestamptz,
  check (id = 1)
);
insert into app_settings (id) values (1) on conflict do nothing;

alter table app_settings enable row level security;

drop policy if exists app_settings_read on app_settings;
create policy app_settings_read on app_settings
  for select using (auth.uid() is not null);

drop policy if exists app_settings_update on app_settings;
create policy app_settings_update on app_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- ==================== 0016_activity_notifs.sql ====================
-- Activity notifications: the organiser wants a push whenever the others do
-- something — accept a date, answer a poll. Those events now send a push gated
-- by the rsvp_changes preference. Default it on for new players, and switch it
-- on for the organiser without touching anyone else's choice. Run after 0015.

alter table notification_prefs alter column rsvp_changes set default true;

update notification_prefs
set rsvp_changes = true
where player_id in (select id from profiles where is_admin);

-- ==================== 0017_comment_admin_delete.sql ====================
-- Let the organiser delete any comment (for clearing out test chatter), on top
-- of the existing "authors delete their own". Run after 0016.

drop policy if exists comments_delete on comments;
create policy comments_delete on comments
  for delete using (author_id = auth.uid() or public.is_admin());

-- ==================== 0018_board_upgrades.sql ====================
-- Board upgrades: name who a complaint is about (they get pinged and can
-- respond), and let the president ask a chosen player for a second opinion
-- before ruling. Also a 'board' notification preference. Run after 0017.

alter table complaints add column if not exists against_id         uuid references profiles(id) on delete set null;
alter table complaints add column if not exists response           text;
alter table complaints add column if not exists response_at        timestamptz;
alter table complaints add column if not exists second_opinion_by       uuid references profiles(id) on delete set null;
alter table complaints add column if not exists second_opinion          text;
alter table complaints add column if not exists second_opinion_at       timestamptz;
alter table complaints add column if not exists second_opinion_to_court boolean;

drop policy if exists complaints_update on complaints;
create policy complaints_update on complaints
  for update
  using (
    public.is_admin() or public.is_president()
    or against_id = auth.uid() or second_opinion_by = auth.uid()
  )
  with check (
    public.is_admin() or public.is_president()
    or against_id = auth.uid() or second_opinion_by = auth.uid()
  );

alter table notification_prefs add column if not exists board boolean default true;

-- ==================== 0019_court_warnings.sql ====================
-- Courtroom verdicts can be a warning (lesser) or a strike. Each juror ticks
-- which when voting guilty; a strike needs both to agree, else it's a warning.
-- Warnings stack: every N (default 3) rolls into a strike. Run after 0018.

create table if not exists warnings (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid references profiles(id) on delete cascade,
  reason     text,
  trial_id   uuid references trials(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table warnings enable row level security;
drop policy if exists warnings_read on warnings;
create policy warnings_read on warnings for select using (auth.uid() is not null);
drop policy if exists warnings_insert on warnings;
create policy warnings_insert on warnings for insert with check (public.is_admin());
drop policy if exists warnings_delete on warnings;
create policy warnings_delete on warnings for delete using (public.is_admin());

alter table trial_votes add column if not exists penalty text check (penalty in ('strike','warning'));
alter table trials add column if not exists penalty text check (penalty in ('strike','warning'));
alter table app_settings add column if not exists warnings_per_strike int not null default 3;

create or replace function public.finalize_trial(p_trial uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_defendant   uuid;
  v_charge      text;
  v_jurors      int;
  v_votes       int;
  v_guilty      int;
  v_strike_vote int;
  v_penalty     text;
  v_threshold   int;
  v_warn_count  int;
begin
  select defendant_id, charge into v_defendant, v_charge
  from trials where id = p_trial and status = 'open';
  if v_defendant is null then return null; end if;

  select count(*) into v_jurors from profiles where id <> v_defendant;
  select count(*), count(*) filter (where vote = 'guilty')
    into v_votes, v_guilty
  from trial_votes where trial_id = p_trial;

  if v_jurors = 0 or v_votes < v_jurors then
    return null;
  end if;

  if v_guilty = v_jurors then
    select count(*) filter (where vote = 'guilty' and penalty = 'strike')
      into v_strike_vote
    from trial_votes where trial_id = p_trial;
    if v_strike_vote = v_jurors then v_penalty := 'strike'; else v_penalty := 'warning'; end if;

    update trials set status = 'closed', verdict = 'guilty', penalty = v_penalty
    where id = p_trial;

    if v_penalty = 'strike' then
      insert into strikes (player_id, reason, competition_id, created_by)
      select v_defendant, 'Guilty in the Courtroom: ' || v_charge, competition_id, created_by
      from trials where id = p_trial;
    else
      insert into warnings (player_id, reason, trial_id, created_by)
      select v_defendant, 'Guilty in the Courtroom: ' || v_charge, p_trial, created_by
      from trials where id = p_trial;

      select coalesce(warnings_per_strike, 3) into v_threshold from app_settings where id = 1;
      select count(*) into v_warn_count from warnings where player_id = v_defendant;
      if v_warn_count >= v_threshold then
        insert into strikes (player_id, reason)
        values (v_defendant, v_threshold || ' warnings add up to a strike');
        delete from warnings where player_id = v_defendant;
      end if;
    end if;

    return 'guilty';
  else
    update trials set status = 'closed', verdict = 'not_guilty' where id = p_trial;
    return 'not_guilty';
  end if;
end $$;

grant execute on function public.finalize_trial(uuid) to authenticated;

-- ============================================================
-- 0020_games.sql — multiple games + game requests. Idempotent.
-- ============================================================

alter table competitions add column if not exists game text not null default 'threeball';
alter table competitions alter column course drop not null;

create table if not exists game_requests (
  id           uuid primary key default gen_random_uuid(),
  requested_by uuid references profiles(id) on delete set null,
  game         text not null,
  note         text,
  status       text not null default 'open' check (status in ('open','planning','done','declined')),
  created_at   timestamptz default now()
);

alter table game_requests enable row level security;

drop policy if exists game_requests_read on game_requests;
create policy game_requests_read on game_requests
  for select using (auth.uid() is not null);

drop policy if exists game_requests_insert on game_requests;
create policy game_requests_insert on game_requests
  for insert with check (requested_by = auth.uid());

drop policy if exists game_requests_update on game_requests;
create policy game_requests_update on game_requests
  for update using (public.is_admin())
  with check (public.is_admin());

drop policy if exists game_requests_delete on game_requests;
create policy game_requests_delete on game_requests
  for delete using (requested_by = auth.uid() or public.is_admin());

-- ============================================================
-- 0021_custom_games.sql — CO-editable games list on app_settings.
-- ============================================================

alter table app_settings add column if not exists games jsonb;
insert into app_settings (id) values (1) on conflict (id) do nothing;
update app_settings
set games = '[
  {"id":"threeball","name":"The Threeball Cup","emoji":"⛳","hasScorecard":true},
  {"id":"cod","name":"COD","emoji":"🎮","hasScorecard":false},
  {"id":"showdown","name":"Showdown","emoji":"🕹️","hasScorecard":false},
  {"id":"fifa","name":"FIFA","emoji":"⚽","hasScorecard":false},
  {"id":"gta","name":"GTA","emoji":"🚗","hasScorecard":false}
]'::jsonb
where id = 1 and games is null;

-- ============================================================
-- 0022_radar.sql — games wishlist + interested/not.
-- ============================================================

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
create policy radar_games_read on radar_games for select using (auth.uid() is not null);
drop policy if exists radar_games_insert on radar_games;
create policy radar_games_insert on radar_games for insert with check (added_by = auth.uid());
drop policy if exists radar_games_delete on radar_games;
create policy radar_games_delete on radar_games for delete using (added_by = auth.uid() or public.is_admin());

create table if not exists radar_interest (
  radar_id   uuid references radar_games(id) on delete cascade,
  player_id  uuid references profiles(id) on delete cascade,
  interested boolean not null,
  updated_at timestamptz default now(),
  primary key (radar_id, player_id)
);
alter table radar_interest enable row level security;
drop policy if exists radar_interest_read on radar_interest;
create policy radar_interest_read on radar_interest for select using (auth.uid() is not null);
drop policy if exists radar_interest_insert on radar_interest;
create policy radar_interest_insert on radar_interest for insert with check (player_id = auth.uid());
drop policy if exists radar_interest_update on radar_interest;
create policy radar_interest_update on radar_interest for update using (player_id = auth.uid()) with check (player_id = auth.uid());

-- ============================================================
-- 0023_cancel_reason.sql — cancel a fixture with a reason.
-- ============================================================
alter table competitions add column if not exists cancel_reason text;

-- ============================================================
-- 0024_radar_trailer.sql — optional trailer link on radar games.
-- ============================================================
alter table radar_games add column if not exists youtube_url text;

-- ============================================================
-- 0025_broadcast_messages.sql — reply thread on pings.
-- ============================================================
create table if not exists broadcast_messages (
  id           uuid primary key default gen_random_uuid(),
  broadcast_id uuid references broadcasts(id) on delete cascade,
  author_id    uuid references profiles(id) on delete set null,
  body         text not null,
  created_at   timestamptz default now()
);
alter table broadcast_messages enable row level security;
drop policy if exists broadcast_messages_read on broadcast_messages;
create policy broadcast_messages_read on broadcast_messages for select using (auth.uid() is not null);
drop policy if exists broadcast_messages_insert on broadcast_messages;
create policy broadcast_messages_insert on broadcast_messages for insert with check (author_id = auth.uid());

-- ============================================================
-- 0026_radar_platform.sql — platform on radar games.
-- ============================================================
alter table radar_games add column if not exists platform text;

-- ============================================================
-- 0027_request_details.sql — availability window + player count on requests.
-- ============================================================
alter table game_requests add column if not exists available_from date;
alter table game_requests add column if not exists available_to   date;
alter table game_requests add column if not exists min_players     int;
alter table game_requests add column if not exists max_players     int;

-- ============================================================
-- 0028_court_president.sql — President judges; jury advisory; player notes.
-- ============================================================
create table if not exists player_notes (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid references profiles(id) on delete cascade,
  note       text not null,
  trial_id   uuid references trials(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table player_notes enable row level security;
drop policy if exists player_notes_read on player_notes;
create policy player_notes_read on player_notes for select using (auth.uid() is not null);
drop policy if exists player_notes_write on player_notes;
create policy player_notes_write on player_notes
  for insert with check (public.is_admin() or public.is_president());
drop policy if exists player_notes_delete on player_notes;
create policy player_notes_delete on player_notes
  for delete using (public.is_admin() or public.is_president());

alter table trials add column if not exists jury_opened boolean not null default false;
alter table trials add column if not exists note text;

drop policy if exists trials_update on trials;
create policy trials_update on trials
  for update using (defendant_id = auth.uid() or public.is_admin() or public.is_president())
  with check (defendant_id = auth.uid() or public.is_admin() or public.is_president());

create or replace function public.president_rule(
  p_trial   uuid,
  p_verdict text,
  p_penalty text,
  p_note    text
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_defendant  uuid;
  v_charge     text;
  v_comp       uuid;
  v_creator    uuid;
  v_caller     uuid;
  v_note       text;
  v_threshold  int;
  v_warn_count int;
begin
  v_caller := auth.uid();
  if not (public.is_admin() or public.is_president()) then
    raise exception 'Only the President can rule.';
  end if;

  select defendant_id, charge, competition_id, created_by
    into v_defendant, v_charge, v_comp, v_creator
  from trials where id = p_trial and status = 'open';
  if v_defendant is null then return null; end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');

  if p_verdict = 'guilty' then
    update trials
      set status  = 'closed',
          verdict = 'guilty',
          penalty = case when p_penalty = 'strike' then 'strike' else 'warning' end,
          note    = v_note
    where id = p_trial;

    if p_penalty = 'strike' then
      insert into strikes (player_id, reason, competition_id, created_by)
      values (v_defendant, 'Guilty in the Courtroom: ' || v_charge, v_comp, v_creator);
    else
      insert into warnings (player_id, reason, trial_id, created_by)
      values (v_defendant, 'Guilty in the Courtroom: ' || v_charge, p_trial, v_creator);

      select coalesce(warnings_per_strike, 3) into v_threshold from app_settings where id = 1;
      select count(*) into v_warn_count from warnings where player_id = v_defendant;
      if v_warn_count >= v_threshold then
        insert into strikes (player_id, reason)
        values (v_defendant, v_threshold || ' warnings add up to a strike');
        delete from warnings where player_id = v_defendant;
      end if;
    end if;

    if v_note is not null then
      insert into player_notes (player_id, note, trial_id, created_by)
      values (v_defendant, v_note, p_trial, v_caller);
    end if;

    return 'guilty';
  else
    update trials
      set status  = 'closed',
          verdict = 'not_guilty',
          penalty = null,
          note    = v_note
    where id = p_trial;

    if v_note is not null then
      insert into player_notes (player_id, note, trial_id, created_by)
      values (v_defendant, v_note, p_trial, v_caller);
    end if;

    return 'not_guilty';
  end if;
end $$;

grant execute on function public.president_rule(uuid, text, text, text) to authenticated;

-- ============================================================
-- 0029_multitenant_model.sql — Phase 2: additive multi-tenant data model.
-- RLS UNCHANGED, roles stay on profiles, app untouched → identical behaviour.
-- ============================================================
create table if not exists groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);
alter table groups enable row level security;
drop policy if exists groups_read on groups;
create policy groups_read on groups for select using (auth.uid() is not null);

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

insert into groups (id, name)
values ('00000000-0000-0000-0000-000000000001', 'The Barracks')
on conflict (id) do nothing;

insert into memberships (group_id, user_id)
select '00000000-0000-0000-0000-000000000001', id from profiles
on conflict do nothing;

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
