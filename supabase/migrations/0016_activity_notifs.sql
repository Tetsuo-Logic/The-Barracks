-- Activity notifications: the organiser wants a push whenever the others do
-- something — accept a date, answer a poll. Those events now send a push gated
-- by the rsvp_changes preference. Default it on for new players, and switch it
-- on for the organiser (who asked for it) without touching anyone else's choice.
-- Run after 0015.

alter table notification_prefs alter column rsvp_changes set default true;

update notification_prefs
set rsvp_changes = true
where player_id in (select id from profiles where is_admin);
