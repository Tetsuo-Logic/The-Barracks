-- App-wide settings: a single-row table for organiser-controlled globals. The
-- first use is "clear history" — a cutoff timestamp; the activity feed hides
-- anything older, for everyone. Non-destructive: the underlying rounds,
-- comments and messages stay put, they're just filtered from the feed, so the
-- organiser can undo it by clearing the cutoff. Run after 0014.

create table if not exists app_settings (
  id                      int primary key default 1,
  activity_cleared_before timestamptz,
  check (id = 1)
);
insert into app_settings (id) values (1) on conflict do nothing;

alter table app_settings enable row level security;

drop policy if exists app_settings_read on app_settings;
create policy app_settings_read on app_settings
  for select using (auth.uid() is not null);

drop policy if exists app_settings_update on app_settings;
create policy app_settings_update on app_settings
  for update using (public.is_admin()) with check (public.is_admin());
