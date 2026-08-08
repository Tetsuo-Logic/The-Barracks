-- Courtroom verdicts can now be a warning (lesser) or a strike. Each juror
-- ticks which when they vote guilty; a strike needs both to agree, otherwise
-- it's a warning. Warnings stack: every N (default 3) rolls into a strike.
-- Run after 0018.

-- Lesser penalty, mirrors strikes.
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

-- Each juror's chosen penalty (only meaningful on a guilty vote).
alter table trial_votes add column if not exists penalty text check (penalty in ('strike','warning'));

-- The trial's outcome penalty, once decided.
alter table trials add column if not exists penalty text check (penalty in ('strike','warning'));

-- How many warnings roll into a strike.
alter table app_settings add column if not exists warnings_per_strike int not null default 3;

-- Finalize: on unanimous guilty, a strike only if every juror ticked 'strike';
-- otherwise a warning, which may tip the player over the threshold into a strike.
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
    return null; -- not everyone has voted yet
  end if;

  if v_guilty = v_jurors then
    -- A strike needs unanimous 'strike'; any 'warning' (or unticked) → warning.
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

      -- Roll warnings into a strike at the threshold, then reset them.
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
