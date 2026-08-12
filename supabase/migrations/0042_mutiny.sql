-- 0042_mutiny.sql — a motion against the President.
--
-- Ordinary complaints can't touch the President (they'd be judge and defendant).
-- Instead any member may raise a MUTINY: they state their case, the ranks vote
-- agree/stand-by in secret, and the President cannot see any of it while the
-- vote runs. Carried → the raiser nominates an impartial judge and it opens as a
-- court case with the President as defendant. Failed → it collapses, and the
-- President is told the complaint *and* who raised it.
--
-- Secrecy is enforced by RLS here, not in the UI: the target simply cannot
-- select a 'voting' row. Every write goes through a SECURITY DEFINER function,
-- so there are deliberately no insert/update policies.
-- Additive, single-group. ⚠️ Staging first. After 0041.

-- A trial may have a nominated judge — set only for mutiny cases, where the
-- President is the defendant and therefore must not rule.
alter table trials add column if not exists judge_id uuid references profiles(id) on delete set null;

create table if not exists mutinies (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references groups(id),
  raised_by      uuid references profiles(id) on delete set null,
  target_id      uuid references profiles(id) on delete set null, -- the President at the time
  reason         text not null,
  status         text not null default 'voting'
                   check (status in ('voting','carried','failed')),
  agree_count    int not null default 0,
  against_count  int not null default 0,
  eligible_count int not null default 0,   -- everyone bar the President
  judge_id       uuid references profiles(id) on delete set null,
  trial_id       uuid references trials(id) on delete set null,
  resolved_at    timestamptz,
  created_at     timestamptz default now()
);
create index if not exists mutinies_group_idx on mutinies (group_id, status);
alter table mutinies enable row level security;

