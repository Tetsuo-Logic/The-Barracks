-- Notification bell / inbox: one "last looked" timestamp per player so we can
-- show a count of new comments since they last opened the inbox. Answered
-- questions and outstanding RSVPs are task-based (no timestamp needed); this is
-- only for informational activity that clears once seen. Run after 0012.
--
-- Defaults to now() so a new player has a baseline ("seen everything up to
-- signup") and never sees pre-existing chatter as unread; existing players are
-- backfilled the same way.

alter table profiles add column if not exists inbox_seen_at timestamptz default now();
update profiles set inbox_seen_at = now() where inbox_seen_at is null;
