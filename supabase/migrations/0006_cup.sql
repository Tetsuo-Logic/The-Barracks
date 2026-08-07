-- Split competitions into the Threeball Cup (ranked) and casual, non-cup
-- rounds. Standings show the two separately. Run after 0005.

alter table competitions
  add column if not exists for_cup boolean not null default true;
