-- The confirmation window.
--
-- Saying "I can do Thursday" at muster is not the same as turning up, and a
-- roster full of people who never acknowledged the deployment is how an
-- organised night becomes a last-minute scramble. So a deployed Operation
-- carries a deadline: everyone carried across from the muster has 24 hours
-- from the President deploying it to confirm.
--
-- Miss it and you come off the roster. You can still get back on, but a
-- Captain or the President has to let you — late but approved. That's the
-- point: the minimum strength a squad asked for at muster only means something
-- if the roster reflects people who have actually committed.
--
-- Nothing here mutates rows on a schedule. "Lapsed" is derived at read time
-- from confirm_by and confirmed_at, so there's no job to run and no window
-- where the database disagrees with the clock.
--
-- Safe to re-run.

alter table public.competitions
  add column if not exists confirm_by timestamptz;

alter table public.rsvps
  add column if not exists confirmed_at timestamptz;

alter table public.rsvps
  add column if not exists approved_late boolean not null default false;

comment on column public.competitions.confirm_by is
  'Deadline for carried-over roll call answers. Set on deploy: 24h, or kick-off if sooner.';
comment on column public.rsvps.confirmed_at is
  'When this operative themselves answered. Null on a row seeded from a muster.';
comment on column public.rsvps.approved_late is
  'A Captain or the President let them back on after the deadline.';

-- ── Seeding, now recording that the answer was carried, not given ─────────
create or replace function public.seed_roll_call(p_muster uuid, p_comp uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  m       record;
  c       record;
  kickoff text;
  seeded  integer := 0;
begin
  select * into m from musters where id = p_muster;
  if m is null then return 0; end if;

  select * into c from competitions where id = p_comp;
  if c is null then return 0; end if;

  if not (public.is_group_admin(m.group_id) or public.is_group_president(m.group_id)) then
    raise exception 'Not permitted';
  end if;

  kickoff := coalesce(to_char(c.tee_time, 'HH24:MI'), m.chosen_time, m.window_from, '00:00');

  insert into rsvps (competition_id, player_id, status, confirmed_at, updated_at)
  select
    p_comp,
    r.user_id,
    case
      when coalesce(r.from_times[idx.i], m.window_from, '00:00') <= kickoff
       and coalesce(r.to_times[idx.i], m.window_to, '23:59') > kickoff
      then 'in'
      else 'maybe'
    end,
    null,          -- carried across, not confirmed. The clock is now running.
    now()
  from muster_responses r
  cross join lateral (
    select array_position(r.available_dates, c.date::text) as i
  ) idx
  where r.muster_id = p_muster
    and idx.i is not null
  on conflict (competition_id, player_id) do nothing;

  get diagnostics seeded = row_count;
  return seeded;
end;
$$;

-- ── Letting somebody back on after the deadline ───────────────────────────
-- Captain of the squad, or the Barracks' command. Marks the row approved so
-- the reader stops treating it as lapsed, and stamps it confirmed.
create or replace function public.approve_late_rsvp(p_comp uuid, p_player uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c   record;
  gid uuid;
begin
  select * into c from competitions where id = p_comp;
  if c is null then return false; end if;

  select group_id into gid from squads where id = c.squad_id;
  if gid is null then
    select group_id into gid from memberships where user_id = auth.uid() limit 1;
  end if;

  if not (
    public.is_group_admin(gid)
    or public.is_group_president(gid)
    or exists (
      select 1 from squad_members
      where squad_id = c.squad_id and user_id = auth.uid() and is_captain
    )
  ) then
    raise exception 'Not permitted';
  end if;

  insert into rsvps (competition_id, player_id, status, confirmed_at, approved_late, updated_at)
  values (p_comp, p_player, 'in', now(), true, now())
  on conflict (competition_id, player_id) do update
    set status = 'in', confirmed_at = now(), approved_late = true, updated_at = now();

  return true;
end;
$$;

revoke all on function public.seed_roll_call(uuid, uuid) from public;
grant execute on function public.seed_roll_call(uuid, uuid) to authenticated;
revoke all on function public.approve_late_rsvp(uuid, uuid) from public;
grant execute on function public.approve_late_rsvp(uuid, uuid) to authenticated;
