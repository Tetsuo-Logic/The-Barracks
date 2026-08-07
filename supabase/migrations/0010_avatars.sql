-- Profile photos: a public 'avatars' bucket so the URL is stable and shows
-- everywhere (scorecard, RSVP, jury) without signing. Run after 0009.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars read" on storage.objects;
create policy "avatars read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars insert" on storage.objects;
create policy "avatars insert" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid() is not null);

drop policy if exists "avatars update" on storage.objects;
create policy "avatars update" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid() is not null);
