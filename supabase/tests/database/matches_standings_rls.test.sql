-- Module 05: matches, results and standings, RLS and integrity (pgTAP).
-- Run with `supabase test db`. Everything runs in a transaction that is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Fixtures: Ana (Aurora) and Carla (Boreal) are approved in a published
-- tournament; Dani is a stranger; Admin is super admin.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000005a1', 'ana5@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000005c1', 'carla5@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000005d1', 'dani5@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000005e1', 'admin5@test.local', 'authenticated', 'authenticated');
update public.users set platform_role = 'super_admin' where id = '00000000-0000-4000-8000-0000000005e1';
insert into public.organizations (id, name, slug) values
  ('00000000-0000-4000-8000-0000000005f0', 'Org Test', 'test-org-m05');

select public.svc_create_team('00000000-0000-4000-8000-0000000005f0', '00000000-0000-4000-8000-0000000005a1',
  'Aurora5', 'AUR5', 'aurora5', 'la1', null);
select public.svc_create_team('00000000-0000-4000-8000-0000000005f0', '00000000-0000-4000-8000-0000000005c1',
  'Boreal5', 'BOR5', 'boreal5', 'la1', null);

select public.svc_create_tournament('00000000-0000-4000-8000-0000000005f0', '00000000-0000-4000-8000-0000000005e1',
  'relampago-m05', null, jsonb_build_object(
    'tournament', jsonb_build_object(
      'name', 'Relámpago M05', 'type', 'flash', 'tier', 3, 'visibility', 'public', 'timezone', 'America/Mexico_City',
      'capacity', 8, 'waitlist_enabled', true, 'entrant_kind', 'team', 'team_source', 'permanent_only',
      'participant_policy', 'mixed', 'max_rosters_per_club', 1, 'modality', 'online', 'has_prizes', false,
      'exclusivity_scope', 'tournament', 'supervision_level', 'dual_report', 'costream_policy', 'disabled',
      'costream_delay_seconds', 0, 'settings', '{}'::jsonb, 'schema_version', 1),
    'game', jsonb_build_object('team_size', 1, 'map', 'howling_abyss', 'pick_type', 'blind_pick', 'spectator_type', 'all'),
    'roster', jsonb_build_object('starters', 1, 'max_substitutes', 0, 'coach_allowed', false, 'leave_cooldown_days', 0)));
select public.svc_save_rulebook_draft((select id from public.tournaments where slug = 'relampago-m05'),
  '00000000-0000-4000-8000-0000000005e1', 'Reglamento', 'Reglas', null);
select public.svc_publish_tournament((select id from public.tournaments where slug = 'relampago-m05'),
  '00000000-0000-4000-8000-0000000005e1',
  '[{"name": "Eliminación", "position": 1, "format": "single_elimination", "series_format": "bo1"}]');
update public.tournaments set status = 'registration_open' where slug = 'relampago-m05';

select public.svc_register_entrant((select id from public.tournaments where slug = 'relampago-m05'),
  '00000000-0000-4000-8000-0000000005a1',
  jsonb_build_object('team_id', (select id from public.teams where slug = 'aurora5'), 'display_name', 'Aurora5'),
  jsonb_build_array(jsonb_build_object('user_id', '00000000-0000-4000-8000-0000000005a1', 'roster_role', 'starter')));
select public.svc_register_entrant((select id from public.tournaments where slug = 'relampago-m05'),
  '00000000-0000-4000-8000-0000000005c1',
  jsonb_build_object('team_id', (select id from public.teams where slug = 'boreal5'), 'display_name', 'Boreal5'),
  jsonb_build_array(jsonb_build_object('user_id', '00000000-0000-4000-8000-0000000005c1', 'roster_role', 'starter')));
update public.entrants set status = 'approved'
where tournament_id = (select id from public.tournaments where slug = 'relampago-m05');

