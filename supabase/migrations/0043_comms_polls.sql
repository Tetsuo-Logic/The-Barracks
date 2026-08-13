-- Comms: a proper multiple-choice poll.
--
-- Broadcasts already carried `option_dates` — candidate *nights* for the old
-- availability poll. That's scheduling, which now belongs to Planning, so Comms
-- needs its own general poll rather than borrowing a column that means dates.
-- The old columns stay: existing date polls are real history and the phone
-- still reads them.
--
-- Safe to re-run.

alter table public.broadcasts
  add column if not exists options text[];

alter table public.broadcast_responses
  add column if not exists choice text;

comment on column public.broadcasts.options is
  'Poll choices for kind=''poll''. Free text, order is the display order.';
comment on column public.broadcast_responses.choice is
  'The option this operative picked, for kind=''poll''. Matches broadcasts.options exactly.';

-- 'poll' joins the existing kinds. The column is plain text with a check
-- constraint rather than an enum, so widen the constraint if one exists.
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.broadcasts'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%kind%';

  if con_name is not null then
    execute format('alter table public.broadcasts drop constraint %I', con_name);
  end if;

  alter table public.broadcasts
    add constraint broadcasts_kind_check
    check (kind in ('announce', 'yesno', 'ask', 'dates', 'poll'));
end $$;
