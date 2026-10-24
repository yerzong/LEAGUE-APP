-- Module 02: profiles, Riot accounts (icon verification), teams and audit log.
-- Columns follow docs/03-modelo-datos.md §2, §4 and §14. Reads go through RLS;
-- every write goes through the API (service role), multi-row writes through
-- the svc_* functions below so they are atomic.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.player_role as enum ('top', 'jungle', 'mid', 'adc', 'support');
-- Riot platforms supported for now (Americas routing). New ones: alter type … add value.
create type public.game_region as enum ('la1', 'la2', 'na1', 'br1');
create type public.privacy_visibility as enum ('public', 'team', 'staff', 'private');
create type public.social_platform as enum ('twitch', 'youtube', 'tiktok', 'x', 'instagram', 'kick', 'other');
create type public.gender as enum ('woman', 'man', 'non_binary', 'prefer_not_to_say');
create type public.riot_verification_method as enum ('rso', 'icon');
create type public.riot_verification_status as enum ('pending', 'verified', 'expired', 'failed');
create type public.rank_queue as enum ('solo', 'flex');
create type public.team_kind as enum ('permanent', 'ad_hoc');
create type public.team_status as enum ('active', 'inactive', 'disbanded', 'banned');
create type public.team_role as enum ('captain', 'co_captain', 'player', 'substitute', 'coach', 'manager');
create type public.invitation_status as enum ('pending', 'accepted', 'declined', 'expired', 'revoked');
create type public.join_request_status as enum ('pending', 'approved', 'declined', 'withdrawn');
create type public.captaincy_transfer_status as enum ('pending', 'accepted', 'declined', 'canceled');
create type public.club_status as enum ('pending', 'active', 'inactive', 'banned');
create type public.club_role as enum ('owner', 'manager', 'coach', 'analyst');
create type public.audit_actor_type as enum ('user', 'system', 'agent');

-- ---------------------------------------------------------------------------
-- users: public profile columns
-- ---------------------------------------------------------------------------
alter table public.users
  add column avatar_media_id uuid,
  -- Storage path in the `avatars` bucket until the media module exists.
  add column avatar_path text,
  add column bio text check (char_length(bio) <= 280),
  add column country_code text check (country_code ~ '^[A-Z]{2}$'),
  add column game_region public.game_region,
  add column birth_date date,
  add column primary_role public.player_role,
  add column secondary_role public.player_role,
  add column is_free_agent boolean not null default false,
  add constraint users_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  add constraint users_roles_differ check (primary_role is null or primary_role is distinct from secondary_role);

create index users_username_trgm_idx on public.users using gin ((username::text) extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Private data, social links, privacy
-- ---------------------------------------------------------------------------
create table public.user_private_data (
  user_id uuid primary key references public.users (id),
  legal_first_name text check (char_length(legal_first_name) between 1 and 80),
  legal_last_name text check (char_length(legal_last_name) between 1 and 80),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  phone_verified_at timestamptz,
  institutional_email extensions.citext,
  institutional_email_verified_at timestamptz,
  guardian_name text check (char_length(guardian_name) <= 120),
  guardian_contact text check (char_length(guardian_contact) <= 120),
  guardian_consent_at timestamptz,
  gender public.gender,
  gender_declared_at timestamptz,
  -- Set after the first declaration; changing it needs a reviewed request.
  gender_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (gender is null or gender_declared_at is not null)
);

create table public.user_social_links (
  id uuid primary key default private.uuid_v7(),
  user_id uuid not null references public.users (id),
  platform public.social_platform not null,
  url text not null check (url ~ '^https://' and char_length(url) <= 300),
  handle text check (char_length(handle) <= 60),
  visibility public.privacy_visibility not null default 'public',
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, url)
);
create index user_social_links_user_id_idx on public.user_social_links (user_id);

create table public.user_privacy_settings (
  user_id uuid not null references public.users (id),
  field_key text not null check (field_key in ('country', 'game_region', 'roles', 'bio', 'riot_account', 'teams', 'age')),
  visibility public.privacy_visibility not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, field_key)
);

