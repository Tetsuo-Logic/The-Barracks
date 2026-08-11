-- 0030_group_scoped_rls.sql — Phase 3: group-scoped RLS + roles on memberships.
--
-- ⚠️ RUN ON STAGING FIRST. This rewrites Row-Level Security across the app.
-- Idempotent (drop-if-exists + create-or-replace), so safe to re-run while we
-- iterate. Reads become "you're a member of this row's group"; roles move onto
-- memberships. The old profiles.is_admin/is_president columns are KEPT and kept
-- in sync by a trigger, so the app (which still reads them) needs no changes yet.
-- Run after 0029.

-- ============================================================================
-- 1. Roles on memberships (per-group), backfilled from profiles.
-- ============================================================================
alter table memberships add column if not exists is_admin     boolean not null default false;
alter table memberships add column if not exists is_president  boolean not null default false;

update memberships m
   set is_admin = p.is_admin, is_president = p.is_president
  from profiles p
 where p.id = m.user_id;

-- Dual-run bridge: while the app still reads profiles.is_admin/is_president,
-- mirror any change onto the user's membership(s). (Single-group bridge; dropped
-- when multi-group UX makes memberships the sole source of truth.)
create or replace function public.sync_profile_roles_to_memberships()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update memberships
     set is_admin = new.is_admin, is_president = new.is_president
   where user_id = new.id;
  return new;
end $$;

drop trigger if exists sync_roles on profiles;
create trigger sync_roles
  after update of is_admin, is_president on profiles
  for each row execute function public.sync_profile_roles_to_memberships();

-- ============================================================================
-- 2. Group-aware helpers (SECURITY DEFINER: they read memberships without being
--    subject to its RLS, and are safe inside policies — no recursion).
-- ============================================================================
create or replace function public.is_member(gid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from memberships where group_id = gid and user_id = auth.uid());
$$;

create or replace function public.is_group_admin(gid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from memberships where group_id = gid and user_id = auth.uid() and is_admin);
$$;

create or replace function public.is_group_president(gid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from memberships where group_id = gid and user_id = auth.uid() and is_president);
$$;

-- Do the caller and `other` share at least one group? (profile visibility)
create or replace function public.shares_group(other uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from memberships m1
    join memberships m2 on m1.group_id = m2.group_id
    where m1.user_id = auth.uid() and m2.user_id = other
  );
$$;

grant execute on function
  public.is_member(uuid), public.is_group_admin(uuid),
  public.is_group_president(uuid), public.shares_group(uuid)
  to authenticated;

-- ============================================================================
-- 3. Tenancy scoping for the group tables themselves.
-- ============================================================================
drop policy if exists groups_read on groups;
create policy groups_read on groups for select using (public.is_member(id));

drop policy if exists memberships_read on memberships;
create policy memberships_read on memberships for select using (public.is_member(group_id));

-- ============================================================================
-- 4. Group-scoped ROOT tables: read = member; admin writes = group admin.
-- ============================================================================
-- competitions
drop policy if exists competitions_read on competitions;
create policy competitions_read on competitions for select using (public.is_member(group_id));
drop policy if exists competitions_insert on competitions;
create policy competitions_insert on competitions for insert with check (public.is_group_admin(group_id));
drop policy if exists competitions_update on competitions;
create policy competitions_update on competitions for update using (public.is_group_admin(group_id));
drop policy if exists competitions_delete on competitions;
create policy competitions_delete on competitions for delete using (public.is_group_admin(group_id));

-- broadcasts
drop policy if exists broadcasts_read on broadcasts;
create policy broadcasts_read on broadcasts for select using (public.is_member(group_id));
drop policy if exists broadcasts_insert on broadcasts;
create policy broadcasts_insert on broadcasts for insert with check (public.is_group_admin(group_id));
drop policy if exists broadcasts_delete on broadcasts;
create policy broadcasts_delete on broadcasts for delete using (public.is_group_admin(group_id));

-- strikes
drop policy if exists strikes_read on strikes;
create policy strikes_read on strikes for select using (public.is_member(group_id));
drop policy if exists strikes_insert on strikes;
create policy strikes_insert on strikes for insert with check (public.is_group_admin(group_id));
drop policy if exists strikes_delete on strikes;
create policy strikes_delete on strikes for delete using (public.is_group_admin(group_id));

