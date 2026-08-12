-- 0041_complaint_delete.sql — let a stuck complaint be cleared.
--
-- complaints had read/insert/update policies but no delete, so nothing could
-- remove a case once filed — a half-finished one sat on the board forever.
-- The CO or President can bin any case; the filer can withdraw their own.
-- Additive, single-group. ⚠️ Staging first. After 0040.

drop policy if exists complaints_delete on complaints;
create policy complaints_delete on complaints for delete
  using (
    public.is_group_admin(group_id)
    or public.is_group_president(group_id)
    or filed_by = auth.uid()
  );
