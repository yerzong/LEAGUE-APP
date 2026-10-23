-- Development seed. Loaded only by `supabase db reset` (local and CI);
-- `supabase db push` never sends it to cloud projects.
--
-- Super admin for local development:
--   email: admin@penta.local   password: penta-dev-admin

insert into public.organizations (id, name, slug)
values ('01920000-0000-7000-8000-000000000001', 'PENTA League', 'penta-league');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '01920000-0000-7000-8000-0000000000a1',
  'authenticated', 'authenticated', 'admin@penta.local',
  extensions.crypt('penta-dev-admin', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}', '{"full_name": "Super Admin"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '01920000-0000-7000-8000-0000000000a1',
  '01920000-0000-7000-8000-0000000000a1',
  'email',
  '{"sub": "01920000-0000-7000-8000-0000000000a1", "email": "admin@penta.local", "email_verified": true}',
  now(), now(), now()
);

-- The profile row was created by the on_auth_user_created trigger.
update public.users
set platform_role = 'super_admin', username = 'admin'
where id = '01920000-0000-7000-8000-0000000000a1';

insert into public.organization_members (organization_id, user_id, status, joined_at)
values ('01920000-0000-7000-8000-000000000001', '01920000-0000-7000-8000-0000000000a1', 'active', now());
