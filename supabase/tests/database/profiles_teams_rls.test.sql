-- Module 02: RLS and integrity tests (pgTAP). Run with `supabase test db`.
-- Everything runs in a transaction that is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Fixtures (as the migration owner): Ana captains Aurora; Beto plays for it;
-- Carla is a stranger; Dani was invited.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000002a1', 'ana@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000002b1', 'beto@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000002c1', 'carla@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000002d1', 'dani@test.local', 'authenticated', 'authenticated');

insert into public.organizations (id, name, slug) values
  ('00000000-0000-4000-8000-0000000002f0', 'Org Test', 'test-org-m02');

insert into public.user_private_data (user_id, legal_first_name, gender, gender_declared_at) values
  ('00000000-0000-4000-8000-0000000002a1', 'Ana', 'woman', now()),
  ('00000000-0000-4000-8000-0000000002b1', 'Beto', null, null);

insert into public.riot_accounts (id, user_id, puuid, game_name, tag_line, region, verification_method, verified_at) values
  ('00000000-0000-4000-8000-0000000002e1', '00000000-0000-4000-8000-0000000002a1', 'puuid-ana', 'AnaMid', 'LAN', 'la1', 'icon', now());

select public.svc_create_team(
  '00000000-0000-4000-8000-0000000002f0', '00000000-0000-4000-8000-0000000002a1',
  'Aurora', 'AUR', 'aurora', 'la1', null);

insert into public.team_members (team_id, user_id, team_role)
select id, '00000000-0000-4000-8000-0000000002b1', 'player' from public.teams where slug = 'aurora';

insert into public.team_invitations (team_id, invited_user_id, team_role, expires_at, created_by)
select id, '00000000-0000-4000-8000-0000000002d1', 'substitute', now() + interval '7 days',
       '00000000-0000-4000-8000-0000000002a1'
from public.teams where slug = 'aurora';

-- Integrity (as owner) ----------------------------------------------------
select is(
  (select count(*)::int from public.team_name_history h join public.teams t on t.id = h.team_id where t.slug = 'aurora'),
  1, 'creating a team records its name in the history');
select is(
  (select team_role::text from public.team_members m join public.teams t on t.id = m.team_id
   where t.slug = 'aurora' and m.user_id = '00000000-0000-4000-8000-0000000002a1'),
  'captain', 'the creator becomes captain');
select is(
  (select count(*)::int from public.riot_id_history where riot_account_id = '00000000-0000-4000-8000-0000000002e1'),
  1, 'linking a Riot account records its Riot ID');

select throws_ok(
  $$insert into public.riot_accounts (user_id, puuid, game_name, tag_line, region, verification_method)
    values ('00000000-0000-4000-8000-0000000002c1', 'puuid-ana', 'Copy', 'LAN', 'la1', 'icon')$$,
  '23505', null, 'a Riot account cannot be linked to a second user');
update public.riot_accounts set unlinked_at = now() where id = '00000000-0000-4000-8000-0000000002e1';
select lives_ok(
  $$insert into public.riot_accounts (user_id, puuid, game_name, tag_line, region, verification_method)
    values ('00000000-0000-4000-8000-0000000002c1', 'puuid-ana', 'Copy', 'LAN', 'la1', 'icon')$$,
  'an unlinked Riot account can be linked again');
delete from public.riot_id_history where riot_account_id in (select id from public.riot_accounts where game_name = 'Copy');
delete from public.riot_accounts where game_name = 'Copy';
update public.riot_accounts set unlinked_at = null where id = '00000000-0000-4000-8000-0000000002e1';

select throws_ok(
  $$insert into public.team_members (team_id, user_id, team_role)
    select id, '00000000-0000-4000-8000-0000000002b1', 'substitute' from public.teams where slug = 'aurora'$$,
  '23505', null, 'a player cannot appear twice in the active roster');
select throws_ok(
  $$insert into public.team_members (team_id, user_id, team_role)
    select id, '00000000-0000-4000-8000-0000000002c1', 'captain' from public.teams where slug = 'aurora'$$,
  '23505', null, 'a team has a single captain');
select throws_ok(
  $$select public.svc_create_team('00000000-0000-4000-8000-0000000002f0', '00000000-0000-4000-8000-0000000002c1',
    'AURORA', 'XYZ', 'aurora-2', 'la1', null)$$,
  '23505', null, 'team names are unique per organization (case-insensitive)');
select throws_ok(
  $$select public.svc_create_team('00000000-0000-4000-8000-0000000002f0', '00000000-0000-4000-8000-0000000002c1',
    'Boreal', 'AUR', 'boreal', 'la1', null)$$,
  '23505', null, 'team tags are unique per organization');

insert into public.audit_logs (action, entity_type) values ('test.entry', 'test');
select throws_ok($$update public.audit_logs set reason = 'x'$$, '42501', null, 'audit logs cannot be updated');
select throws_ok($$delete from public.audit_logs$$, '42501', null, 'audit logs cannot be deleted');

-- As Carla (stranger) -----------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000002c1", "role": "authenticated"}', true);

select is_empty($$select 1 from public.user_private_data$$, 'a user cannot read private data of others');
select is_empty($$select 1 from public.riot_accounts$$, 'a user cannot read Riot accounts of others');
select is(
  (select count(*)::int from public.teams where slug = 'aurora'), 1, 'teams are readable by everyone');
select is_empty(
  $$select 1 from public.team_members m join public.teams t on t.id = m.team_id where t.slug = 'aurora'$$,
  'a non-member cannot read the roster');
select is_empty($$select 1 from public.team_invitations$$, 'a non-member cannot read team invitations');
select throws_ok(
  $$insert into public.teams (organization_id, owner_user_id, name, tag, slug, region)
    values ('00000000-0000-4000-8000-0000000002f0', '00000000-0000-4000-8000-0000000002c1', 'Hack', 'HCK', 'hack', 'la1')$$,
  '42501', null, 'clients cannot write teams');
select throws_ok(
  $$select public.svc_create_team('00000000-0000-4000-8000-0000000002f0', '00000000-0000-4000-8000-0000000002c1',
    'Hack', 'HCK', 'hack', 'la1', null)$$,
  '42501', null, 'clients cannot call the service functions');
select is_empty($$select 1 from public.audit_logs$$, 'a plain user cannot read the audit log');

-- As Beto (member) --------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000002b1", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.team_members m join public.teams t on t.id = m.team_id where t.slug = 'aurora'),
  2, 'a member reads the roster');
select results_eq(
  $$select legal_first_name from public.user_private_data$$, $$values ('Beto'::text)$$,
  'a user reads only her own private data');

-- As Dani (invited) -------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000002d1", "role": "authenticated"}', true);
select is((select count(*)::int from public.team_invitations), 1, 'the invited user sees her invitation');

-- Anonymous ---------------------------------------------------------------
reset role;
set local role anon;
select is((select count(*)::int from public.teams where slug = 'aurora'), 1, 'anon reads teams');
select throws_ok($$select 1 from public.team_members$$, '42501', null, 'anon cannot read rosters');

select * from finish();
rollback;
