-- Module 08: Riot provider/tournament/codes, inbound webhooks and integrity
-- alerts — RLS, idempotency and the service functions (pgTAP). Run with
-- `supabase test db`; everything runs in a transaction that is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Fixtures: Ana (Aurora) vs Beto (Boreal) in a live match; Admin is super admin.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000008a1', 'ana8@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000008b1', 'beto8@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000008e1', 'admin8@test.local', 'authenticated', 'authenticated');
update public.users set platform_role = 'super_admin' where id = '00000000-0000-4000-8000-0000000008e1';
insert into public.organizations (id, name, slug) values
  ('00000000-0000-4000-8000-0000000008f0', 'Org Test', 'test-org-m08');
insert into public.tournaments (id, organization_id, slug, name, status, supervision_level) values
  ('00000000-0000-4000-8000-0000000008c0', '00000000-0000-4000-8000-0000000008f0', 'liga-m08', 'Liga M08', 'in_progress', 'automatic');
insert into public.phases (id, tournament_id, name, position, format, series_format) values
  ('00000000-0000-4000-8000-0000000008c1', '00000000-0000-4000-8000-0000000008c0', 'Liga', 1, 'round_robin', 'bo1');
insert into public.entrants (id, tournament_id, user_id, display_name, status, registered_by) values
  ('00000000-0000-4000-8000-0000000008d1', '00000000-0000-4000-8000-0000000008c0',
   '00000000-0000-4000-8000-0000000008a1', 'Aurora8', 'approved', '00000000-0000-4000-8000-0000000008a1'),
  ('00000000-0000-4000-8000-0000000008d2', '00000000-0000-4000-8000-0000000008c0',
   '00000000-0000-4000-8000-0000000008b1', 'Boreal8', 'approved', '00000000-0000-4000-8000-0000000008b1');
insert into public.matches (id, organization_id, tournament_id, phase_id, bracket_key, round, position,
  entrant_a_id, entrant_b_id, series_format, status) values
  ('00000000-0000-4000-8000-0000000008aa', '00000000-0000-4000-8000-0000000008f0',
   '00000000-0000-4000-8000-0000000008c0', '00000000-0000-4000-8000-0000000008c1', 'r1-m1', 1, 1,
   '00000000-0000-4000-8000-0000000008d1', '00000000-0000-4000-8000-0000000008d2', 'bo1', 'live');

-- Provider / tournament setup -----------------------------------------------------
select isnt(public.svc_save_riot_provider('00000000-0000-4000-8000-0000000008f0',
  '00000000-0000-4000-8000-0000000008e1', 'la1', 100123, 'https://api/integrations/riot/callbacks'),
  null, 'the provider is registered');
select public.svc_save_riot_tournament('00000000-0000-4000-8000-0000000008c0',
  (select id from public.riot_providers where organization_id = '00000000-0000-4000-8000-0000000008f0'),
  500999, 'Liga M08');
select is((select riot_tournament_id from public.riot_tournaments
  where tournament_id = '00000000-0000-4000-8000-0000000008c0'), 500999::bigint, 'the tournament is registered');

-- Open a game and attach a code ---------------------------------------------------
create temporary table g on commit drop as
select public.svc_open_riot_game('00000000-0000-4000-8000-0000000008aa', 1::smallint,
  '00000000-0000-4000-8000-0000000008d1', '00000000-0000-4000-8000-0000000008d2') as game_id;
grant select on g to authenticated;
select is((select status::text from public.games where id = (select game_id from g)), 'live',
  'opening a game creates it live');
select is(public.svc_open_riot_game('00000000-0000-4000-8000-0000000008aa', 1::smallint,
  '00000000-0000-4000-8000-0000000008d1', '00000000-0000-4000-8000-0000000008d2'), (select game_id from g),
  'opening the same game is idempotent (same id)');

select public.svc_save_tournament_code((select game_id from g), 500999, 'STUB-1', array['puuid-ana', 'puuid-beto'],
  1::smallint, 'HOWLING_ABYSS', 'BLIND_PICK', 'ALL', 'game-1');
select is((select count(*)::int from public.riot_tournament_codes
  where game_id = (select game_id from g) and status = 'active'), 1, 'the code is active');
-- Regenerate: the old code is revoked, the new one is active.
select public.svc_save_tournament_code((select game_id from g), 500999, 'STUB-2', array['puuid-ana', 'puuid-beto'],
  1::smallint, 'HOWLING_ABYSS', 'BLIND_PICK', 'ALL', 'game-1');
select is((select count(*)::int from public.riot_tournament_codes
  where game_id = (select game_id from g) and status = 'active'), 1, 'regenerating leaves one active code');
select is((select status::text from public.riot_tournament_codes where code = 'STUB-1'), 'revoked',
  'the previous code is revoked');

-- Webhook idempotency -------------------------------------------------------------
select is(public.svc_log_inbound_webhook('00000000-0000-4000-8000-0000000008f0', 'riot', 'tournament.result',
  'cb-1', '{"shortCode":"STUB-2"}'::jsonb, true), true, 'the first callback is logged');
select is(public.svc_log_inbound_webhook('00000000-0000-4000-8000-0000000008f0', 'riot', 'tournament.result',
  'cb-1', '{"shortCode":"STUB-2"}'::jsonb, true), false, 'the same callback is a no-op (idempotent)');

-- Record the game result ----------------------------------------------------------
select public.svc_record_riot_game((select game_id from g), '00000000-0000-4000-8000-0000000008d1',
  '{"info":{}}'::jsonb, 1800, '14.20', 'LA1_1',
  jsonb_build_array(jsonb_build_object('entrant_id', '00000000-0000-4000-8000-0000000008d1',
    'puuid', 'puuid-ana', 'side', 'blue', 'champion_id', 103, 'is_expected', true)),
  '[]'::jsonb);
select is((select winner_entrant_id from public.games where id = (select game_id from g)),
  '00000000-0000-4000-8000-0000000008d1'::uuid, 'the game records the winner from the callback');
select is((select status::text from public.riot_tournament_codes where code = 'STUB-2'), 'used',
  'the code is marked used');
select is((select count(*)::int from public.game_participants where game_id = (select game_id from g)), 1,
  'the participants are stored');

-- Integrity alert -----------------------------------------------------------------
select isnt(public.svc_raise_integrity_alert('00000000-0000-4000-8000-0000000008f0', 'roster_mismatch', 3::smallint,
  'game', (select game_id from g), '{"unexpected":["puuid-ringer"]}'::jsonb), null,
  'a roster mismatch raises an integrity alert');

-- RLS -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000008a1", "role": "authenticated"}', true);
select throws_ok($$ select count(*) from public.riot_tournament_codes $$, '42501', null,
  'tournament codes are served by the API only');
select is((select count(*)::int from public.integrity_alerts), 0, 'a player cannot read integrity alerts');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000008e1", "role": "authenticated"}', true);
select is((select count(*)::int from public.integrity_alerts
  where organization_id = '00000000-0000-4000-8000-0000000008f0'), 1, 'a super admin reads the integrity alerts');

reset role;
select * from finish();
rollback;
