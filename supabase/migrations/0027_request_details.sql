-- Game requests can now carry the when + how-many: an availability window and a
-- min/max player count, so the CO can see if it fits the squad and the calendar.
-- Run after 0026.

alter table game_requests add column if not exists available_from date;
alter table game_requests add column if not exists available_to   date;
alter table game_requests add column if not exists min_players     int;
alter table game_requests add column if not exists max_players     int;
