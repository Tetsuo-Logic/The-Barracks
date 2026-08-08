-- One-off / named events: an optional title (already present) plus a banner
-- image. The image reuses the public 'avatars' bucket under a 'comps/' prefix,
-- so no new bucket is needed — only this column, which holds the public URL.
-- Run after 0013.

alter table competitions add column if not exists image_url text;
