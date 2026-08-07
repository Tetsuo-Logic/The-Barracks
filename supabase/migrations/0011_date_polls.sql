-- "Dates" question type: the organiser offers a few candidate dates and
-- everyone ticks which they can make, so you find the day that suits the most.
-- Run after 0010.

alter table broadcasts drop constraint if exists broadcasts_kind_check;
alter table broadcasts add constraint broadcasts_kind_check
  check (kind in ('announce','yesno','ask','dates'));

alter table broadcasts add column if not exists option_dates date[];
alter table broadcast_responses add column if not exists available_dates date[];