-- warnings
drop policy if exists warnings_read on warnings;
create policy warnings_read on warnings for select using (public.is_member(group_id));
drop policy if exists warnings_insert on warnings;
create policy warnings_insert on warnings for insert with check (public.is_group_admin(group_id));
drop policy if exists warnings_delete on warnings;
create policy warnings_delete on warnings for delete using (public.is_group_admin(group_id));

-- player_notes (admin or president)
drop policy if exists player_notes_read on player_notes;
create policy player_notes_read on player_notes for select using (public.is_member(group_id));
drop policy if exists player_notes_write on player_notes;
create policy player_notes_write on player_notes for insert
  with check (public.is_group_admin(group_id) or public.is_group_president(group_id));
drop policy if exists player_notes_delete on player_notes;
create policy player_notes_delete on player_notes for delete
  using (public.is_group_admin(group_id) or public.is_group_president(group_id));

-- game_requests (any member files; admin acts; filer or admin removes)
drop policy if exists game_requests_read on game_requests;
create policy game_requests_read on game_requests for select using (public.is_member(group_id));
drop policy if exists game_requests_insert on game_requests;
create policy game_requests_insert on game_requests for insert
  with check (requested_by = auth.uid() and public.is_member(group_id));
drop policy if exists game_requests_update on game_requests;
create policy game_requests_update on game_requests for update
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
drop policy if exists game_requests_delete on game_requests;
create policy game_requests_delete on game_requests for delete
  using (requested_by = auth.uid() or public.is_group_admin(group_id));

-- radar_games (any member adds; adder or admin removes)
drop policy if exists radar_games_read on radar_games;
create policy radar_games_read on radar_games for select using (public.is_member(group_id));
drop policy if exists radar_games_insert on radar_games;
create policy radar_games_insert on radar_games for insert
  with check (added_by = auth.uid() and public.is_member(group_id));
drop policy if exists radar_games_delete on radar_games;
create policy radar_games_delete on radar_games for delete
  using (added_by = auth.uid() or public.is_group_admin(group_id));

-- complaints (any member files; admin/president/subject/second-opinion may update)
drop policy if exists complaints_read on complaints;
create policy complaints_read on complaints for select using (public.is_member(group_id));
drop policy if exists complaints_insert on complaints;
create policy complaints_insert on complaints for insert
  with check (filed_by = auth.uid() and public.is_member(group_id));
drop policy if exists complaints_update on complaints;
create policy complaints_update on complaints for update
  using (
    public.is_group_admin(group_id) or public.is_group_president(group_id)
    or against_id = auth.uid() or second_opinion_by = auth.uid()
  )
  with check (
    public.is_group_admin(group_id) or public.is_group_president(group_id)
    or against_id = auth.uid() or second_opinion_by = auth.uid()
  );

-- trials (admin convenes, or a player puts themselves up; subject/admin/president edit)
drop policy if exists trials_read on trials;
create policy trials_read on trials for select using (public.is_member(group_id));
drop policy if exists trials_insert on trials;
create policy trials_insert on trials for insert
  with check (public.is_group_admin(group_id) or (defendant_id = auth.uid() and public.is_member(group_id)));
drop policy if exists trials_update on trials;
create policy trials_update on trials for update
  using (defendant_id = auth.uid() or public.is_group_admin(group_id) or public.is_group_president(group_id))
  with check (defendant_id = auth.uid() or public.is_group_admin(group_id) or public.is_group_president(group_id));
drop policy if exists trials_delete on trials;
create policy trials_delete on trials for delete using (public.is_group_admin(group_id));

-- ============================================================================
-- 5. CHILD tables: scope through the parent's group_id.
-- ============================================================================
-- rsvps → competitions
drop policy if exists rsvps_read on rsvps;
create policy rsvps_read on rsvps for select
  using (public.is_member((select group_id from competitions c where c.id = competition_id)));
drop policy if exists rsvps_write on rsvps;
create policy rsvps_write on rsvps for insert
  with check (player_id = auth.uid()
    and public.is_member((select group_id from competitions c where c.id = competition_id)));
