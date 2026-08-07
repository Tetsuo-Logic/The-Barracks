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
