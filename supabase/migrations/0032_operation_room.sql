-- 0032_operation_room.sql — Op-1: Operation Room data + live plumbing.
--
-- Additive: turns a scheduled event into a live "room". No app changes yet
-- (Op-2 builds the UI). Single-group — fits the multi-tenant foundation as-is.
-- ⚠️ Run on STAGING first. Run after 0031. Idempotent.

-- 1. Operation fields on the event.
alter table competitions add column if not exists started_at  timestamptz;   -- room opened / live
alter table competitions add column if not exists finished_at timestamptz;   -- closed / archived
alter table competitions add column if not exists games_count int not null default 0;

-- Actual turn-out for roll call — distinct from RSVP *intent*:
--   null = not rolled · true = present · false = no-show.
alter table rsvps add column if not exists attended boolean;

-- 2. Any participant advances the live games count. Compare-and-set on the
--    current count so near-simultaneous taps collapse to a SINGLE increment
--    (one real-world game = one increment). SECURITY DEFINER: a plain member may
--    bump it even though the competitions update policy is CO-only. Returns the
--    resulting count (unchanged if someone else already advanced).
create or replace function public.advance_games(p_event uuid, p_expected int)
returns int language plpgsql security definer set search_path = public as $$
declare v_group uuid; v_count int;
begin
  select group_id into v_group from competitions where id = p_event;
  if v_group is null then return null; end if;
  if not public.is_member(v_group) then raise exception 'Not in this Barracks.'; end if;

  update competitions set games_count = games_count + 1
    where id = p_event and games_count = p_expected
    returning games_count into v_count;

  if v_count is null then
    select games_count into v_count from competitions where id = p_event; -- no-op: already advanced
  end if;
  return v_count;
end $$;
grant execute on function public.advance_games(uuid, int) to authenticated;

-- 3. Live room over Supabase Realtime. Full replica identity so Realtime has the
--    row's group_id to apply RLS (a client only receives changes it may see).
alter table competitions replica identity full;
alter table rsvps        replica identity full;

do $$
declare t text;
begin
  foreach t in array array['competitions', 'rsvps'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
