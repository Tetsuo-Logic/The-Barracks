-- Radar: an optional trailer link (YouTube etc.). Run after 0023.
alter table radar_games add column if not exists youtube_url text;