-- ---------------------------------------------------------------------------
-- Riot accounts
-- ---------------------------------------------------------------------------
create table public.riot_accounts (
  id uuid primary key default private.uuid_v7(),
  user_id uuid not null references public.users (id),
  puuid text not null check (char_length(puuid) between 1 and 100),
  game_name text not null check (char_length(game_name) between 3 and 16),
  tag_line text not null check (char_length(tag_line) between 2 and 5),
  region public.game_region not null,
  summoner_level integer check (summoner_level >= 0),
  profile_icon_id integer check (profile_icon_id >= 0),
  is_primary boolean not null default true,
  verification_method public.riot_verification_method not null,
  verified_at timestamptz,
  last_synced_at timestamptz,
  unlinked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One Riot account, one user (docs/03 §2 and §15).
create unique index riot_accounts_puuid_active_key on public.riot_accounts (puuid) where unlinked_at is null;
create unique index riot_accounts_primary_per_user_key on public.riot_accounts (user_id)
  where unlinked_at is null and is_primary;

create table public.riot_verification_attempts (
  id uuid primary key default private.uuid_v7(),
  user_id uuid not null references public.users (id),
  riot_account_id uuid references public.riot_accounts (id),
  method public.riot_verification_method not null,
  puuid text not null,
  game_name text not null,
  tag_line text not null,
  region public.game_region not null,
  expected_icon_id integer not null check (expected_icon_id >= 0),
  status public.riot_verification_status not null default 'pending',
  failure_reason text,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index riot_verification_attempts_pending_key on public.riot_verification_attempts (user_id)
  where status = 'pending';

create table public.riot_rank_snapshots (
  id uuid primary key default private.uuid_v7(),
  riot_account_id uuid not null references public.riot_accounts (id),
  queue public.rank_queue not null,
  tier text not null check (tier in (
    'iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger')),
  division smallint check (division between 1 and 4),
  lp integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  captured_at timestamptz not null default now()
);
create index riot_rank_snapshots_account_idx on public.riot_rank_snapshots (riot_account_id, captured_at desc);

create table public.riot_id_history (
  id uuid primary key default private.uuid_v7(),
  riot_account_id uuid not null references public.riot_accounts (id),
  game_name text not null,
  tag_line text not null,
  seen_at timestamptz not null default now()
);
create index riot_id_history_account_idx on public.riot_id_history (riot_account_id);

-- ---------------------------------------------------------------------------
-- Clubs (tables only for now: teams are independent in this module)
-- ---------------------------------------------------------------------------
create table public.clubs (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  tag text not null,
  slug extensions.citext not null,
  logo_media_id uuid,
  banner_media_id uuid,
  owner_user_id uuid not null references public.users (id),
  description text,
  social_links jsonb not null default '[]',
  website text,
  status public.club_status not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, slug)
);

create table public.club_members (
  id uuid primary key default private.uuid_v7(),
  club_id uuid not null references public.clubs (id),
  user_id uuid not null references public.users (id),
  club_role public.club_role not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Teams
-- ---------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid not null references public.organizations (id),
  club_id uuid references public.clubs (id),
  name text not null check (char_length(name) between 3 and 32),
  tag text not null check (tag ~ '^[A-Z0-9]{2,5}$'),
  slug extensions.citext not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_media_id uuid,
  -- Storage path in the `team-logos` bucket until the media module exists.
  logo_path text,
  banner_media_id uuid,
  kind public.team_kind not null default 'permanent',
  owner_user_id uuid not null references public.users (id),
  region public.game_region not null,
  description text check (char_length(description) <= 500),
  status public.team_status not null default 'active',
  social_links jsonb not null default '[]',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id),
  deleted_at timestamptz,
  unique (organization_id, slug)
);
-- Permanent team names and tags are unique per organization (docs/03 §4).
-- Disbanded teams keep theirs: the history stays attributable.
create unique index teams_name_per_org_key on public.teams (organization_id, lower(name)) where kind = 'permanent';
create unique index teams_tag_per_org_key on public.teams (organization_id, lower(tag)) where kind = 'permanent';
create index teams_owner_user_id_idx on public.teams (owner_user_id);
create index teams_name_trgm_idx on public.teams using gin (name extensions.gin_trgm_ops);

