-- 0033_roll_call.sql — Op-2: the CO takes roll call.
--
-- rsvps updates are self-only (player_id = auth.uid()), so the CO can't mark
-- another player present/no-show. This CO-gated function does exactly that —
-- only the `attended` flag, nothing else. SECURITY DEFINER to bypass the
-- self-only policy; gated on is_group_admin of the event's group.
-- Run after 0032 on STAGING first. Idempotent.

create or replace function public.set_attendance(p_event uuid, p_player uuid, p_present boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  select group_id into v_group from competitions where id = p_event;
  if v_group is null then return; end if;
  if not public.is_group_admin(v_group) then
    raise exception 'Only the CO can take roll call.';
  end if;

  insert into rsvps (competition_id, player_id, status, attended)
  values (p_event, p_player, 'in', p_present)
  on conflict (competition_id, player_id) do update set attended = p_present;
end $$;

grant execute on function public.set_attendance(uuid, uuid, boolean) to authenticated;
