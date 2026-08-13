-- Seed the roll call from the muster that produced the Operation.
--
-- Somebody tells their Captain they can do Thursday, the President deploys
-- Thursday, and the app then asks them the same question again from scratch —
-- so the roster reads 0 in on a night everyone already offered. This carries
-- the answer forward: the second step becomes a confirmation rather than a
-- fresh question.
--
--   offered the night, and the kick-off falls inside their hours  ->  'in'
--   offered the night, but the kick-off sits outside those hours  ->  'maybe'
--   didn't offer it                                               ->  nothing
--
-- 'maybe' rather than 'in' for the partial case matters: someone free 20:00 to
-- 22:00 for a 23:00 start hasn't agreed to anything, and a roster bar that
-- overstates turnout is worse than one that admits doubt.
--
-- SECURITY DEFINER because rsvps are self-write only (player_id = auth.uid()),
-- which is the right rule — this is the one place another party may answer for
-- you, and only by repeating what you already said. Existing answers are never
-- overwritten.
--
-- Safe to re-run.

create or replace function public.seed_roll_call(p_muster uuid, p_comp uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  m           record;
  c           record;
  kickoff     text;
  seeded      integer := 0;
begin
  select * into m from musters where id = p_muster;
  if m is null then return 0; end if;

  select * into c from competitions where id = p_comp;
  if c is null then return 0; end if;

  -- Only the Barracks' command may do this, and only for their own group.
  if not (public.is_group_admin(m.group_id) or public.is_group_president(m.group_id)) then
    raise exception 'Not permitted';
  end if;

  kickoff := coalesce(to_char(c.tee_time, 'HH24:MI'), m.chosen_time, m.window_from, '00:00');

  insert into rsvps (competition_id, player_id, status, updated_at)
  select
    p_comp,
    r.user_id,
    case
      -- Their hours for that night, defaulting to the muster's window when the
      -- response predates per-night times.
      when coalesce(r.from_times[idx.i], m.window_from, '00:00') <= kickoff
       and coalesce(r.to_times[idx.i], m.window_to, '23:59') > kickoff
      then 'in'
      else 'maybe'
    end,
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

revoke all on function public.seed_roll_call(uuid, uuid) from public;
grant execute on function public.seed_roll_call(uuid, uuid) to authenticated;