create table public.team_members (
  id uuid primary key default private.uuid_v7(),
  team_id uuid not null references public.teams (id),
  user_id uuid not null references public.users (id),
  team_role public.team_role not null,
  game_role public.player_role,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  left_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id)
);
-- A user appears once in a team's active roster; a team has one captain.
create unique index team_members_active_key on public.team_members (team_id, user_id) where left_at is null;
create unique index team_members_one_captain_key on public.team_members (team_id)
  where left_at is null and team_role = 'captain';
create index team_members_user_active_idx on public.team_members (user_id) where left_at is null;

create table public.team_invitations (
  id uuid primary key default private.uuid_v7(),
  team_id uuid not null references public.teams (id),
  invited_user_id uuid references public.users (id),
  invite_code text unique check (invite_code ~ '^[A-Za-z0-9_-]{16,64}$'),
  team_role public.team_role not null check (team_role <> 'captain'),
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  decided_at timestamptz,
  accepted_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.users (id),
  check (invited_user_id is not null or invite_code is not null)
);
create unique index team_invitations_pending_user_key on public.team_invitations (team_id, invited_user_id)
  where status = 'pending' and invited_user_id is not null;
create index team_invitations_invited_user_idx on public.team_invitations (invited_user_id) where status = 'pending';

create table public.team_join_requests (
  id uuid primary key default private.uuid_v7(),
  team_id uuid not null references public.teams (id),
  user_id uuid not null references public.users (id),
  message text check (char_length(message) <= 280),
  status public.join_request_status not null default 'pending',
  decided_by uuid references public.users (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index team_join_requests_pending_key on public.team_join_requests (team_id, user_id)
  where status = 'pending';

-- Captaincy transfers need the new captain's acceptance (docs/12 §6).
create table public.team_captaincy_transfers (
  id uuid primary key default private.uuid_v7(),
  team_id uuid not null references public.teams (id),
  from_user_id uuid not null references public.users (id),
  to_user_id uuid not null references public.users (id),
  status public.captaincy_transfer_status not null default 'pending',
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);
create unique index team_captaincy_transfers_pending_key on public.team_captaincy_transfers (team_id)
  where status = 'pending';

create table public.team_name_history (
  id uuid primary key default private.uuid_v7(),
  team_id uuid not null references public.teams (id),
  name text not null,
  tag text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references public.users (id)
);
create index team_name_history_team_idx on public.team_name_history (team_id, changed_at desc);

create table public.free_agent_listings (
  id uuid primary key default private.uuid_v7(),
  user_id uuid not null references public.users (id),
  organization_id uuid not null references public.organizations (id),
  roles public.player_role[] not null check (cardinality(roles) between 1 and 5),
  rank_snapshot_id uuid references public.riot_rank_snapshots (id),
  message text check (char_length(message) <= 280),
  -- Zod schema FreeAgentAvailability (packages/contracts), versioned.
  availability jsonb not null default '{"version": 1, "days": []}',
  active_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

-- ---------------------------------------------------------------------------
-- Audit log (docs/03 §14): append-only
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid references public.organizations (id),
  actor_user_id uuid references public.users (id),
  actor_type public.audit_actor_type not null default 'user',
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  ip inet,
  user_agent text,
  correlation_id text,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);

create function private.reject_audit_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end;
$$;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function private.reject_audit_change();

-- ---------------------------------------------------------------------------
-- updated_at and history triggers
-- ---------------------------------------------------------------------------
create trigger user_private_data_set_updated_at before update on public.user_private_data
  for each row execute function private.set_updated_at();
create trigger user_social_links_set_updated_at before update on public.user_social_links
  for each row execute function private.set_updated_at();
create trigger user_privacy_settings_set_updated_at before update on public.user_privacy_settings
  for each row execute function private.set_updated_at();
create trigger riot_accounts_set_updated_at before update on public.riot_accounts
  for each row execute function private.set_updated_at();
create trigger riot_verification_attempts_set_updated_at before update on public.riot_verification_attempts
  for each row execute function private.set_updated_at();
create trigger clubs_set_updated_at before update on public.clubs
  for each row execute function private.set_updated_at();
create trigger club_members_set_updated_at before update on public.club_members
  for each row execute function private.set_updated_at();
create trigger teams_set_updated_at before update on public.teams
  for each row execute function private.set_updated_at();
create trigger team_members_set_updated_at before update on public.team_members
  for each row execute function private.set_updated_at();
create trigger team_invitations_set_updated_at before update on public.team_invitations
  for each row execute function private.set_updated_at();
create trigger team_join_requests_set_updated_at before update on public.team_join_requests
  for each row execute function private.set_updated_at();
create trigger team_captaincy_transfers_set_updated_at before update on public.team_captaincy_transfers
  for each row execute function private.set_updated_at();
create trigger free_agent_listings_set_updated_at before update on public.free_agent_listings
  for each row execute function private.set_updated_at();

create function private.record_team_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name or new.tag is distinct from old.tag then
    insert into public.team_name_history (team_id, name, tag, changed_by)
    values (new.id, new.name, new.tag, coalesce(new.updated_by, new.created_by));
  end if;
  return new;
end;
$$;

create trigger teams_record_name
  after insert or update of name, tag on public.teams
  for each row execute function private.record_team_name();

create function private.record_riot_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.game_name is distinct from old.game_name or new.tag_line is distinct from old.tag_line then
    insert into public.riot_id_history (riot_account_id, game_name, tag_line)
    values (new.id, new.game_name, new.tag_line);
  end if;
  return new;
end;
$$;

create trigger riot_accounts_record_riot_id
  after insert or update of game_name, tag_line on public.riot_accounts
  for each row execute function private.record_riot_id();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
create function private.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = (select auth.uid()) and left_at is null
  );
$$;

revoke execute on function private.is_team_member(uuid) from public, anon;
grant execute on function private.is_team_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security (reads only; writes go through the API)
-- ---------------------------------------------------------------------------
alter table public.user_private_data enable row level security;
alter table public.user_social_links enable row level security;
alter table public.user_privacy_settings enable row level security;
alter table public.riot_accounts enable row level security;
alter table public.riot_verification_attempts enable row level security;
alter table public.riot_rank_snapshots enable row level security;
alter table public.riot_id_history enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invitations enable row level security;
alter table public.team_join_requests enable row level security;
alter table public.team_captaincy_transfers enable row level security;
alter table public.team_name_history enable row level security;
alter table public.free_agent_listings enable row level security;
alter table public.audit_logs enable row level security;

create policy "user_private_data: owner; super admin" on public.user_private_data
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_super_admin()));