create temporary table f on commit drop as
select
  (select id from public.tournaments where slug = 'relampago-m05') as tournament,
  (select p.id from public.phases p join public.tournaments t on t.id = p.tournament_id where t.slug = 'relampago-m05') as phase,
  (select e.id from public.entrants e join public.teams tm on tm.id = e.team_id where tm.slug = 'aurora5') as aurora,
  (select e.id from public.entrants e join public.teams tm on tm.id = e.team_id where tm.slug = 'boreal5') as boreal,
  '00000000-0000-4000-8000-0000000005aa'::uuid as final;
grant select on f to anon, authenticated;

-- Fixtures and the unit of work -------------------------------------------
select public.svc_commit_competition((select tournament from f), '00000000-0000-4000-8000-0000000005e1',
  jsonb_build_object(
    'tournament_transition', jsonb_build_object('from', 'registration_open', 'to', 'in_progress'),
    'phases_update', jsonb_build_array(jsonb_build_object('id', (select phase from f), 'status', 'in_progress')),
    'phase_entrants_upsert', jsonb_build_array(
      jsonb_build_object('phase_id', (select phase from f), 'entrant_id', (select aurora from f), 'seed', 1),
      jsonb_build_object('phase_id', (select phase from f), 'entrant_id', (select boreal from f), 'seed', 2)),
    'matches_insert', jsonb_build_array(jsonb_build_object(
      'id', (select final from f), 'phase_id', (select phase from f), 'bracket_key', 'r1-m1', 'round', 1,
      'position', 1, 'entrant_a_id', (select aurora from f), 'entrant_b_id', (select boreal from f),
      'series_format', 'bo1')),
    'events', jsonb_build_array(jsonb_build_object('aggregate_type', 'tournament',
      'aggregate_id', (select tournament from f), 'event_type', 'tournament.fixtures_generated', 'payload', '{}'::jsonb))));

select is((select count(*)::int from public.matches where tournament_id = (select tournament from f)), 1,
  'generating fixtures inserts the matches');
select is((select status::text from public.tournaments where id = (select tournament from f)), 'in_progress',
  'the tournament transition is applied in the same transaction');
select is((select count(*)::int from public.outbox_events where event_type = 'tournament.fixtures_generated'
  and aggregate_id = (select tournament from f)), 1, 'domain events go to the outbox');

select public.svc_commit_competition((select tournament from f), '00000000-0000-4000-8000-0000000005e1',
  jsonb_build_object('matches_update', jsonb_build_array(jsonb_build_object(
    'id', (select final from f), 'version', 1, 'set', jsonb_build_object('status', 'checkin')))));
select is((select version from public.matches where id = (select final from f)), 2, 'every change bumps the version');
select throws_ok(
  $$select public.svc_commit_competition((select tournament from f), '00000000-0000-4000-8000-0000000005e1',
    jsonb_build_object('matches_update', jsonb_build_array(jsonb_build_object(
      'id', (select final from f), 'version', 1, 'set', jsonb_build_object('status', 'ready')))))$$,
  'P0001', 'match_version_conflict', 'optimistic lock: a stale version is refused');
select throws_ok(
  $$update public.matches set winner_entrant_id = '00000000-0000-4000-8000-0000000005d1' where id = (select final from f)$$,
  '23514', null, 'the winner must be one of the two participants');

select public.svc_commit_competition((select tournament from f), '00000000-0000-4000-8000-0000000005a1',
  jsonb_build_object('checkins_insert', jsonb_build_array(jsonb_build_object(
    'match_id', (select final from f), 'entrant_id', (select aurora from f),
    'user_id', '00000000-0000-4000-8000-0000000005a1'))));
select throws_ok(
  $$insert into public.match_checkins (match_id, entrant_id) values ((select final from f), (select aurora from f))$$,
  '23505', null, 'one check-in per registration and match');

