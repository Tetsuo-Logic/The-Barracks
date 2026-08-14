-- Requesting a squad, with a Captain in mind.
--
-- A squad request already existed (game, name, clan tag) but said nothing about
-- who should run it, and approving one formed an empty squad with no Captain —
-- so the person who wanted it got no control of it and somebody had to go and
-- appoint them by hand afterwards.
--
-- Two things needed:
--   · the request has to carry the proposed Captain
--   · approval has to seat them
--
-- The second is why this is a function rather than more application code:
-- squad_members allows self-insert only (user_id = auth.uid()), which is the
-- right rule — you opt into a squad, nobody drags you in. Seating a Captain on
-- approval is the one legitimate exception, so it happens here, gated on the
-- caller actually being the Barracks' command.
--
-- Safe to re-run.

alter table public.squad_requests
  add column if not exists captain_id uuid references public.profiles(id) on delete set null;

comment on column public.squad_requests.captain_id is
  'Who the requester wants to run it. Seated as Captain by approve_squad_request.';

create or replace function public.approve_squad_request(p_request uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r        record;
  v_squad  uuid;
begin
  select * into r from squad_requests where id = p_request;
  if r is null then return null; end if;

  if not (public.is_group_admin(r.group_id) or public.is_group_president(r.group_id)) then
    raise exception 'Not permitted';
  end if;

  -- Forming the same squad twice shouldn't fail the approval; find the
  -- existing one and carry on.
  -- squads carries unique (group_id, game) — one COD Squad per Barracks — so
  -- that pair is what an existing squad is found by.
  select id into v_squad
  from squads
  where group_id = r.group_id and game = r.game;

  if v_squad is null then
    insert into squads (group_id, game, name, clan_tag)
    values (r.group_id, r.game, r.name, r.clan_tag)
    returning id into v_squad;
  end if;

  -- Seat the proposed Captain. They're a member and they hold the captaincy —
  -- the whole point of asking for one.
  if r.captain_id is not null then
    insert into squad_members (squad_id, user_id, is_captain)
    values (v_squad, r.captain_id, true)
    on conflict (squad_id, user_id) do update set is_captain = true;
  end if;

  update squad_requests set status = 'approved' where id = p_request;
  return v_squad;
end;
$$;

revoke all on function public.approve_squad_request(uuid) from public;
grant execute on function public.approve_squad_request(uuid) to authenticated;