create policy "user_social_links: owner; super admin" on public.user_social_links
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_super_admin()));

create policy "user_privacy_settings: owner; super admin" on public.user_privacy_settings
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_super_admin()));

create policy "riot_accounts: owner; super admin" on public.riot_accounts
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_super_admin()));

create policy "riot_verification_attempts: owner" on public.riot_verification_attempts
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "riot_rank_snapshots: owner of the account" on public.riot_rank_snapshots
  for select to authenticated
  using (exists (select 1 from public.riot_accounts a where a.id = riot_account_id));

create policy "riot_id_history: owner of the account" on public.riot_id_history
  for select to authenticated
  using (exists (select 1 from public.riot_accounts a where a.id = riot_account_id));

create policy "teams: everyone reads teams that are not deleted" on public.teams
  for select to anon, authenticated
  using (deleted_at is null);

create policy "team_name_history: public" on public.team_name_history
  for select to anon, authenticated
  using (true);

-- The full roster (with private fields) is for members; the public page goes
-- through the API, which applies each player's privacy settings.
create policy "team_members: members of the team; super admin" on public.team_members
  for select to authenticated
  using (private.is_team_member(team_id) or (select private.is_super_admin()));

create policy "team_invitations: invited user or team members" on public.team_invitations
  for select to authenticated
  using (invited_user_id = (select auth.uid()) or private.is_team_member(team_id));

