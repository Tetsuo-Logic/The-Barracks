-- Cancelling a fixture (vs deleting it): keep the row, mark it cancelled, and
-- store the CO's reason so everyone can see why. Run after 0022.

alter table competitions add column if not exists cancel_reason text;
