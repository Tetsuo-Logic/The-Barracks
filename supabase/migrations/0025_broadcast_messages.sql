-- Pings get a reply thread: append-only messages so you see who said what, when
-- (the yes/no + dates answer stays a single vote on broadcast_responses). Run
-- after 0024.

create table if not exists broadcast_messages (
  id           uuid primary key default gen_random_uuid(),
  broadcast_id uuid references broadcasts(id) on delete cascade,
  author_id    uuid references profiles(id) on delete set null,
  body         text not null,
  created_at   timestamptz default now()
);

alter table broadcast_messages enable row level security;

drop policy if exists broadcast_messages_read on broadcast_messages;
create policy broadcast_messages_read on broadcast_messages
  for select using (auth.uid() is not null);

drop policy if exists broadcast_messages_insert on broadcast_messages;
create policy broadcast_messages_insert on broadcast_messages
  for insert with check (author_id = auth.uid());
