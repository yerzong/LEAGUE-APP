-- Module 04: tournaments and registrations, RLS and integrity (pgTAP).
-- Run with `supabase test db`. Everything runs in a transaction that is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- Fixtures (as the migration owner): Ana captains Aurora with Beto; Carla
-- captains Boreal; Dani captains Cenit; Admin is super admin.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000004a1', 'ana4@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000004b1', 'beto4@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000004c1', 'carla4@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000004d1', 'dani4@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000004e1', 'admin4@test.local', 'authenticated', 'authenticated');
update public.users set platform_role = 'super_admin' where id = '00000000-0000-4000-8000-0000000004e1';

insert into public.organizations (id, name, slug) values
  ('00000000-0000-4000-8000-0000000004f0', 'Org Test', 'test-org-m04');

select public.svc_create_team('00000000-0000-4000-8000-0000000004f0', '00000000-0000-4000-8000-0000000004a1',
  'Aurora4', 'AUR4', 'aurora4', 'la1', null);
select public.svc_create_team('00000000-0000-4000-8000-0000000004f0', '00000000-0000-4000-8000-0000000004c1',
  'Boreal4', 'BOR4', 'boreal4', 'la1', null);
select public.svc_create_team('00000000-0000-4000-8000-0000000004f0', '00000000-0000-4000-8000-0000000004d1',
  'Cenit4', 'CEN4', 'cenit4', 'la1', null);
insert into public.team_members (team_id, user_id, team_role)
select id, '00000000-0000-4000-8000-0000000004b1', 'player' from public.teams where slug = 'aurora4';

create temporary table fixture_config on commit drop as
select jsonb_build_object(
  'tournament', jsonb_build_object(
    'name', 'Relámpago Test', 'type', 'flash', 'tier', 3, 'visibility', 'public',
    'timezone', 'America/Mexico_City', 'capacity', 2, 'waitlist_enabled', true,
    'entrant_kind', 'team', 'team_source', 'permanent_only', 'participant_policy', 'mixed',
    'max_rosters_per_club', 1, 'modality', 'online', 'has_prizes', false,
    'exclusivity_scope', 'tournament', 'supervision_level', 'dual_report',
    'costream_policy', 'disabled', 'costream_delay_seconds', 0, 'settings', '{}'::jsonb, 'schema_version', 1),
  'game', jsonb_build_object('team_size', 2, 'map', 'howling_abyss', 'pick_type', 'blind_pick', 'spectator_type', 'all'),
  'roster', jsonb_build_object('starters', 2, 'max_substitutes', 0, 'coach_allowed', false, 'leave_cooldown_days', 0),
  'eligibility', jsonb_build_array(jsonb_build_object('rule_type', 'riot_account_verified')),
  'windows', jsonb_build_array(jsonb_build_object('weekday', 6, 'start_time', '12:00', 'end_time', '22:00')),
  'blackouts', '[]'::jsonb,
  'prizes', jsonb_build_array(jsonb_build_object('placement_from', 1, 'placement_to', 1, 'prize_type', 'prestige', 'label', 'Campeón'))
) as config;

select public.svc_create_tournament('00000000-0000-4000-8000-0000000004f0', '00000000-0000-4000-8000-0000000004e1',
  'relampago-test', null, (select config from fixture_config));
select public.svc_create_tournament('00000000-0000-4000-8000-0000000004f0', '00000000-0000-4000-8000-0000000004e1',
  'borrador-test', null, (select config from fixture_config));

create temporary table t on commit drop as
select
  (select id from public.tournaments where slug = 'relampago-test') as flash,
  (select id from public.tournaments where slug = 'borrador-test') as draft,
  (select id from public.teams where slug = 'aurora4') as aurora,
  (select id from public.teams where slug = 'boreal4') as boreal,
  (select id from public.teams where slug = 'cenit4') as cenit;
grant select on t to anon, authenticated;

