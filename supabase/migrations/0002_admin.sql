-- Organiser model: one admin (Paul) creates/edits dates; the others only RSVP.
-- Run this in the Supabase SQL editor after 0001.

-- 1. Flag on profiles.
alter table profiles add column if not exists is_admin boolean not null default false;

-- 2. Make Paul the organiser. (Edit the email if yours differs.)
update profiles p
set is_admin = true
from auth.users u
where u.id = p.id
  and u.email = 'paul.mikey.hyde@googlemail.com';

-- 3. Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- 4. Restrict competition writes to admins (replace the open policies from 0001).
drop policy if exists competitions_insert on competitions;
drop policy if exists competitions_update on competitions;
drop policy if exists competitions_delete on competitions;

create policy competitions_insert on competitions
  for insert with check (public.is_admin());
create policy competitions_update on competitions
  for update using (public.is_admin());
create policy competitions_delete on competitions
  for delete using (public.is_admin());