create policy "team_join_requests: requester or team members" on public.team_join_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_team_member(team_id));

create policy "team_captaincy_transfers: team members" on public.team_captaincy_transfers
  for select to authenticated
  using (private.is_team_member(team_id));

create policy "free_agent_listings: signed-in users read active listings" on public.free_agent_listings
  for select to authenticated
  using (active_until > now() or user_id = (select auth.uid()));

create policy "audit_logs: super admin" on public.audit_logs
  for select to authenticated
  using ((select private.is_super_admin()));

-- ---------------------------------------------------------------------------
-- Data API exposure
-- ---------------------------------------------------------------------------
grant select on
  public.user_private_data, public.user_social_links, public.user_privacy_settings,
  public.riot_accounts, public.riot_verification_attempts, public.riot_rank_snapshots, public.riot_id_history,
  public.teams, public.team_members, public.team_invitations, public.team_join_requests,
  public.team_captaincy_transfers, public.team_name_history, public.free_agent_listings, public.audit_logs
  to authenticated;
grant select on public.teams, public.team_name_history to anon;

-- The API (service role, server side only) writes business tables.
grant select, insert, update, delete on
  public.users, public.organizations, public.organization_members,
  public.user_private_data, public.user_social_links, public.user_privacy_settings,
  public.riot_accounts, public.riot_verification_attempts, public.riot_rank_snapshots, public.riot_id_history,
  public.clubs, public.club_members,
  public.teams, public.team_members, public.team_invitations, public.team_join_requests,
  public.team_captaincy_transfers, public.team_name_history, public.free_agent_listings
  to service_role;
grant select, insert on public.audit_logs to service_role;

