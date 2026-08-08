-- Tee time per available date, chosen by each player. When a player ticks a
-- date they can make, they also say what tee-off time suits them that day.
-- Stored as a text[] of bare 'HH:MM' strings, index-aligned with
-- broadcast_responses.available_dates ('' = no time given). Run after 0011.

alter table broadcast_responses add column if not exists date_times text[];
