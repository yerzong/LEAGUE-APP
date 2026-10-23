-- RLS and signup trigger tests (pgTAP). Run with `supabase test db` (CI, local Docker).
-- Everything runs in a transaction that is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Fixtures: Ana (org A), Beto (org B), Carla (super admin, no membership).
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000a', 'ana@test.local', 'authenticated', 'authenticated', '{"full_name": "Ana"}'),
  ('00000000-0000-4000-8000-00000000000b', 'beto@test.local', 'authenticated', 'authenticated', '{"name": "Beto"}'),
  ('00000000-0000-4000-8000-00000000000c', 'carla@test.local', 'authenticated', 'authenticated', '{}');

select is(
  (select count(*)::int from public.users where id in (
    '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000c')),
  3, 'signup creates a profile row for every auth user');
select is(
  (select display_name from public.users where id = '00000000-0000-4000-8000-00000000000b'),
  'Beto', 'display name is taken from provider metadata');
select is(
  (select platform_role::text from public.users where id = '00000000-0000-4000-8000-00000000000a'),
  'user', 'new users get the plain user role');

update public.users set platform_role = 'super_admin' where id = '00000000-0000-4000-8000-00000000000c';

insert into public.organizations (id, name, slug) values
  ('00000000-0000-4000-8000-0000000000a0', 'Org A', 'test-org-a'),
  ('00000000-0000-4000-8000-0000000000b0', 'Org B', 'test-org-b');
insert into public.organization_members (organization_id, user_id, status, joined_at) values
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-00000000000a', 'active', now()),
  ('00000000-0000-4000-8000-0000000000b0', '00000000-0000-4000-8000-00000000000b', 'active', now());

-- As Ana
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);

select results_eq(
  $$select id from public.organizations where slug like 'test-org-%'$$,
  $$values ('00000000-0000-4000-8000-0000000000a0'::uuid)$$,
  'a member reads only her organization');
select is_empty(
  $$select 1 from public.organization_members where organization_id = '00000000-0000-4000-8000-0000000000b0'$$,
  'a member cannot read members of another organization');
select results_eq(
  $$select id from public.users$$,
  $$values ('00000000-0000-4000-8000-00000000000a'::uuid)$$,
  'a user reads only her own profile');
select throws_ok(
  $$insert into public.organizations (name, slug) values ('Hack', 'hack')$$,
  '42501', null, 'clients cannot write organizations');
select throws_ok(
  $$update public.users set platform_role = 'super_admin'$$,
  '42501', null, 'clients cannot escalate their own role');

-- As Carla (super admin)
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000000c", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.organizations where slug like 'test-org-%'),
  2, 'a super admin reads every organization');

-- Anonymous
reset role;
set local role anon;
select throws_ok($$select 1 from public.users$$, '42501', null, 'anon cannot read users');
select throws_ok($$select 1 from public.organizations$$, '42501', null, 'anon cannot read organizations');

select * from finish();
rollback;