-- Who may see a mutiny, by state:
--   voting  → everyone in the Barracks EXCEPT the President it targets
--   carried → everyone (it's a court case now)
--   failed  → only the President and the one who raised it
drop policy if exists mutinies_read on mutinies;
create policy mutinies_read on mutinies for select using (
  public.is_member(group_id) and (
    (status = 'voting' and auth.uid() is distinct from target_id)
    or status = 'carried'
    or (status = 'failed' and (auth.uid() = target_id or auth.uid() = raised_by))
  )
);

-- The raiser can withdraw; the CO can clear a resolved one. Never a live vote.
drop policy if exists mutinies_delete on mutinies;
create policy mutinies_delete on mutinies for delete using (
  raised_by = auth.uid()
  or (public.is_group_admin(group_id) and status <> 'voting')
);

-- Individual votes are secret forever — you can only ever read your own. The
-- tally lives denormalised on the mutiny row.
create table if not exists mutiny_votes (
  mutiny_id  uuid references mutinies(id) on delete cascade,
  voter_id   uuid references profiles(id) on delete cascade,
  agree      boolean not null,
  created_at timestamptz default now(),
  primary key (mutiny_id, voter_id)
);
alter table mutiny_votes enable row level security;
drop policy if exists mutiny_votes_read on mutiny_votes;
create policy mutiny_votes_read on mutiny_votes for select using (voter_id = auth.uid());

-- Cast (or change) a vote, then resolve the moment it's mathematically decided
-- so a motion can't hang waiting on someone who never votes.
create or replace function public.cast_mutiny_vote(p_mutiny uuid, p_agree boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid; v_group uuid; v_target uuid; v_status text;
  v_eligible int; v_agree int; v_against int;
begin
  v_caller := auth.uid();
  select group_id, target_id, status, eligible_count
    into v_group, v_target, v_status, v_eligible
    from mutinies where id = p_mutiny;
  if v_group is null then raise exception 'Mutiny not found.'; end if;
  if v_status <> 'voting' then raise exception 'That vote is closed.'; end if;
  if not public.is_member(v_group) then raise exception 'Not your Barracks.'; end if;
  if v_caller = v_target then raise exception 'The President does not get a vote.'; end if;

  insert into mutiny_votes (mutiny_id, voter_id, agree)
  values (p_mutiny, v_caller, p_agree)
  on conflict (mutiny_id, voter_id) do update set agree = p_agree;

  select count(*) filter (where agree), count(*) filter (where not agree)
    into v_agree, v_against from mutiny_votes where mutiny_id = p_mutiny;

  update mutinies set agree_count = v_agree, against_count = v_against where id = p_mutiny;

  -- Majority of everyone eligible, not merely of those who bothered.
  if v_agree * 2 > v_eligible then
    update mutinies set status = 'carried', resolved_at = now() where id = p_mutiny;
    return 'carried';
  elsif v_against * 2 > v_eligible then
    update mutinies set status = 'failed', resolved_at = now() where id = p_mutiny;
    return 'failed';
  end if;
  return 'voting';
end $$;
grant execute on function public.cast_mutiny_vote(uuid, boolean) to authenticated;

-- Raise a motion against the sitting President. The raiser backs their own.
create or replace function public.raise_mutiny(p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_caller uuid; v_group uuid; v_target uuid; v_id uuid; v_eligible int;
begin
  v_caller := auth.uid();
  if nullif(btrim(coalesce(p_reason,'')), '') is null then
    raise exception 'State your case.';
  end if;
  select group_id into v_group from memberships where user_id = v_caller limit 1;
  if v_group is null then raise exception 'No Barracks found.'; end if;

  select user_id into v_target
    from memberships where group_id = v_group and is_president limit 1;
  if v_target is null then raise exception 'There is no President to move against.'; end if;
  if v_target = v_caller then raise exception 'You cannot move against yourself.'; end if;
  if exists (select 1 from mutinies where group_id = v_group and status = 'voting') then
    raise exception 'A motion is already before the ranks.';
  end if;

  select greatest(count(*) - 1, 1) into v_eligible
    from memberships where group_id = v_group;

  insert into mutinies (group_id, raised_by, target_id, reason, eligible_count)
  values (v_group, v_caller, v_target, btrim(p_reason), v_eligible)
  returning id into v_id;

  perform public.cast_mutiny_vote(v_id, true);
  return v_id;
end $$;
grant execute on function public.raise_mutiny(text) to authenticated;

-- Carried → name an impartial judge and open the case. The President is the
-- defendant and is locked out of ruling by president_rule below.
create or replace function public.nominate_mutiny_judge(p_mutiny uuid, p_judge uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_caller uuid; v_m mutinies%rowtype; v_trial uuid;
begin
  v_caller := auth.uid();
  select * into v_m from mutinies where id = p_mutiny;
  if v_m.id is null then raise exception 'Mutiny not found.'; end if;
  if v_m.raised_by <> v_caller then raise exception 'Only the one who raised it names the judge.'; end if;
  if v_m.status <> 'carried' then raise exception 'The vote has not carried.'; end if;
  if v_m.trial_id is not null then raise exception 'Already before the court.'; end if;
  if p_judge = v_m.target_id or p_judge = v_caller then raise exception 'Name someone impartial.'; end if;
  if not exists (select 1 from memberships where group_id = v_m.group_id and user_id = p_judge) then
    raise exception 'They are not in this Barracks.';
  end if;

  insert into trials (defendant_id, charge, created_by, group_id, judge_id)
  values (v_m.target_id, v_m.reason, v_caller, v_m.group_id, p_judge)
  returning id into v_trial;

  update mutinies set judge_id = p_judge, trial_id = v_trial where id = p_mutiny;
  return v_trial;
end $$;
grant execute on function public.nominate_mutiny_judge(uuid, uuid) to authenticated;

-- Re-gate ruling: a case with a nominated judge is theirs alone — the President
-- (and CO) are locked out, since the case is against them. Everything else is
-- unchanged from 0030.
create or replace function public.president_rule(
  p_trial uuid, p_verdict text, p_penalty text, p_note text
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_defendant uuid; v_charge text; v_comp uuid; v_creator uuid; v_group uuid;
  v_caller uuid; v_note text; v_threshold int; v_warn_count int; v_judge uuid;
begin
  v_caller := auth.uid();
  select defendant_id, charge, competition_id, created_by, group_id, judge_id
    into v_defendant, v_charge, v_comp, v_creator, v_group, v_judge
  from trials where id = p_trial and status = 'open';
  if v_defendant is null then return null; end if;

  if v_judge is not null then
    if v_caller is distinct from v_judge then
      raise exception 'Only the nominated judge can rule on this case.';
    end if;
  elsif not (public.is_group_admin(v_group) or public.is_group_president(v_group)) then
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
