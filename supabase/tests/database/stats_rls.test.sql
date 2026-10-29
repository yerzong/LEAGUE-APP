-- Module 09: stats, achievements and follows: RLS, the recalculation queue
-- and the idempotent save (pgTAP). Run with `supabase test db`; everything
-- runs in a transaction that is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Fixtures: Ana (Aurora) beats Beto (Boreal) in a bo1; Dani is a stranger.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000009a1', 'ana9@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000009b1', 'beto9@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000009d1', 'dani9@test.local', 'authenticated', 'authenticated');
insert into public.organizations (id, name, slug) values
  ('00000000-0000-4000-8000-0000000009f0', 'Org Test', 'test-org-m09');
insert into public.tournaments (id, organization_id, slug, name, status) values
  ('00000000-0000-4000-8000-0000000009c0', '00000000-0000-4000-8000-0000000009f0', 'liga-m09', 'Liga M09', 'in_progress');
insert into public.phases (id, tournament_id, name, position, format, series_format) values
  ('00000000-0000-4000-8000-0000000009c1', '00000000-0000-4000-8000-0000000009c0', 'Liga', 1, 'round_robin', 'bo1');
insert into public.entrants (id, tournament_id, user_id, display_name, status, registered_by) values
  ('00000000-0000-4000-8000-0000000009e1', '00000000-0000-4000-8000-0000000009c0',
   '00000000-0000-4000-8000-0000000009a1', 'Aurora9', 'approved', '00000000-0000-4000-8000-0000000009a1'),
  ('00000000-0000-4000-8000-0000000009e2', '00000000-0000-4000-8000-0000000009c0',
   '00000000-0000-4000-8000-0000000009b1', 'Boreal9', 'approved', '00000000-0000-4000-8000-0000000009b1');
insert into public.matches (id, organization_id, tournament_id, phase_id, bracket_key, round, position,
  entrant_a_id, entrant_b_id, series_format, status) values
  ('00000000-0000-4000-8000-0000000009aa', '00000000-0000-4000-8000-0000000009f0',
   '00000000-0000-4000-8000-0000000009c0', '00000000-0000-4000-8000-0000000009c1', 'r1-m1', 1, 1,
   '00000000-0000-4000-8000-0000000009e1', '00000000-0000-4000-8000-0000000009e2', 'bo1', 'live');
insert into public.games (id, match_id, game_number, status, blue_entrant_id, red_entrant_id, winner_entrant_id) values
  ('00000000-0000-4000-8000-0000000009ab', '00000000-0000-4000-8000-0000000009aa', 1, 'completed',
   '00000000-0000-4000-8000-0000000009e1', '00000000-0000-4000-8000-0000000009e2', '00000000-0000-4000-8000-0000000009e1'),
  ('00000000-0000-4000-8000-0000000009ac', '00000000-0000-4000-8000-0000000009aa', 2, 'pending',
   '00000000-0000-4000-8000-0000000009e2', '00000000-0000-4000-8000-0000000009e1', null);