-- Configuration and publishing --------------------------------------------
select is(
  (select team_size from public.tournament_game_settings where tournament_id = (select flash from t)),
  2::smallint, 'creating a tournament writes its game settings');
select is(
  (select count(*)::int from public.eligibility_rules where tournament_id = (select flash from t)),
  1, 'creating a tournament writes its eligibility rules');

select public.svc_save_rulebook_draft((select flash from t), '00000000-0000-4000-8000-0000000004e1',
  'Reglamento', '# Reglas', null);
select public.svc_publish_tournament((select flash from t), '00000000-0000-4000-8000-0000000004e1',
  '[{"name": "Grupos", "position": 1, "format": "groups", "series_format": "bo1", "groups": ["A", "B"]},
    {"name": "Playoffs", "position": 2, "format": "single_elimination", "series_format": "bo3"}]');

select is(
  (select count(*)::int from public.phases where tournament_id = (select flash from t)),
  2, 'publishing creates the phases');
select is(
  (select count(*)::int from public.groups g join public.phases p on p.id = g.phase_id where p.tournament_id = (select flash from t)),
  2, 'publishing creates the groups of a group phase');
select isnt(
  (select current_rulebook_version_id from public.tournaments where id = (select flash from t)),
  null, 'publishing freezes the rulebook draft as the current version');
select throws_ok(
  $$update public.rulebook_versions set content = 'x'$$,
  'P0001', 'rulebook_version_published', 'a published rulebook version cannot change');
select is(
  (select count(*)::int from public.audit_logs where entity_id = (select flash from t) and action = 'tournament.published'),
  1, 'publishing is audited');
select is(
  (select count(*)::int from public.outbox_events where aggregate_id = (select flash from t) and event_type = 'tournament.published'),
  1, 'publishing emits tournament.published to the outbox');

update public.tournaments set status = 'registration_open' where id = (select flash from t);

-- Registrations ------------------------------------------------------------
select public.svc_register_entrant((select flash from t), '00000000-0000-4000-8000-0000000004a1',
  jsonb_build_object('team_id', (select aurora from t), 'display_name', 'Aurora4', 'display_tag', 'AUR4'),
  jsonb_build_array(
    jsonb_build_object('user_id', '00000000-0000-4000-8000-0000000004a1', 'roster_role', 'starter',
      'exclusivity_key', 'tournament:' || (select flash from t)),
    jsonb_build_object('user_id', '00000000-0000-4000-8000-0000000004b1', 'roster_role', 'starter',
      'exclusivity_key', 'tournament:' || (select flash from t))));

select throws_ok(
  $$select public.svc_register_entrant((select flash from t), '00000000-0000-4000-8000-0000000004a1',
      jsonb_build_object('team_id', (select aurora from t), 'display_name', 'Aurora4'), '[]')$$,
  '23505', null, 'a team registers once per tournament');
select throws_ok(
  $$select public.svc_register_entrant((select flash from t), '00000000-0000-4000-8000-0000000004c1',
      jsonb_build_object('team_id', (select boreal from t), 'display_name', 'Boreal4'),
      jsonb_build_array(jsonb_build_object('user_id', '00000000-0000-4000-8000-0000000004b1',
        'roster_role', 'starter', 'exclusivity_key', 'tournament:' || (select flash from t))))$$,
  '23505', null, 'anti-chapulineo: a player cannot be in two rosters of the same scope');

select public.svc_register_entrant((select flash from t), '00000000-0000-4000-8000-0000000004c1',
  jsonb_build_object('team_id', (select boreal from t), 'display_name', 'Boreal4'),
  jsonb_build_array(jsonb_build_object('user_id', '00000000-0000-4000-8000-0000000004c1', 'roster_role', 'starter',
    'exclusivity_key', 'tournament:' || (select flash from t))));
