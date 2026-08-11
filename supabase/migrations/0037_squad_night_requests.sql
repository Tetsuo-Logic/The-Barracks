-- 0037_squad_night_requests.sql — a squad member nudges their Captain.
--
-- Organising a squad's game runs through the Captain (the pre-week muster). If
-- nothing's arranged, a member can poke the Captain to sort a night. Lightweight
-- + persistent so the Captain sees it, not just a fleeting push. The Captain (or
-- CO) clears them — and, once the Muster exists, opening one will consume them.
-- Additive, single-group. ⚠️ Staging first. After 0036.

create table if not exists squad_night_requests (
  id           uuid primary key default gen_random_uuid(),
  squad_id     uuid not null references squads(id) on delete cascade,
  group_id     uuid not null references groups(id),
  requested_by uuid references profiles(id) on delete set null,
  note         text,
  created_at   timestamptz default now()
);
create index if not exists squad_night_requests_squad_idx on squad_night_requests (squad_id);
alter table squad_night_requests enable row level security;

-- The squad (whole Barracks, really) can see the asks.
drop policy if exists snr_read on squad_night_requests;
create policy snr_read on squad_night_requests for select using (public.is_member(group_id));

-- Only a member of that squad can raise one, for themselves.
drop policy if exists snr_insert on squad_night_requests;
create policy snr_insert on squad_night_requests for insert
  with check (
    requested_by = auth.uid()
    and public.is_member(group_id)
    and exists (
      select 1 from squad_members m
      where m.squad_id = squad_night_requests.squad_id and m.user_id = auth.uid()
    )
  );

-- The filer withdraws their own; the Captain or CO clears any.
drop policy if exists snr_delete on squad_night_requests;
create policy snr_delete on squad_night_requests for delete
  using (
    requested_by = auth.uid()
    or public.is_squad_captain(squad_id)
    or public.is_group_admin(group_id)
  );