-- What one recalculation of the match writes (built by the API from packages/core).
create temporary table stats_payload on commit drop as
select jsonb_build_object(
  'games', jsonb_build_array(jsonb_build_object(
    'game_id', '00000000-0000-4000-8000-0000000009ab',
    'players', jsonb_build_array(
      jsonb_build_object('user_id', '00000000-0000-4000-8000-0000000009a1', 'puuid', 'puuid-ana',
        'entrant_id', '00000000-0000-4000-8000-0000000009e1', 'side', 'blue', 'champion_id', 103,
        'game_role', 'mid', 'win', true, 'duration_seconds', 1800, 'played_at', '2026-10-24T20:00:00Z',
        'kills', 8, 'deaths', 1, 'assists', 6, 'kda', 14, 'cs', 270, 'cs_per_min', 9, 'gold', 13500,
        'gold_per_min', 450, 'damage_to_champions', 20000, 'damage_per_min', 666.67, 'damage_share', 1,
        'damage_taken', 9000, 'vision_score', 30, 'vision_per_min', 1, 'wards_placed', 10, 'wards_killed', 2,
        'kill_participation', 1, 'first_blood', true, 'score', 60, 'is_mvp', true,
        'items', '[3089]'::jsonb, 'runes', '{"keystone": 8112}'::jsonb)),
    'teams', jsonb_build_array(
      jsonb_build_object('entrant_id', '00000000-0000-4000-8000-0000000009e1', 'side', 'blue', 'win', true,
        'duration_seconds', 1800, 'played_at', '2026-10-24T20:00:00Z', 'kills', 8, 'gold', 13500,
        'towers', 9, 'dragons', 3, 'barons', 1, 'heralds', 1, 'grubs', 3, 'inhibitors', 2,
        'bans', '[1, 2, 3]'::jsonb)),
    'events', jsonb_build_array(jsonb_build_object('type', 'first_blood', 'actor_puuid', 'puuid-ana', 'side', 'blue')))),
  'player_aggregates', jsonb_build_array(jsonb_build_object(
    'user_id', '00000000-0000-4000-8000-0000000009a1', 'scope_type', 'all_time', 'scope_id', null,
    'games', 1, 'wins', 1, 'kills', 8, 'deaths', 1, 'assists', 6, 'kda', 14, 'avg_cs_per_min', 9,
    'avg_gold_per_min', 450, 'avg_damage_per_min', 666.67, 'avg_vision', 1, 'avg_kp', 1,
    'avg_damage_share', 1, 'avg_score', 60, 'mvps', 1,
    'radar', '{"aggression": 80, "vision": 32, "farming": 88, "teamfight": 100, "survival": 100}'::jsonb)),
  'player_champions', jsonb_build_object(
    'scopes', jsonb_build_array(jsonb_build_object('user_id', '00000000-0000-4000-8000-0000000009a1', 'scope_type', 'all_time')),
    'rows', jsonb_build_array(jsonb_build_object('user_id', '00000000-0000-4000-8000-0000000009a1',
      'scope_type', 'all_time', 'champion_id', 103, 'games', 1, 'wins', 1, 'kills', 8, 'deaths', 1,
      'assists', 6, 'kda', 14))),
  'champion_meta', jsonb_build_array(
    jsonb_build_object('champion_id', 103, 'picks', 1, 'bans', 0, 'wins', 1),
    jsonb_build_object('champion_id', 1, 'picks', 0, 'bans', 1, 'wins', 0)),
  'mvp_scopes', jsonb_build_array(jsonb_build_object('scope_type', 'game', 'scope_id', '00000000-0000-4000-8000-0000000009ab')),
  'mvp_awards', jsonb_build_array(jsonb_build_object('scope_type', 'game',
    'scope_id', '00000000-0000-4000-8000-0000000009ab', 'user_id', '00000000-0000-4000-8000-0000000009a1',
    'entrant_id', '00000000-0000-4000-8000-0000000009e1', 'score', 60)),
  'achievements', jsonb_build_array(jsonb_build_object('user_id', '00000000-0000-4000-8000-0000000009a1',
    'achievement_id', (select id from public.achievements where organization_id is null and key = 'first_win'),
    'context', '{"gameId": "00000000-0000-4000-8000-0000000009ab"}'::jsonb))
) as data;

-- The queue ---------------------------------------------------------------------
update public.matches set status = 'completed', winner_entrant_id = '00000000-0000-4000-8000-0000000009e1',
  score_a = 1, finalized_at = now()
where id = '00000000-0000-4000-8000-0000000009aa';
select is((select count(*)::int from public.stats_jobs where match_id = '00000000-0000-4000-8000-0000000009aa'
  and processed_at is null), 1, 'closing a match enqueues its recalculation');
select is((select count(*)::int from public.svc_claim_stats_jobs(10, 60)
  where match_id = '00000000-0000-4000-8000-0000000009aa'), 1, 'the worker leases the job');
select is((select count(*)::int from public.svc_claim_stats_jobs(10, 60)
  where match_id = '00000000-0000-4000-8000-0000000009aa'), 0, 'a leased job is not taken twice');

-- The idempotent save -----------------------------------------------------------
select is(public.svc_save_match_stats('00000000-0000-4000-8000-0000000009aa',
  (select requested_at from public.stats_jobs where match_id = '00000000-0000-4000-8000-0000000009aa'),
  (select data from stats_payload)), 1, 'the first save awards the achievement');
