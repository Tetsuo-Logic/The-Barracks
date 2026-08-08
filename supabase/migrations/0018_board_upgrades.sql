-- Board upgrades: name who a complaint is about (they get pinged and can
-- respond), and let the president ask a chosen player for a second opinion
-- before ruling. Also a 'board' notification preference so these pings are
-- gated like the rest. Run after 0017.

alter table complaints add column if not exists against_id         uuid references profiles(id) on delete set null;
alter table complaints add column if not exists response           text;         -- the subject's reply
alter table complaints add column if not exists response_at        timestamptz;
alter table complaints add column if not exists second_opinion_by       uuid references profiles(id) on delete set null;
alter table complaints add column if not exists second_opinion          text;
alter table complaints add column if not exists second_opinion_at       timestamptz;
alter table complaints add column if not exists second_opinion_to_court boolean;  -- their steer: take it to the Courtroom?

-- The subject (against_id) can write their response, and the nominated second-
-- opinion giver can write their opinion; the president and admin keep full
-- control. (Column-level scoping isn't available in RLS, so in a three-player
-- trust circle these two can update the row — acceptable.)
drop policy if exists complaints_update on complaints;
create policy complaints_update on complaints
  for update
  using (
    public.is_admin() or public.is_president()
    or against_id = auth.uid() or second_opinion_by = auth.uid()
  )
  with check (
    public.is_admin() or public.is_president()
    or against_id = auth.uid() or second_opinion_by = auth.uid()
  );

alter table notification_prefs add column if not exists board boolean default true;
