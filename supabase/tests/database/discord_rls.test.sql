-- Module 07: Discord guild config, channel links, temp channels and the user
-- link — RLS and the service functions (pgTAP). Run with `supabase test db`;
-- everything runs in a transaction that is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Fixtures: Ana is a player, Admin is super admin.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000007a1', 'ana7@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000007e1', 'admin7@test.local', 'authenticated', 'authenticated');
update public.users set platform_role = 'super_admin' where id = '00000000-0000-4000-8000-0000000007e1';
insert into public.organizations (id, name, slug) values
  ('00000000-0000-4000-8000-0000000007f0', 'Org Test', 'test-org-m07');

-- Connect the guild (idempotent: a second save updates the same row).
select is(
  public.svc_save_discord_guild('00000000-0000-4000-8000-0000000007f0',
    '00000000-0000-4000-8000-0000000007e1', '123456789', 'PENTA', '{"features":{"checkin":true}}') is not null,
  true, 'connecting the guild returns its id');
select public.svc_save_discord_guild('00000000-0000-4000-8000-0000000007f0',
  '00000000-0000-4000-8000-0000000007e1', '123456789', 'PENTA (renombrado)', '{"features":{"checkin":false}}');
select is((select count(*)::int from public.discord_guilds where organization_id = '00000000-0000-4000-8000-0000000007f0'),
  1, 'one guild per organization, updated in place');
select is((select name from public.discord_guilds where organization_id = '00000000-0000-4000-8000-0000000007f0'),
  'PENTA (renombrado)', 'the second save updated the name');

-- Channel links: set, replace, clear.
select public.svc_set_discord_channel('00000000-0000-4000-8000-0000000007f0',
  '00000000-0000-4000-8000-0000000007e1', 'staff', '555000111', null);
select is((select channel_id from public.discord_channel_links l
  join public.discord_guilds g on g.id = l.guild_id
  where g.organization_id = '00000000-0000-4000-8000-0000000007f0' and l.purpose = 'staff'),
  '555000111', 'the staff channel is set');
select public.svc_set_discord_channel('00000000-0000-4000-8000-0000000007f0',
  '00000000-0000-4000-8000-0000000007e1', 'staff', '555000222', null);
select is((select count(*)::int from public.discord_channel_links l
  join public.discord_guilds g on g.id = l.guild_id
  where g.organization_id = '00000000-0000-4000-8000-0000000007f0' and l.purpose = 'staff'),
  1, 'setting the same purpose replaces the channel, not duplicates it');
select public.svc_set_discord_channel('00000000-0000-4000-8000-0000000007f0',
  '00000000-0000-4000-8000-0000000007e1', 'staff', null, null);
select is((select count(*)::int from public.discord_channel_links l
  join public.discord_guilds g on g.id = l.guild_id
  where g.organization_id = '00000000-0000-4000-8000-0000000007f0' and l.purpose = 'staff'),
  0, 'a null channel clears the link');

-- Link a user to a Discord id.
select public.svc_link_discord_user('00000000-0000-4000-8000-0000000007a1', '999888777', 'ana');
select is((select discord_user_id from public.user_discord_links where user_id = '00000000-0000-4000-8000-0000000007a1'),
  '999888777', 'the user is linked to their Discord id');

-- Reads under RLS ----------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000007a1", "role": "authenticated"}', true);
select is((select count(*)::int from public.user_discord_links), 1, 'Ana sees her own link');
select is((select count(*)::int from public.discord_guilds), 0, 'a player cannot read the guild config');
select throws_ok($$ select count(*) from public.discord_temp_channels $$, '42501', null,
  'temp channel bookkeeping is API only');
select throws_ok(
  $$ insert into public.discord_channel_links (guild_id, purpose, channel_id)
     values ('00000000-0000-4000-8000-000000000700', 'staff', '1') $$,
  '42501', null, 'clients do not write channel links');
select throws_ok(
  $$ select public.svc_save_discord_guild('00000000-0000-4000-8000-0000000007f0', null, '1', 'x', '{}') $$,
  '42501', null, 'clients cannot call the service functions');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000007e1", "role": "authenticated"}', true);
select is((select count(*)::int from public.discord_guilds), 1, 'a super admin reads the guild config');
select is((select count(*)::int from public.user_discord_links), 0,
  'but a super admin does not read other users'' Discord links');

reset role;
select * from finish();
rollback;
