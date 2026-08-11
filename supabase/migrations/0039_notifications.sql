-- 0039_notifications.sql — a stored inbox feed.
--
-- The in-app inbox was fully derived (open polls, comps needing RSVP, new
-- comments), so event pushes with no derived state — a muster called, a night
-- wanted, a night proposed — showed as a push but never landed in the inbox to
-- click. This adds a persisted per-user feed those events write to.
-- Additive, single-group. ⚠️ Staging first. After 0038.

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  title      text not null,
  body       text,
  url        text,
  read_at    timestamptz,
  created_at timestamptz default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
alter table notifications enable row level security;

-- You see, clear, and delete only your own.
drop policy if exists notifications_read on notifications;
create policy notifications_read on notifications for select using (user_id = auth.uid());
drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_delete on notifications;
create policy notifications_delete on notifications for delete using (user_id = auth.uid());

-- Fan-out insert. SECURITY DEFINER so a sender can drop a notification into
-- other members' inboxes (RLS would block inserting rows for other users). A
-- normal caller may only notify people they share a group with (or themselves);
-- a service-role caller (cron, no JWT → auth.uid() null) may notify anyone.
create or replace function public.notify(p_users uuid[], p_title text, p_body text, p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, title, body, url)
  select u, p_title, p_body, p_url
  from unnest(p_users) as u
  where auth.uid() is null or u = auth.uid() or public.shares_group(u);
end $$;
grant execute on function public.notify(uuid[], text, text, text) to authenticated;
