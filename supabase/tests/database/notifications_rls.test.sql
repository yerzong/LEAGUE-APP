-- Module 06: notifications, RLS and the idempotent enqueue (pgTAP).
-- Run with `supabase test db`. Everything runs in a transaction that is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Fixtures: Ana and Beto are players; Admin is super admin. One outbox event
-- notifies Ana (in-app + email) and Beto (in-app).
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000006a1', 'ana6@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000006b1', 'beto6@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000006e1', 'admin6@test.local', 'authenticated', 'authenticated');
update public.users set platform_role = 'super_admin' where id = '00000000-0000-4000-8000-0000000006e1';
insert into public.organizations (id, name, slug) values
  ('00000000-0000-4000-8000-0000000006f0', 'Org Test', 'test-org-m06');
insert into public.outbox_events (id, organization_id, aggregate_type, aggregate_id, event_type, payload) values
  ('00000000-0000-4000-8000-0000000006ee', '00000000-0000-4000-8000-0000000006f0', 'entrant',
   '00000000-0000-4000-8000-0000000006aa', 'registration.approved', '{}');

create temporary table items on commit drop as
select jsonb_build_array(
  jsonb_build_object('user_id', '00000000-0000-4000-8000-0000000006a1', 'type_key', 'registration.approved',
    'title', 'Inscripción aprobada', 'body', 'Aurora ya está dentro.', 'link', '/app/torneos/x', 'data', '{}'::jsonb,
    'deliveries', jsonb_build_array(
      jsonb_build_object('channel', 'in_app', 'subject', 'Inscripción aprobada', 'body', 'Aurora ya está dentro.'),
      jsonb_build_object('channel', 'email', 'subject', 'Aurora está dentro', 'body', 'Hola, Ana'))),
  jsonb_build_object('user_id', '00000000-0000-4000-8000-0000000006b1', 'type_key', 'registration.approved',
    'title', 'Inscripción aprobada', 'body', 'Aurora ya está dentro.', 'link', '/app/torneos/x', 'data', '{}'::jsonb,
    'deliveries', jsonb_build_array(
      jsonb_build_object('channel', 'in_app', 'subject', 'Inscripción aprobada', 'body', 'Aurora ya está dentro.')))
) as payload;

-- Idempotent enqueue ----------------------------------------------------------
select is(public.svc_enqueue_notifications('00000000-0000-4000-8000-0000000006ee', (select payload from items)), 2,
  'the first run writes one notification per recipient');
select isnt((select published_at from public.outbox_events where id = '00000000-0000-4000-8000-0000000006ee'), null,
  'and marks the event published');
update public.outbox_events set published_at = null where id = '00000000-0000-4000-8000-0000000006ee';
select is(public.svc_enqueue_notifications('00000000-0000-4000-8000-0000000006ee', (select payload from items)), 0,
  'processing the same event again writes nothing');
select is((select count(*)::integer from public.notification_deliveries
  where source_event_id = '00000000-0000-4000-8000-0000000006ee'), 3, 'one delivery per user and channel, no duplicates');
select is((select status::text from public.notification_deliveries
  where source_event_id = '00000000-0000-4000-8000-0000000006ee' and channel = 'email'), 'queued',
  'email waits in the queue; in-app is delivered with the row');

insert into public.user_notification_preferences (user_id, category, channel, enabled) values
  ('00000000-0000-4000-8000-0000000006a1', 'matches', 'email', false),
  ('00000000-0000-4000-8000-0000000006b1', 'matches', 'email', true);

-- Each user reads only their own ----------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000006a1", "role": "authenticated"}', true);

select is((select count(*)::integer from public.notifications), 1, 'Ana sees only her notification');
select is((select count(*)::integer from public.notifications where user_id = '00000000-0000-4000-8000-0000000006b1'), 0,
  'Ana cannot read Beto''s notifications');
select is((select count(*)::integer from public.notification_deliveries), 2, 'Ana sees only her deliveries');
select is((select count(*)::integer from public.user_notification_preferences), 1, 'Ana sees only her preferences');
select ok((select count(*) from public.notification_types) > 0, 'the type catalog is readable when signed in');
select throws_ok($$ select count(*) from public.notification_templates $$, '42501', null,
  'templates are served by the API only');
select throws_ok($$ select count(*) from public.notification_rules $$, '42501', null, 'rules are served by the API only');
select throws_ok($$ update public.notifications set read_at = now() $$, '42501', null,
  'clients cannot mark notifications read directly (the API does)');
select throws_ok(
  $$ select public.svc_enqueue_notifications('00000000-0000-4000-8000-0000000006ee', '[]'::jsonb) $$,
  '42501', null, 'clients cannot call the service functions');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000006e1", "role": "authenticated"}', true);
select is((select count(*)::integer from public.notification_deliveries
  where source_event_id = '00000000-0000-4000-8000-0000000006ee'), 3, 'a super admin sees every delivery');
select is((select count(*)::integer from public.notifications
  where source_event_id = '00000000-0000-4000-8000-0000000006ee'), 0, 'but not other users'' inboxes');

reset role;
select * from finish();
rollback;
