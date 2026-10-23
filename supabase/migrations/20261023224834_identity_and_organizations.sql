-- Module 00c: user profiles, organizations and membership.
-- Columns follow docs/03-modelo-datos.md §2 and §3, limited to what this module needs.

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Internal helpers. The `private` schema is never exposed through the Data API.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- UUID v7 (time-ordered). Postgres 17 has no native uuidv7().
create function private.uuid_v7()
returns uuid
language sql
volatile
set search_path = ''
as $$
  select encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(gen_random_uuid())
          placing substring(int8send((extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
          from 1 for 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid;
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.platform_role as enum ('user', 'support', 'super_admin');
create type public.user_status as enum ('active', 'suspended', 'banned');
create type public.organization_status as enum ('active', 'suspended');
create type public.member_status as enum ('invited', 'active', 'removed');

-- ---------------------------------------------------------------------------
-- users: public profile, 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table public.users (
  -- No ON DELETE CASCADE: profiles are soft-deleted and anonymized, never dropped.
  id uuid primary key references auth.users (id),
  username extensions.citext unique,
  display_name text check (char_length(display_name) <= 50),
  locale text not null default 'es-419',
  platform_role public.platform_role not null default 'user',
  status public.user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- organizations (tenants)
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default private.uuid_v7(),
  name text not null check (char_length(name) between 2 and 80),
  slug extensions.citext not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status public.organization_status not null default 'active',
  default_timezone text not null default 'America/Mexico_City',
  default_locale text not null default 'es-419',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
create table public.organization_members (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null references public.users (id),
  status public.member_status not null default 'invited',
  invited_by uuid references public.users (id),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id),
  unique (organization_id, user_id),
  check (status <> 'active' or joined_at is not null)
);

create index organization_members_user_id_active_idx
  on public.organization_members (user_id)
  where status = 'active';

create trigger users_set_updated_at
  before update on public.users
  for each row execute function private.set_updated_at();
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- New auth user -> profile row
-- ---------------------------------------------------------------------------
create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, display_name)
  values (
    new.id,
    left(
      nullif(
        trim(coalesce(
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          new.raw_user_meta_data ->> 'user_name'
        )),
        ''
      ),
      50
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- RLS helpers. SECURITY DEFINER so policies do not recurse into RLS.
-- ---------------------------------------------------------------------------
create function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users
    where id = (select auth.uid())
      and platform_role = 'super_admin'
      and status = 'active'
      and deleted_at is null
  );
$$;

create function private.is_active_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_super_admin() to authenticated;
grant execute on function private.is_active_member(uuid) to authenticated;
grant execute on function private.uuid_v7() to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security. Reads only: business writes go through the API.
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy "users: read own profile; super admin reads all"
  on public.users for select to authenticated
  using (id = (select auth.uid()) or (select private.is_super_admin()));

create policy "organizations: members read their organization; super admin reads all"
  on public.organizations for select to authenticated
  using (
    (deleted_at is null and private.is_active_member(id))
    or (select private.is_super_admin())
  );

create policy "organization_members: members read their organization; super admin reads all"
  on public.organization_members for select to authenticated
  using (private.is_active_member(organization_id) or (select private.is_super_admin()));

-- Data API exposure: authenticated users can read (filtered by RLS). Nothing for anon.
grant select on public.users, public.organizations, public.organization_members to authenticated;