-- ---------------------------------------------------------------------------
-- Storage: public images, written only by the API
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('team-logos', 'team-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Atomic writes used by the API. Business rules are checked in the API
-- (packages/core); these only keep multi-row changes consistent.
-- ---------------------------------------------------------------------------
create function public.svc_create_team(
  p_organization_id uuid,
  p_owner_user_id uuid,
  p_name text,
  p_tag text,
  p_slug text,
  p_region public.game_region,
  p_description text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  insert into public.teams (organization_id, owner_user_id, name, tag, slug, region, description, created_by, updated_by)
  values (p_organization_id, p_owner_user_id, p_name, p_tag, p_slug, p_region, p_description, p_owner_user_id, p_owner_user_id)
  returning id into v_team_id;

  insert into public.team_members (team_id, user_id, team_role, created_by, updated_by)
  values (v_team_id, p_owner_user_id, 'captain', p_owner_user_id, p_owner_user_id);

  return v_team_id;
end;
$$;

-- Adds a member from an accepted invitation or an approved join request.
create function public.svc_add_team_member(
  p_team_id uuid,
  p_user_id uuid,
  p_team_role public.team_role,
  p_actor uuid,
  p_invitation_id uuid default null,
  p_join_request_id uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  insert into public.team_members (team_id, user_id, team_role, created_by, updated_by)
  values (p_team_id, p_user_id, p_team_role, p_actor, p_actor)
  returning id into v_member_id;

  if p_invitation_id is not null then
    update public.team_invitations
    set status = 'accepted', decided_at = now(), accepted_by = p_user_id
    where id = p_invitation_id and status = 'pending';
    if not found then
      raise exception 'invitation_not_pending' using errcode = 'P0001';
    end if;
  end if;

  if p_join_request_id is not null then
    update public.team_join_requests
    set status = 'approved', decided_at = now(), decided_by = p_actor
    where id = p_join_request_id and status = 'pending';
    if not found then
      raise exception 'join_request_not_pending' using errcode = 'P0001';
    end if;
  end if;

  -- Other pending invitations and requests of the same user for this team are settled.
  update public.team_invitations set status = 'revoked', decided_at = now()
  where team_id = p_team_id and invited_user_id = p_user_id and status = 'pending';
  update public.team_join_requests set status = 'withdrawn', decided_at = now()
  where team_id = p_team_id and user_id = p_user_id and status = 'pending';

  return v_member_id;
end;
$$;

create function public.svc_accept_captaincy_transfer(p_transfer_id uuid, p_reason text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_transfer public.team_captaincy_transfers;
  v_organization_id uuid;
begin
  select * into v_transfer from public.team_captaincy_transfers where id = p_transfer_id and status = 'pending' for update;
  if not found then
    raise exception 'transfer_not_pending' using errcode = 'P0001';
  end if;

  update public.team_members
  set team_role = 'co_captain', updated_by = v_transfer.to_user_id
  where team_id = v_transfer.team_id and user_id = v_transfer.from_user_id and left_at is null and team_role = 'captain';
  if not found then
    raise exception 'captain_changed' using errcode = 'P0001';
  end if;

  update public.team_members
  set team_role = 'captain', updated_by = v_transfer.to_user_id
  where team_id = v_transfer.team_id and user_id = v_transfer.to_user_id and left_at is null;
  if not found then
    raise exception 'target_not_a_member' using errcode = 'P0001';
  end if;

  update public.teams set owner_user_id = v_transfer.to_user_id, updated_by = v_transfer.to_user_id
  where id = v_transfer.team_id
  returning organization_id into v_organization_id;

  update public.team_captaincy_transfers set status = 'accepted', decided_at = now() where id = p_transfer_id;

  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, before, after, reason)
  values (
    v_organization_id, v_transfer.to_user_id, 'team.captaincy.transferred', 'team', v_transfer.team_id,
    jsonb_build_object('captain_user_id', v_transfer.from_user_id),
    jsonb_build_object('captain_user_id', v_transfer.to_user_id),
    p_reason
  );
end;
$$;

create function public.svc_dissolve_team(p_team_id uuid, p_actor uuid, p_reason text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_team public.teams;
  v_members jsonb;
begin
  select * into v_team from public.teams where id = p_team_id and status <> 'disbanded' for update;
  if not found then
    raise exception 'team_not_active' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'team_role', team_role)), '[]')
  into v_members
  from public.team_members where team_id = p_team_id and left_at is null;

  update public.team_members set left_at = now(), left_reason = 'team_disbanded', updated_by = p_actor
  where team_id = p_team_id and left_at is null;
  update public.team_invitations set status = 'revoked', decided_at = now()
  where team_id = p_team_id and status = 'pending';
  update public.team_join_requests set status = 'declined', decided_at = now(), decided_by = p_actor
  where team_id = p_team_id and status = 'pending';
  update public.team_captaincy_transfers set status = 'canceled', decided_at = now()
  where team_id = p_team_id and status = 'pending';
  update public.teams set status = 'disbanded', updated_by = p_actor where id = p_team_id;

  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, before, after, reason)
  values (
    v_team.organization_id, p_actor, 'team.dissolved', 'team', p_team_id,
    jsonb_build_object('status', v_team.status, 'members', v_members),
    jsonb_build_object('status', 'disbanded'),
    p_reason
  );
end;
$$;