select public.svc_register_entrant((select flash from t), '00000000-0000-4000-8000-0000000004d1',
  jsonb_build_object('team_id', (select cenit from t), 'display_name', 'Cenit4'),
  jsonb_build_array(jsonb_build_object('user_id', '00000000-0000-4000-8000-0000000004d1', 'roster_role', 'starter',
    'exclusivity_key', 'tournament:' || (select flash from t))));

select results_eq(
  $$select status::text, waitlist_position from public.entrants where team_id = (select cenit from t)$$,
  $$values ('waitlisted'::text, 1)$$, 'beyond capacity a registration is waitlisted in order');

select public.svc_decide_entrant(
  (select id from public.entrants where team_id = (select aurora from t)), '00000000-0000-4000-8000-0000000004e1',
  'pending', 'approved', 'registration.approved', 'registration.approved', null);
select is(
  (select count(*)::int from public.audit_logs where action = 'registration.approved'
     and entity_id = (select id from public.entrants where team_id = (select aurora from t))),
  1, 'approving a registration is audited');
select is(
  (select count(*)::int from public.outbox_events where event_type = 'registration.approved'
     and aggregate_id = (select id from public.entrants where team_id = (select aurora from t))),
  1, 'approving emits registration.approved');

select public.svc_decide_entrant(
  (select id from public.entrants where team_id = (select boreal from t)), '00000000-0000-4000-8000-0000000004e1',
  'pending', 'rejected', 'registration.rejected', 'registration.rejected', 'Roster incompleto');
select is(
  (select count(*)::int from public.entrant_roster_members r join public.entrants e on e.id = r.entrant_id
   where e.team_id = (select boreal from t) and r.removed_at is null),
  0, 'rejecting releases the roster (and its exclusivity)');
select is(
  (select status::text from public.entrants where team_id = (select cenit from t)),
  'pending', 'a freed slot promotes the first waitlisted registration');

-- As Carla (Boreal captain) ------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000004c1", "role": "authenticated"}', true);

select results_eq(
  $$select display_name from public.entrants order by display_name$$,
  $$values ('Aurora4'::text), ('Boreal4'::text)$$,
  'a team sees approved registrations and its own, never another team''s pending one');
select is_empty(
  $$select 1 from public.entrant_roster_members r join public.entrants e on e.id = r.entrant_id
    where e.team_id = (select aurora from t)$$,
  'a team cannot read another team''s roster');
select throws_ok(
  $$update public.entrants set status = 'approved' where team_id = (select boreal from t)$$,
  '42501', null, 'only staff approves: clients cannot write registrations');
select throws_ok(
  $$select public.svc_decide_entrant((select id from public.entrants where team_id = (select boreal from t)),
      '00000000-0000-4000-8000-0000000004c1', 'rejected', 'approved', null, 'registration.approved', null)$$,
  '42501', null, 'clients cannot call the registration service functions');
select throws_ok($$select 1 from public.outbox_events$$, '42501', null, 'clients cannot read the outbox');
select is_empty($$select 1 from public.tournament_templates$$, 'templates are staff only');
select is_empty(
  $$select 1 from public.tournaments where slug = 'borrador-test'$$, 'drafts are not visible to players');

-- As Ana (Aurora captain) --------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000004a1", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.entrant_roster_members r join public.entrants e on e.id = r.entrant_id
   where e.team_id = (select aurora from t)),
  2, 'a team reads its own registration roster');

-- As Admin -----------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000004e1", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.tournaments where slug in ('relampago-test', 'borrador-test')),
  2, 'the super admin reads drafts');

-- Anonymous ----------------------------------------------------------------
reset role;
set local role anon;
select results_eq(
  $$select slug::text from public.tournaments where slug in ('relampago-test', 'borrador-test')$$,
  $$values ('relampago-test'::text)$$, 'anon reads published public tournaments only');
select results_eq(
  $$select display_name from public.entrants where tournament_id = (select flash from t)$$,
  $$values ('Aurora4'::text)$$, 'anon reads approved participants only');

select * from finish();
rollback;
