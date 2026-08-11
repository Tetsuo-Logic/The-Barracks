-- 0036_acting_captain.sql — Sq-3b: Captain-as-CO writes + acting Captain.
--
-- Sq-3a made the squad Captain a CO in the UI, but the room's writes still went
-- straight to `competitions` (RLS: group-admin only) or were gated on
-- is_group_admin — so a Captain would be denied. This migration:
--   • can_command(event) — CO, the squad's Captain, or the event's acting Captain
--   • start_operation / close_operation — gated on can_command (were direct updates)
--   • re-gates set_attendance on can_command (was is_group_admin only)
--   • set_acting_captain(event, player) — the real Captain / CO names a stand-in
-- Additive, single-group. ⚠️ Staging first. After 0035.

-- Who may command this Operation's room?
create or replace function public.can_command(p_event uuid)
returns boolean language plpgsql security definer set search_path = public stable as $$
declare v_group uuid; v_squad uuid; v_acting uuid;
begin
  select group_id, squad_id, acting_captain_id
    into v_group, v_squad, v_acting
    from competitions where id = p_event;
  if v_group is null then return false; end if;
  return public.is_group_admin(v_group)
      or (v_squad is not null and public.is_squad_captain(v_squad))
      or (v_acting is not null and v_acting = auth.uid());
end $$;
grant execute on function public.can_command(uuid) to authenticated;

-- Start the room (idempotent on started_at).
create or replace function public.start_operation(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_command(p_event) then
    raise exception 'Only the CO or Captain can start the operation.';
  end if;
  update competitions set started_at = now()
    where id = p_event and started_at is null;
end $$;
grant execute on function public.start_operation(uuid) to authenticated;

-- Close & archive, correcting the final games total.
create or replace function public.close_operation(p_event uuid, p_games int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_command(p_event) then
    raise exception 'Only the CO or Captain can close the operation.';
  end if;
  update competitions
    set finished_at = now(),
        games_count = greatest(0, p_games),
        status = 'played'
    where id = p_event;
end $$;
grant execute on function public.close_operation(uuid, int) to authenticated;

-- Roll call — now any commander (CO / Captain / acting), only the attended flag.
create or replace function public.set_attendance(p_event uuid, p_player uuid, p_present boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_command(p_event) then
    raise exception 'Only the CO or Captain can take roll call.';
  end if;
  insert into rsvps (competition_id, player_id, status, attended)
  values (p_event, p_player, 'in', p_present)
  on conflict (competition_id, player_id) do update set attended = p_present;
end $$;
grant execute on function public.set_attendance(uuid, uuid, boolean) to authenticated;

-- Name (or clear) an acting Captain for this one Operation. Only the real
-- Captain or the CO may — an acting Captain can't appoint their own successor.
create or replace function public.set_acting_captain(p_event uuid, p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_group uuid; v_squad uuid;
begin
  select group_id, squad_id into v_group, v_squad from competitions where id = p_event;
  if v_group is null then return; end if;
  if not (public.is_group_admin(v_group)
          or (v_squad is not null and public.is_squad_captain(v_squad))) then
    raise exception 'Only the Captain or CO can name an acting Captain.';
  end if;
  -- A stand-in for a squad op must actually be in the squad.
  if p_player is not null and v_squad is not null
     and not exists (select 1 from squad_members where squad_id = v_squad and user_id = p_player) then
    raise exception 'The acting Captain must be in the squad.';
  end if;
  update competitions set acting_captain_id = p_player where id = p_event;
end $$;
grant execute on function public.set_acting_captain(uuid, uuid) to authenticated;
