-- The board: complaints any player can file (reason / action / comment) that
-- must be ruled on by the President. The President is a nameable title, separate
-- from the admin/owner (who keeps every power). Run after 0008.

-- President title (separate from is_admin).
alter table profiles add column if not exists is_president boolean not null default false;

-- Default the president to Paul until he hands it over.
update profiles p set is_president = true
from auth.users u
where u.id = p.id and u.email = 'paul.mikey.hyde@googlemail.com';

-- Is the current user the sitting President?
create or replace function public.is_president()
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce((select is_president from profiles where id = auth.uid()), false);
$$;

create table if not exists complaints (
  id           uuid primary key default gen_random_uuid(),
  filed_by     uuid references profiles(id) on delete set null,
  reason       text not null,
  action       text,                         -- the action being requested
  comment      text,
  status       text not null default 'open' check (status in ('open','addressed')),
  ruling       text,                         -- the President's response
  addressed_by uuid references profiles(id) on delete set null,
  created_at   timestamptz default now(),
  addressed_at timestamptz
);

alter table complaints enable row level security;

drop policy if exists complaints_read on complaints;
create policy complaints_read on complaints
  for select using (auth.uid() is not null);

drop policy if exists complaints_insert on complaints;
create policy complaints_insert on complaints
  for insert with check (filed_by = auth.uid());

-- Only the President (or the admin) can rule on a complaint.
drop policy if exists complaints_update on complaints;
create policy complaints_update on complaints
  for update using (public.is_admin() or public.is_president())
  with check (public.is_admin() or public.is_president());
