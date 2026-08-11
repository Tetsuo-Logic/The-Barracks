-- phase3_isolation_test.sql — STAGING ONLY. Proves group-scoped RLS isolates
-- tenants. Everything runs inside a transaction that ROLLS BACK at the end, so
-- staging is left exactly as it was (no test data, FK restored).
--
-- Run AFTER 0030 on staging. Expected final result:
--   who | sees_seed | sees_b
--   ----+-----------+-------
--   A   |     1     |   0        (User A is in the seed group → sees only seed)
--   B   |     0     |   1        (User B is in Group B     → sees only Group B)
--
-- If you see A=(1,0) and B=(0,1), tenant isolation works. Anything else = leak.

begin;

-- Create test identities without the auth machinery: drop the profiles→auth.users
-- FK for the duration of this transaction (DDL is transactional — rollback
-- restores it). If this errors on the constraint name, tell me and I'll adjust.
alter table profiles drop constraint profiles_id_fkey;

-- A second Barracks to isolate against.
insert into groups (id, name)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Group B');

-- Two members: A in the seed group, B in Group B.
insert into profiles (id, name, is_admin, is_president) values
  ('a1111111-1111-1111-1111-111111111111', 'User A', true, true),
  ('b2222222-2222-2222-2222-222222222222', 'User B', true, true);

insert into memberships (group_id, user_id, is_admin, is_president) values
  ('00000000-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', true, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b2222222-2222-2222-2222-222222222222', true, true);

-- One competition in each group.
insert into competitions (group_id, date, format, course) values
  ('00000000-0000-0000-0000-000000000001', current_date, 'stroke', 'Seed Course'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', current_date, 'stroke', 'B Course');

-- Collect what each user can see (as postgres; temp table, no RLS).
create temp table _res (who text, sees_seed int, sees_b int) on commit drop;
grant insert on _res to authenticated;

-- Impersonate User A (RLS enforced under the authenticated role).
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1111111-1111-1111-1111-111111111111"}';
insert into _res select 'A',
  (select count(*) from competitions where group_id = '00000000-0000-0000-0000-000000000001'),
  (select count(*) from competitions where group_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
reset role;

-- Impersonate User B.
set local role authenticated;
set local request.jwt.claims to '{"sub":"b2222222-2222-2222-2222-222222222222"}';
insert into _res select 'B',
  (select count(*) from competitions where group_id = '00000000-0000-0000-0000-000000000001'),
  (select count(*) from competitions where group_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
reset role;

select * from _res order by who;

rollback;
