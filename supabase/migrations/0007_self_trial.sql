-- Allow a player to put themselves on trial — used when they back out of a
-- competition they'd committed to (the strike hearing). The organiser can
-- still convene against anyone. Run after 0006.

drop policy if exists trials_insert on trials;
create policy trials_insert on trials
  for insert with check (public.is_admin() or defendant_id = auth.uid());