drop policy if exists rsvps_update on rsvps;
create policy rsvps_update on rsvps for update using (player_id = auth.uid()) with check (player_id = auth.uid());
drop policy if exists rsvps_delete on rsvps;
create policy rsvps_delete on rsvps for delete using (player_id = auth.uid());

-- scores → competitions (any member of the comp's group keeps the card)
drop policy if exists scores_read on scores;
create policy scores_read on scores for select
  using (public.is_member((select group_id from competitions c where c.id = competition_id)));
drop policy if exists scores_write on scores;
create policy scores_write on scores for insert
  with check (public.is_member((select group_id from competitions c where c.id = competition_id)));
drop policy if exists scores_update on scores;
create policy scores_update on scores for update
  using (public.is_member((select group_id from competitions c where c.id = competition_id)));

-- comments → competitions
drop policy if exists comments_read on comments;
create policy comments_read on comments for select
  using (public.is_member((select group_id from competitions c where c.id = competition_id)));
drop policy if exists comments_insert on comments;
create policy comments_insert on comments for insert
  with check (author_id = auth.uid()
    and public.is_member((select group_id from competitions c where c.id = competition_id)));
drop policy if exists comments_delete on comments;
create policy comments_delete on comments for delete
  using (author_id = auth.uid()
    or public.is_group_admin((select group_id from competitions c where c.id = competition_id)));

-- photos → competitions
drop policy if exists photos_read on photos;
create policy photos_read on photos for select
  using (public.is_member((select group_id from competitions c where c.id = competition_id)));
drop policy if exists photos_insert on photos;
create policy photos_insert on photos for insert
  with check (uploader_id = auth.uid()
    and public.is_member((select group_id from competitions c where c.id = competition_id)));
drop policy if exists photos_delete on photos;
create policy photos_delete on photos for delete using (uploader_id = auth.uid());

-- sent_notifications → competitions (read only; service role writes, bypasses RLS)
drop policy if exists sent_notifications_read on sent_notifications;
create policy sent_notifications_read on sent_notifications for select
  using (public.is_member((select group_id from competitions c where c.id = competition_id)));

-- trial_votes → trials
drop policy if exists trial_votes_read on trial_votes;
create policy trial_votes_read on trial_votes for select
  using (public.is_member((select group_id from trials t where t.id = trial_id)));
drop policy if exists trial_votes_write on trial_votes;
create policy trial_votes_write on trial_votes for insert
  with check (juror_id = auth.uid()
    and juror_id <> (select defendant_id from trials where id = trial_id)
    and public.is_member((select group_id from trials t where t.id = trial_id)));
drop policy if exists trial_votes_update on trial_votes;
create policy trial_votes_update on trial_votes for update using (juror_id = auth.uid()) with check (juror_id = auth.uid());

-- broadcast_responses → broadcasts
drop policy if exists broadcast_responses_read on broadcast_responses;
create policy broadcast_responses_read on broadcast_responses for select
  using (public.is_member((select group_id from broadcasts b where b.id = broadcast_id)));
drop policy if exists broadcast_responses_write on broadcast_responses;
create policy broadcast_responses_write on broadcast_responses for insert
  with check (player_id = auth.uid()
    and public.is_member((select group_id from broadcasts b where b.id = broadcast_id)));
drop policy if exists broadcast_responses_update on broadcast_responses;
create policy broadcast_responses_update on broadcast_responses for update using (player_id = auth.uid()) with check (player_id = auth.uid());

-- broadcast_messages → broadcasts
drop policy if exists broadcast_messages_read on broadcast_messages;
create policy broadcast_messages_read on broadcast_messages for select
  using (public.is_member((select group_id from broadcasts b where b.id = broadcast_id)));
drop policy if exists broadcast_messages_insert on broadcast_messages;
create policy broadcast_messages_insert on broadcast_messages for insert
  with check (author_id = auth.uid()
    and public.is_member((select group_id from broadcasts b where b.id = broadcast_id)));

-- radar_interest → radar_games
drop policy if exists radar_interest_read on radar_interest;
create policy radar_interest_read on radar_interest for select
  using (public.is_member((select group_id from radar_games r where r.id = radar_id)));
drop policy if exists radar_interest_insert on radar_interest;
create policy radar_interest_insert on radar_interest for insert
  with check (player_id = auth.uid()
    and public.is_member((select group_id from radar_games r where r.id = radar_id)));
drop policy if exists radar_interest_update on radar_interest;
create policy radar_interest_update on radar_interest for update using (player_id = auth.uid()) with check (player_id = auth.uid());

-- ============================================================================
-- 6. USER-scoped tables: your own identity/devices/prefs; profiles are visible
--    only to people who share a group with you.
-- ============================================================================
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select using (id = auth.uid() or public.shares_group(id));
-- (profiles_insert / profiles_update unchanged: id = auth.uid())

drop policy if exists push_subscriptions_read on push_subscriptions;
create policy push_subscriptions_read on push_subscriptions for select using (player_id = auth.uid());

drop policy if exists notification_prefs_read on notification_prefs;
create policy notification_prefs_read on notification_prefs for select using (player_id = auth.uid());

-- (app_settings stays global for now — per-group is Phase 4.)

-- ============================================================================
-- 7. Group-scope the President's ruling: gate on group role, stamp group_id.
-- ============================================================================
create or replace function public.president_rule(
  p_trial uuid, p_verdict text, p_penalty text, p_note text
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_defendant uuid; v_charge text; v_comp uuid; v_creator uuid; v_group uuid;
  v_caller uuid; v_note text; v_threshold int; v_warn_count int;
begin
  v_caller := auth.uid();
  select defendant_id, charge, competition_id, created_by, group_id
    into v_defendant, v_charge, v_comp, v_creator, v_group
  from trials where id = p_trial and status = 'open';
  if v_defendant is null then return null; end if;

  if not (public.is_group_admin(v_group) or public.is_group_president(v_group)) then
    raise exception 'Only the President can rule.';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');

  if p_verdict = 'guilty' then
    update trials set status='closed', verdict='guilty',
      penalty = case when p_penalty='strike' then 'strike' else 'warning' end, note = v_note
    where id = p_trial;

    if p_penalty = 'strike' then
      insert into strikes (player_id, reason, competition_id, created_by, group_id)
      values (v_defendant, 'Guilty in the Courtroom: ' || v_charge, v_comp, v_creator, v_group);
    else
      insert into warnings (player_id, reason, trial_id, created_by, group_id)
      values (v_defendant, 'Guilty in the Courtroom: ' || v_charge, p_trial, v_creator, v_group);

      select coalesce(warnings_per_strike, 3) into v_threshold from app_settings where id = 1;
      select count(*) into v_warn_count from warnings where player_id = v_defendant and group_id = v_group;
      if v_warn_count >= v_threshold then
        insert into strikes (player_id, reason, group_id)
        values (v_defendant, v_threshold || ' warnings add up to a strike', v_group);
        delete from warnings where player_id = v_defendant and group_id = v_group;
      end if;
    end if;

    if v_note is not null then
      insert into player_notes (player_id, note, trial_id, created_by, group_id)
      values (v_defendant, v_note, p_trial, v_caller, v_group);
    end if;
    return 'guilty';
  else
    update trials set status='closed', verdict='not_guilty', penalty=null, note=v_note where id = p_trial;
    if v_note is not null then
      insert into player_notes (player_id, note, trial_id, created_by, group_id)
      values (v_defendant, v_note, p_trial, v_caller, v_group);
    end if;
    return 'not_guilty';
  end if;
end $$;
grant execute on function public.president_rule(uuid, text, text, text) to authenticated;

-- NOTE: public.finalize_trial (the old unanimous-jury flow) is superseded by
-- president_rule and is no longer called by the app; left in place, unused.

-- ============================================================================
-- 8. Enrol new signups into the group (so RLS never locks them out).
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_admin boolean;
begin
  v_admin := new.email = 'paul.mikey.hyde@googlemail.com';

  insert into public.profiles (id, name, is_admin)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), v_admin)
  on conflict (id) do nothing;

  insert into public.notification_prefs (player_id)
  values (new.id) on conflict (player_id) do nothing;

  insert into public.memberships (group_id, user_id, is_admin, is_president)
  values ('00000000-0000-0000-0000-000000000001', new.id, v_admin, false)
  on conflict do nothing;

  return new;
end $$;
