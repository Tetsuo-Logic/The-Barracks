-- Courtroom, restructured: the President is the judge, not a unanimous jury.
-- The accuser states the charge, the accused enters a plea, then it's presented
-- to the President — who rules Guilty (→ warning or strike) or Not guilty (→
-- case dismissed, or the behaviour is noted on the player's record). The jury is
-- now optional and advisory: the President may ask everyone for a guilty /
-- not-guilty steer, but the call — and the penalty — stays theirs. Run after 0027.

-- 1. Soft record: behaviour noted without a penalty. Lighter than a warning.
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

-- 2. Trial gains: did the President consult the jury, and a note field that
--    doubles as the verdict caption ("behaviour noted").
alter table trials add column if not exists jury_opened boolean not null default false;
alter table trials add column if not exists note text;

-- The President (not just admin/defendant) can update a trial — e.g. call the
-- jury by flipping jury_opened.
drop policy if exists trials_update on trials;
create policy trials_update on trials
  for update using (defendant_id = auth.uid() or public.is_admin() or public.is_president())
  with check (defendant_id = auth.uid() or public.is_admin() or public.is_president());

-- 3. The President's ruling. SECURITY DEFINER so a non-admin President can still
--    write the (admin-only) strikes/warnings tables. It gates on caller = admin
--    or president, closes the trial, and applies the outcome:
--      guilty  + strike  → a strike
--      guilty  + warning → a warning (rolls into a strike at the threshold)
--      not guilty        → closed; if a note was given, it lands on the player.
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