-- p_ranks: [{ "queue": "solo", "tier": "gold", "division": 2, "lp": 40, "wins": 10, "losses": 8 }]
create function public.svc_link_riot_account(
  p_attempt_id uuid,
  p_summoner_level integer,
  p_profile_icon_id integer,
  p_ranks jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_attempt public.riot_verification_attempts;
  v_account_id uuid;
begin
  select * into v_attempt from public.riot_verification_attempts where id = p_attempt_id and status = 'pending' for update;
  if not found then
    raise exception 'attempt_not_pending' using errcode = 'P0001';
  end if;

  insert into public.riot_accounts (
    user_id, puuid, game_name, tag_line, region, summoner_level, profile_icon_id,
    verification_method, verified_at, last_synced_at
  ) values (
    v_attempt.user_id, v_attempt.puuid, v_attempt.game_name, v_attempt.tag_line, v_attempt.region,
    p_summoner_level, p_profile_icon_id, v_attempt.method, now(), now()
  ) returning id into v_account_id;

  insert into public.riot_rank_snapshots (riot_account_id, queue, tier, division, lp, wins, losses)
  select v_account_id, (r ->> 'queue')::public.rank_queue, r ->> 'tier', (r ->> 'division')::smallint,
         coalesce((r ->> 'lp')::int, 0), coalesce((r ->> 'wins')::int, 0), coalesce((r ->> 'losses')::int, 0)
  from jsonb_array_elements(coalesce(p_ranks, '[]')) as r;

  update public.riot_verification_attempts
  set status = 'verified', verified_at = now(), riot_account_id = v_account_id
  where id = p_attempt_id;

  return v_account_id;
end;
$$;

create function public.svc_unlink_riot_account(p_user_id uuid, p_reason text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_account public.riot_accounts;
begin
  select * into v_account from public.riot_accounts where user_id = p_user_id and unlinked_at is null and is_primary for update;
  if not found then
    raise exception 'no_linked_account' using errcode = 'P0001';
  end if;

  update public.riot_accounts set unlinked_at = now() where id = v_account.id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, before, after, reason)
  values (
    p_user_id, 'riot_account.unlinked', 'riot_account', v_account.id,
    jsonb_build_object('puuid', v_account.puuid, 'riot_id', v_account.game_name || '#' || v_account.tag_line),
    jsonb_build_object('unlinked', true),
    p_reason
  );
end;
$$;

-- p_links: [{ "platform": "twitch", "url": "https://…", "handle": "…", "visibility": "public" }]
create function public.svc_replace_social_links(p_user_id uuid, p_links jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.user_social_links where user_id = p_user_id;
  insert into public.user_social_links (user_id, platform, url, handle, visibility, position)
  select p_user_id, (l ->> 'platform')::public.social_platform, l ->> 'url', l ->> 'handle',
         coalesce((l ->> 'visibility')::public.privacy_visibility, 'public'), (ordinality - 1)::smallint
  from jsonb_array_elements(coalesce(p_links, '[]')) with ordinality as t(l, ordinality);
end;
$$;

revoke execute on function
  public.svc_create_team(uuid, uuid, text, text, text, public.game_region, text),
  public.svc_add_team_member(uuid, uuid, public.team_role, uuid, uuid, uuid),
  public.svc_accept_captaincy_transfer(uuid, text),
  public.svc_dissolve_team(uuid, uuid, text),
  public.svc_link_riot_account(uuid, integer, integer, jsonb),
  public.svc_unlink_riot_account(uuid, text),
  public.svc_replace_social_links(uuid, jsonb)
from public, anon, authenticated;

grant execute on function
  public.svc_create_team(uuid, uuid, text, text, text, public.game_region, text),
  public.svc_add_team_member(uuid, uuid, public.team_role, uuid, uuid, uuid),
  public.svc_accept_captaincy_transfer(uuid, text),
  public.svc_dissolve_team(uuid, uuid, text),
  public.svc_link_riot_account(uuid, integer, integer, jsonb),
  public.svc_unlink_riot_account(uuid, text),
  public.svc_replace_social_links(uuid, jsonb)
to service_role;

-- New functions are executable by PUBLIC by default; keep `private` closed
-- (explicit grants such as is_team_member to authenticated stay).
revoke execute on all functions in schema private from public, anon;
