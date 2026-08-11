-- 0035_squad_requests.sql — Sq-2b: clan tag + squad request/approve flow.
--
-- A member proposes a squad; the President approves it into being. Clan tag on
-- squads, editable by the Captain or CO. Additive, single-group. Staging first.
-- Run after 0034.

-- Clan tag (e.g. [TAG]) — set at request/create, editable by Captain or CO.
alter table squads add column if not exists clan_tag text;

-- Squad requests — a member proposes; the President approves/declines.
create table if not exists squad_requests (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references groups(id),
  game         text not null,
  name         text,
  clan_tag     text,
  requested_by uuid references profiles(id) on delete set null,
  status       text not null default 'open' check (status in ('open','approved','declined')),
  created_at   timestamptz default now()
);
alter table squad_requests enable row level security;
drop policy if exists squad_requests_read on squad_requests;
create policy squad_requests_read on squad_requests for select using (public.is_member(group_id));
drop policy if exists squad_requests_insert on squad_requests;
create policy squad_requests_insert on squad_requests for insert
  with check (requested_by = auth.uid() and public.is_member(group_id));
drop policy if exists squad_requests_update on squad_requests;
create policy squad_requests_update on squad_requests for update
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
drop policy if exists squad_requests_delete on squad_requests;
create policy squad_requests_delete on squad_requests for delete
  using (requested_by = auth.uid() or public.is_group_admin(group_id));

-- Set the clan tag — the CO or the squad's Captain (only touches clan_tag).
create or replace function public.set_clan_tag(p_squad uuid, p_tag text)
returns void language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  select group_id into v_group from squads where id = p_squad;
  if v_group is null then return; end if;
  if not (public.is_group_admin(v_group) or public.is_squad_captain(p_squad)) then
    raise exception 'Only the Captain or CO can set the clan tag.';
  end if;
  update squads set clan_tag = nullif(btrim(coalesce(p_tag, '')), '') where id = p_squad;
end $$;
grant execute on function public.set_clan_tag(uuid, text) to authenticated;
