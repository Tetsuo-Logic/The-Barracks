-- Let the organiser delete any comment (for clearing out test chatter), on top
-- of the existing "authors delete their own". Run after 0016.

drop policy if exists comments_delete on comments;
create policy comments_delete on comments
  for delete using (author_id = auth.uid() or public.is_admin());
