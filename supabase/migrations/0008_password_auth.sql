-- Support the switch to email + password sign-in. Run after 0007.
-- (a) Deleting a player no longer blocks on the things they created — those
--     references just go null. Lets you wipe old test accounts for a clean start.
-- (b) The president (Paul) is auto-flagged admin whenever the profile is created,
--     so recreating the account keeps the crown.

alter table competitions drop constraint if exists competitions_created_by_fkey;
alter table competitions add constraint competitions_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table scores drop constraint if exists scores_updated_by_fkey;
alter table scores add constraint scores_updated_by_fkey
  foreign key (updated_by) references profiles(id) on delete set null;

alter table comments drop constraint if exists comments_author_id_fkey;
alter table comments add constraint comments_author_id_fkey
  foreign key (author_id) references profiles(id) on delete set null;

alter table photos drop constraint if exists photos_uploader_id_fkey;
alter table photos add constraint photos_uploader_id_fkey
  foreign key (uploader_id) references profiles(id) on delete set null;

alter table broadcasts drop constraint if exists broadcasts_created_by_fkey;
alter table broadcasts add constraint broadcasts_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table strikes drop constraint if exists strikes_created_by_fkey;
alter table strikes add constraint strikes_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table trials drop constraint if exists trials_created_by_fkey;
alter table trials add constraint trials_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

-- Auto-crown the president on profile creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email = 'paul.mikey.hyde@googlemail.com'
  )
  on conflict (id) do nothing;

  insert into public.notification_prefs (player_id)
  values (new.id)
  on conflict (player_id) do nothing;

  return new;
end $$;
