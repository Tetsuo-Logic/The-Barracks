-- Radar: which platform a game is on. Run after 0025.
alter table radar_games add column if not exists platform text;