select public.svc_commit_competition((select tournament from f), '00000000-0000-4000-8000-0000000005a1',
  jsonb_build_object('reports_insert', jsonb_build_array(jsonb_build_object(
    'match_id', (select final from f), 'reported_by_entrant_id', (select aurora from f),
    'reported_by_user_id', '00000000-0000-4000-8000-0000000005a1', 'winner_entrant_id', (select aurora from f),
    'score_a', 1, 'score_b', 0, 'games', '[{"number": 1, "winner": "a"}]'::jsonb))));
select public.svc_commit_competition((select tournament from f), '00000000-0000-4000-8000-0000000005c1',
  jsonb_build_object('disputes_insert', jsonb_build_array(jsonb_build_object(
    'match_id', (select final from f), 'opened_by_entrant_id', (select boreal from f),
    'opened_by_user_id', '00000000-0000-4000-8000-0000000005c1', 'description', 'Ganamos nosotros'))));
select throws_ok(
  $$insert into public.disputes (match_id, description) values ((select final from f), 'Otra')$$,
  '23505', null, 'one open dispute per match');

select public.svc_commit_competition((select tournament from f), '00000000-0000-4000-8000-0000000005e1',
  jsonb_build_object(
    'matches_update', jsonb_build_array(jsonb_build_object('id', (select final from f), 'version', 2,
      'set', jsonb_build_object('status', 'completed', 'winner_entrant_id', (select aurora from f), 'score_a', 1,
        'result_source', 'admin_override'))),
    'games_replace', jsonb_build_array(jsonb_build_object('match_id', (select final from f), 'games', jsonb_build_array(
      jsonb_build_object('game_number', 1, 'status', 'completed', 'blue_entrant_id', (select aurora from f),
        'red_entrant_id', (select boreal from f), 'winner_entrant_id', (select aurora from f))))),
    'standings_replace', jsonb_build_array(jsonb_build_object('phase_id', (select phase from f), 'rows', jsonb_build_array(
      jsonb_build_object('entrant_id', (select aurora from f), 'rank', 1, 'wins', 1, 'played', 1, 'status', 'qualified'),
      jsonb_build_object('entrant_id', (select boreal from f), 'rank', 2, 'losses', 1, 'played', 1, 'status', 'eliminated')))),
    'audits', jsonb_build_array(jsonb_build_object('action', 'match.result.override', 'entity_type', 'match',
      'entity_id', (select final from f), 'reason', 'Resolución de disputa'))));
select is((select count(*)::int from public.standings where phase_id = (select phase from f)), 2,
  'standings are replaced from packages/core');
select is((select count(*)::int from public.audit_logs where action = 'match.result.override'
  and entity_id = (select final from f)), 1, 'a result override is audited');
select throws_ok(
  $$insert into public.games (match_id, game_number, blue_entrant_id, red_entrant_id)
    values ((select final from f), 1, (select aurora from f), (select boreal from f))$$,
  '23505', null, 'one game per number in a series');
select ok(
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'matches')
  or not exists (select 1 from pg_publication where pubname = 'supabase_realtime'),
  'matches are published to Realtime');

-- As Dani (stranger) -------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000005d1", "role": "authenticated"}', true);
select is((select count(*)::int from public.matches where id = (select final from f)), 1,
  'matches of a public tournament are readable');
select is_empty($$select 1 from public.result_reports$$, 'a stranger cannot read result reports');
select is_empty($$select 1 from public.disputes$$, 'a stranger cannot read disputes');
select throws_ok($$update public.matches set score_a = 3$$, '42501', null, 'clients cannot write matches');
select throws_ok(
  $$select public.svc_commit_competition((select tournament from f), '00000000-0000-4000-8000-0000000005d1', '{}')$$,
  '42501', null, 'clients cannot call the competition service function');

-- As Carla (the opponent) --------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000005c1", "role": "authenticated"}', true);
select is((select count(*)::int from public.result_reports where match_id = (select final from f)), 1,
  'both registrations of the match see its reports');

-- Anonymous ----------------------------------------------------------------
reset role;
set local role anon;
select is((select count(*)::int from public.standings where phase_id = (select phase from f)), 2,
  'anon reads the standings of a public tournament');

select * from finish();
rollback;