select isnt((select processed_at from public.stats_jobs where match_id = '00000000-0000-4000-8000-0000000009aa'),
  null, 'and marks the job processed');
select is(public.svc_save_match_stats('00000000-0000-4000-8000-0000000009aa',
  (select requested_at from public.stats_jobs where match_id = '00000000-0000-4000-8000-0000000009aa'),
  (select data from stats_payload)), 0, 'saving the same recalculation again awards nothing');
select is((select count(*)::int from public.player_game_stats where match_id = '00000000-0000-4000-8000-0000000009aa')
  + (select count(*)::int from public.player_aggregate_stats where user_id = '00000000-0000-4000-8000-0000000009a1')
  + (select count(*)::int from public.player_champion_stats where user_id = '00000000-0000-4000-8000-0000000009a1')
  + (select count(*)::int from public.mvp_awards where tournament_id = '00000000-0000-4000-8000-0000000009c0')
  + (select count(*)::int from public.champion_meta_stats where tournament_id = '00000000-0000-4000-8000-0000000009c0'),
  6, 'and leaves exactly one copy of every row');
select is((select bans from public.team_game_stats where game_id = '00000000-0000-4000-8000-0000000009ab'),
  array[1, 2, 3], 'the bans are stored as an array');

-- Requested again while it ran: it stays pending for one more pass.
select public.svc_claim_stats_jobs(10, 60);
update public.games set raw_match_payload = '{"info": {}}' where id = '00000000-0000-4000-8000-0000000009ab';
select public.svc_save_match_stats('00000000-0000-4000-8000-0000000009aa', now() - interval '1 minute', (select data from stats_payload));
select is((select processed_at from public.stats_jobs where match_id = '00000000-0000-4000-8000-0000000009aa'),
  null, 'match data that arrives meanwhile requests one more pass');

select throws_ok(
  $$select public.svc_attach_game_data('00000000-0000-4000-8000-0000000009ac', null, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb)$$,
  'P0001', 'game_not_completed', 'match data only attaches to a completed game');

insert into public.follows (follower_user_id, followable_type, followable_id) values
  ('00000000-0000-4000-8000-0000000009a1', 'tournament', '00000000-0000-4000-8000-0000000009c0'),
  ('00000000-0000-4000-8000-0000000009b1', 'user', '00000000-0000-4000-8000-0000000009a1');

-- Anonymous visitors --------------------------------------------------------------
set local role anon;
select is((select count(*)::int from public.player_aggregate_stats where user_id = '00000000-0000-4000-8000-0000000009a1'),
  1, 'aggregates are public (the profile reads them live)');
select is((select count(*)::int from public.champion_meta_stats where tournament_id = '00000000-0000-4000-8000-0000000009c0'),
  2, 'so is the champion meta of a tournament');
select throws_ok($$ select count(*) from public.player_game_stats $$, '42501', null,
  'game lines (they carry the PUUID) are served by the API only');
select throws_ok($$ select count(*) from public.follows $$, '42501', null, 'anonymous visitors see no follows');
select throws_ok($$ select count(*) from public.stats_jobs $$, '42501', null, 'nor the queue');

-- Signed-in users -----------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000009a1", "role": "authenticated"}', true);
select is((select count(*)::int from public.follows), 1, 'Ana sees only her own follows');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000009d1", "role": "authenticated"}', true);
select is((select count(*)::int from public.follows where followable_id = '00000000-0000-4000-8000-0000000009a1'),
  0, 'nobody else learns who follows Ana');
select throws_ok(
  $$ insert into public.follows (follower_user_id, followable_type, followable_id)
     values ('00000000-0000-4000-8000-0000000009d1', 'user', '00000000-0000-4000-8000-0000000009a1') $$,
  '42501', null, 'clients do not write follows (the API does)');
select throws_ok($$ update public.player_aggregate_stats set kills = 99 $$, '42501', null,
  'nor the aggregates');
select throws_ok($$ select public.svc_request_tournament_stats('00000000-0000-4000-8000-0000000009c0', null) $$,
  '42501', null, 'clients cannot call the service functions');

reset role;
select * from finish();
rollback;
