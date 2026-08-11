-- 0040_muster_windows.sql — time windows on musters.
--
-- The Captain frames the night with a kick-off window (From–To). Members then
-- give, per night they can do, their own From–To inside it, so the Captain can
-- read the overlap ("Wed · 4 free · all can do 8–10") and propose a real time.
-- Additive, single-group. ⚠️ Staging first. After 0039.

-- The muster's kick-off window (e.g. 18:00–22:00). Null = time TBD.
alter table musters add column if not exists window_from text;
alter table musters add column if not exists window_to text;

-- A member's per-night windows, index-aligned with muster_responses.available_dates:
-- available_dates[i] is playable from from_times[i] to to_times[i].
alter table muster_responses add column if not exists from_times text[] not null default '{}';
alter table muster_responses add column if not exists to_times   text[] not null default '{}';
