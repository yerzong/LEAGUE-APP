-- Module 04: seasons, circuits, tournaments (configuration), rulebooks,
-- registrations (entrants and rosters), phase structure and the
-- transactional outbox (docs/03 §5, §6.1–6.3, §12, §15–16).
--
-- Reads are open through RLS where the public site needs them; every write
-- goes through the API (service role) and the svc_* functions below, which
-- keep multi-row changes, audit entries and domain events in one transaction.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.season_status as enum ('upcoming', 'active', 'completed', 'archived');
create type public.circuit_status as enum ('draft', 'active', 'completed', 'archived');
create type public.exclusivity_scope as enum ('none', 'tournament', 'circuit', 'season');
create type public.tournament_type as enum ('league', 'flash', 'womens', 'university', 'ranked_tier', 'custom');
create type public.tournament_status as enum (
  'draft', 'published', 'registration_open', 'registration_closed', 'seeding',
  'in_progress', 'completed', 'canceled', 'archived');
create type public.tournament_visibility as enum ('public', 'unlisted', 'private');
create type public.entrant_kind as enum ('team', 'solo');
create type public.team_source as enum ('permanent_only', 'ad_hoc_allowed', 'ad_hoc_only');
create type public.participant_policy as enum ('independent_only', 'clubs_only', 'mixed');
create type public.tournament_modality as enum ('online', 'onsite', 'hybrid');
create type public.supervision_level as enum ('automatic', 'dual_report', 'referee', 'broadcast');
create type public.costream_policy as enum ('disabled', 'registered_creators', 'approval_required');
create type public.game_map as enum ('summoners_rift', 'howling_abyss');
create type public.pick_type as enum ('tournament_draft', 'blind_pick', 'draft_mode', 'all_random');
create type public.spectator_type as enum ('none', 'lobbyonly', 'all');
create type public.eligibility_target as enum ('player', 'team_average', 'roster');
create type public.tournament_staff_role as enum ('manager', 'referee', 'producer', 'caster');
create type public.prize_award_type as enum ('placement', 'mvp', 'special');
create type public.prize_type as enum ('cash', 'peripheral', 'merch', 'in_game', 'voucher', 'prestige', 'custom');
create type public.prize_distribution as enum ('team', 'per_player', 'captain');
create type public.prize_delivery_status as enum ('pending', 'shipped', 'delivered', 'claimed');
create type public.entrant_status as enum ('pending', 'approved', 'rejected', 'waitlisted', 'withdrawn', 'disqualified');
create type public.roster_role as enum ('starter', 'substitute', 'coach');
create type public.roster_change_action as enum ('add', 'remove', 'swap');
create type public.roster_change_status as enum ('pending', 'approved', 'rejected', 'canceled');
create type public.phase_format as enum (
  'round_robin', 'double_round_robin', 'groups', 'single_elimination', 'double_elimination', 'swiss', 'gauntlet');
create type public.series_format as enum ('bo1', 'bo3', 'bo5');
create type public.draft_mode as enum ('standard', 'fearless');
create type public.phase_status as enum ('pending', 'in_progress', 'completed');
create type public.phase_entrant_status as enum ('active', 'eliminated', 'advanced');

-- ---------------------------------------------------------------------------
-- Seasons and circuits (docs/03 §5). Managed in a later module; the wizard
-- can already attach a tournament to them.
-- ---------------------------------------------------------------------------
create table public.seasons (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (char_length(name) between 2 and 80),
  starts_at timestamptz,
  ends_at timestamptz,
  status public.season_status not null default 'upcoming',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index seasons_organization_idx on public.seasons (organization_id);

create table public.circuits (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid not null references public.organizations (id),
  season_id uuid references public.seasons (id),
  name text not null check (char_length(name) between 2 and 80),
  description text,
  points_config jsonb not null default '{}',
  exclusivity_scope public.exclusivity_scope not null default 'none'
    check (exclusivity_scope in ('none', 'circuit')),
  status public.circuit_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index circuits_organization_idx on public.circuits (organization_id);

-- ---------------------------------------------------------------------------
-- Templates and tournaments (docs/03 §6.1)
-- ---------------------------------------------------------------------------
create table public.tournament_templates (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (char_length(name) between 3 and 80),
  -- The whole wizard configuration (TournamentConfigSchema in packages/contracts).
  config jsonb not null,
  schema_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id)
);
create unique index tournament_templates_name_key on public.tournament_templates (organization_id, lower(name));

create table public.tournaments (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid not null references public.organizations (id),
  season_id uuid references public.seasons (id),
  template_id uuid references public.tournament_templates (id) on delete set null,
  slug extensions.citext not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 3 and 80),
  type public.tournament_type not null default 'flash',
  tier smallint not null default 3 check (tier between 1 and 3),
  status public.tournament_status not null default 'draft',
  visibility public.tournament_visibility not null default 'public',
  description text check (char_length(description) <= 2000),
  cover_media_id uuid,
  -- Storage path in the `tournament-covers` bucket until the media module exists.
  cover_path text,
  timezone text not null default 'America/Mexico_City',
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer check (capacity between 2 and 512),
  waitlist_enabled boolean not null default true,
  entrant_kind public.entrant_kind not null default 'team',
  team_source public.team_source not null default 'permanent_only',
  participant_policy public.participant_policy not null default 'mixed',
  max_rosters_per_club smallint not null default 1 check (max_rosters_per_club >= 1),
  modality public.tournament_modality not null default 'online',
  -- { name, address, city, mapUrl, capacity }: only onsite or hybrid.
  venue jsonb,
  has_prizes boolean not null default false,
  prize_pool_summary text check (char_length(prize_pool_summary) <= 200),
  exclusivity_scope public.exclusivity_scope not null default 'tournament',
  supervision_level public.supervision_level not null default 'dual_report',
  costream_policy public.costream_policy not null default 'disabled',
  costream_delay_seconds integer not null default 0 check (costream_delay_seconds between 0 and 3600),
  current_rulebook_version_id uuid,
  -- Phase definitions, check-in, broadcast, communication and fee
  -- (TournamentSettingsSchema, versioned by schema_version).
  settings jsonb not null default '{}',
  schema_version smallint not null default 1,
  published_at timestamptz,
  published_by uuid references public.users (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users (id),
  updated_by uuid references public.users (id),
  unique (organization_id, slug),
  check (registration_closes_at is null or registration_opens_at is null or registration_closes_at > registration_opens_at),
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
  check (venue is null or modality <> 'online')
);
create index tournaments_listing_idx on public.tournaments (organization_id, status, starts_at)
  where deleted_at is null;

create table public.circuit_tournaments (
  circuit_id uuid not null references public.circuits (id),
  tournament_id uuid not null references public.tournaments (id),
  weight numeric(5, 2) not null default 1 check (weight > 0),
  created_at timestamptz not null default now(),
  primary key (circuit_id, tournament_id)
);
-- A tournament feeds at most one circuit (the exclusivity scope is one circuit).
create unique index circuit_tournaments_tournament_key on public.circuit_tournaments (tournament_id);

create table public.tournament_game_settings (
  tournament_id uuid primary key references public.tournaments (id),
  team_size smallint not null default 5 check (team_size between 1 and 5),
  map public.game_map not null default 'summoners_rift',
  pick_type public.pick_type not null default 'tournament_draft',
  spectator_type public.spectator_type not null default 'all',
  custom_win_condition text check (char_length(custom_win_condition) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tournament_roster_rules (
  tournament_id uuid primary key references public.tournaments (id),
  starters smallint not null default 5 check (starters between 1 and 5),
  max_substitutes smallint not null default 2 check (max_substitutes between 0 and 5),
  coach_allowed boolean not null default true,
  max_roster_changes smallint check (max_roster_changes between 0 and 20),
  roster_lock_at_phase_id uuid,
  min_games_for_playoffs smallint check (min_games_for_playoffs between 0 and 50),
  leave_cooldown_days smallint not null default 0 check (leave_cooldown_days between 0 and 90),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Specification pattern: rule types and params are validated by packages/core.
create table public.eligibility_rules (
  id uuid primary key default private.uuid_v7(),
  tournament_id uuid not null references public.tournaments (id),
  rule_type text not null check (rule_type ~ '^[a-z_]+$'),
  params jsonb not null default '{}',
  applies_to public.eligibility_target not null default 'player',
  position smallint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, position)
);

create table public.schedule_windows (
  id uuid primary key default private.uuid_v7(),
  tournament_id uuid not null references public.tournaments (id),
  phase_id uuid,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null,
  slot_minutes smallint not null default 60 check (slot_minutes between 15 and 600),
  parallel_matches smallint not null default 1 check (parallel_matches between 1 and 64),
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index schedule_windows_tournament_idx on public.schedule_windows (tournament_id);

create table public.schedule_blackouts (
  id uuid primary key default private.uuid_v7(),
  tournament_id uuid not null references public.tournaments (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index schedule_blackouts_tournament_idx on public.schedule_blackouts (tournament_id);

create table public.rulebooks (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid not null references public.organizations (id),
  tournament_id uuid references public.tournaments (id),
  title text not null check (char_length(title) between 3 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index rulebooks_tournament_key on public.rulebooks (tournament_id) where tournament_id is not null;

create table public.rulebook_versions (
  id uuid primary key default private.uuid_v7(),
  rulebook_id uuid not null references public.rulebooks (id),
  version integer not null check (version >= 1),
  content text not null check (char_length(content) between 1 and 50000),
  change_summary text check (char_length(change_summary) <= 500),
  published_at timestamptz,
  published_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users (id),
  unique (rulebook_id, version)
);
-- One draft per rulebook; published versions are frozen (docs/13 §10).
create unique index rulebook_versions_one_draft_key on public.rulebook_versions (rulebook_id)
  where published_at is null;

alter table public.tournaments
  add constraint tournaments_current_rulebook_version_fkey
  foreign key (current_rulebook_version_id) references public.rulebook_versions (id);

create table public.tournament_staff (
  tournament_id uuid not null references public.tournaments (id),
  user_id uuid not null references public.users (id),
  staff_role public.tournament_staff_role not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.users (id),
  primary key (tournament_id, user_id, staff_role)
);
create index tournament_staff_user_idx on public.tournament_staff (user_id);

create table public.tournament_prizes (
  id uuid primary key default private.uuid_v7(),
  tournament_id uuid not null references public.tournaments (id),
  placement_from smallint check (placement_from >= 1),
  placement_to smallint,
  award_type public.prize_award_type not null default 'placement',
  label text check (char_length(label) <= 80),
  prize_type public.prize_type not null,
  description text check (char_length(description) <= 500),
  -- Cents (docs/03 §0).
  amount bigint check (amount >= 0),
  currency char(3),
  quantity integer not null default 1 check (quantity >= 1),
  sponsor_id uuid,
  image_media_id uuid,
  distribution public.prize_distribution not null default 'team',
  position smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount is null or currency is not null),
  check (placement_to is null or placement_from is null or placement_to >= placement_from),
  check (award_type <> 'placement' or placement_from is not null)
);
create index tournament_prizes_tournament_idx on public.tournament_prizes (tournament_id, position);

-- ---------------------------------------------------------------------------
-- Registrations (docs/03 §6.2)
-- ---------------------------------------------------------------------------
create table public.entrants (
  id uuid primary key default private.uuid_v7(),
  tournament_id uuid not null references public.tournaments (id),
  team_id uuid references public.teams (id),
  user_id uuid references public.users (id),
  -- Snapshot at registration: renames later do not rewrite past brackets.
  display_name text not null,
  display_tag text,
  logo_media_id uuid,
  logo_path text,
  status public.entrant_status not null default 'pending',
  seed smallint check (seed >= 1),
  rejection_reason text check (char_length(rejection_reason) <= 500),
  waitlist_position integer check (waitlist_position >= 1),
  rulebook_version_id uuid references public.rulebook_versions (id),
  registered_by uuid not null references public.users (id),
  approved_by uuid references public.users (id),
  approved_at timestamptz,
  payment_id uuid,
  -- EligibilityResult of packages/core at registration (rule, user and reason codes).
  check_eligibility_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (team_id is not null or user_id is not null),
  check ((status = 'waitlisted') = (waitlist_position is not null))
);
-- A team (or solo player) registers once per tournament (docs/03 §15).
create unique index entrants_team_per_tournament_key on public.entrants (tournament_id, team_id)
  where status not in ('withdrawn', 'rejected') and team_id is not null;
create unique index entrants_solo_per_tournament_key on public.entrants (tournament_id, user_id)
  where status not in ('withdrawn', 'rejected') and team_id is null;
create index entrants_tournament_status_idx on public.entrants (tournament_id, status);
create index entrants_team_idx on public.entrants (team_id) where team_id is not null;

create table public.entrant_roster_members (
  id uuid primary key default private.uuid_v7(),
  entrant_id uuid not null references public.entrants (id),
  user_id uuid not null references public.users (id),
  riot_account_id uuid references public.riot_accounts (id),
  roster_role public.roster_role not null,
  game_role public.player_role,
  -- 'season:<id>' | 'circuit:<id>' | 'tournament:<id>' | null, from packages/core.
  exclusivity_key text check (exclusivity_key ~ '^(season|circuit|tournament):[0-9a-f-]{36}$'),
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- ANTI-CHAPULINEO guaranteed by the database (docs/03 §6.2, §15): one active
-- roster per player and exclusivity scope.
create unique index entrant_roster_members_exclusivity_key on public.entrant_roster_members (user_id, exclusivity_key)
  where removed_at is null and exclusivity_key is not null;
-- A player appears once in a registration's active roster.
create unique index entrant_roster_members_once_key on public.entrant_roster_members (entrant_id, user_id)
  where removed_at is null;
create index entrant_roster_members_user_active_idx on public.entrant_roster_members (user_id)
  where removed_at is null;

create table public.roster_change_requests (
  id uuid primary key default private.uuid_v7(),
  entrant_id uuid not null references public.entrants (id),
  action public.roster_change_action not null,
  user_id uuid not null references public.users (id),
  replaces_user_id uuid references public.users (id),
  reason text check (char_length(reason) <= 500),
  status public.roster_change_status not null default 'pending',
  requested_by uuid not null references public.users (id),
  decided_by uuid references public.users (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((action = 'swap') = (replaces_user_id is not null))
);
create index roster_change_requests_entrant_idx on public.roster_change_requests (entrant_id);

create table public.prize_deliveries (
  id uuid primary key default private.uuid_v7(),
  tournament_prize_id uuid not null references public.tournament_prizes (id),
  entrant_id uuid not null references public.entrants (id),
  recipient_user_id uuid references public.users (id),
  status public.prize_delivery_status not null default 'pending',
  shipping_info_ref text,
  tracking text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index prize_deliveries_prize_idx on public.prize_deliveries (tournament_prize_id);

-- ---------------------------------------------------------------------------
-- Phase structure (docs/03 §6.3). Created empty on publish; fixtures land in
-- module 05.
-- ---------------------------------------------------------------------------
create table public.phases (
  id uuid primary key default private.uuid_v7(),
  tournament_id uuid not null references public.tournaments (id),
  name text not null check (char_length(name) between 2 and 60),
  position smallint not null check (position >= 1),
  format public.phase_format not null,
  series_format public.series_format not null,
  final_series_format public.series_format,
  draft_mode public.draft_mode not null default 'standard',
  points_config jsonb not null default '{}',
  tiebreakers jsonb not null default '[]',
  advancement jsonb not null default '{}',
  format_config jsonb not null default '{}',
  status public.phase_status not null default 'pending',
  starts_at timestamptz,
  schema_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, position)
);

alter table public.tournament_roster_rules
  add constraint tournament_roster_rules_lock_phase_fkey
  foreign key (roster_lock_at_phase_id) references public.phases (id) on delete set null;
alter table public.schedule_windows
  add constraint schedule_windows_phase_fkey
  foreign key (phase_id) references public.phases (id) on delete cascade;

create table public.groups (
  id uuid primary key default private.uuid_v7(),
  phase_id uuid not null references public.phases (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  position smallint not null check (position >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phase_id, position)
);

create table public.phase_entrants (
  phase_id uuid not null references public.phases (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  entrant_id uuid not null references public.entrants (id),
  seed smallint check (seed >= 1),
  status public.phase_entrant_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (phase_id, entrant_id)
);

-- ---------------------------------------------------------------------------
-- Transactional outbox (docs/03 §12, docs/04). Written with the change that
-- causes the event; a later worker publishes it. Payloads carry ids, no PII.
-- ---------------------------------------------------------------------------
create table public.outbox_events (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid references public.organizations (id),
  aggregate_type text not null check (aggregate_type ~ '^[a-z_]+$'),
  aggregate_id uuid not null,
  event_type text not null check (event_type ~ '^[a-z_]+(\.[a-z_]+)+$'),
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  published_at timestamptz,
  attempts integer not null default 0
);
create index outbox_events_unpublished_idx on public.outbox_events (occurred_at) where published_at is null;
create index outbox_events_aggregate_idx on public.outbox_events (aggregate_type, aggregate_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger seasons_set_updated_at before update on public.seasons
  for each row execute function private.set_updated_at();
create trigger circuits_set_updated_at before update on public.circuits
  for each row execute function private.set_updated_at();
create trigger tournament_templates_set_updated_at before update on public.tournament_templates
  for each row execute function private.set_updated_at();
create trigger tournaments_set_updated_at before update on public.tournaments
  for each row execute function private.set_updated_at();
create trigger tournament_game_settings_set_updated_at before update on public.tournament_game_settings
  for each row execute function private.set_updated_at();
create trigger tournament_roster_rules_set_updated_at before update on public.tournament_roster_rules
  for each row execute function private.set_updated_at();
create trigger eligibility_rules_set_updated_at before update on public.eligibility_rules
  for each row execute function private.set_updated_at();
create trigger schedule_windows_set_updated_at before update on public.schedule_windows
  for each row execute function private.set_updated_at();
create trigger schedule_blackouts_set_updated_at before update on public.schedule_blackouts
  for each row execute function private.set_updated_at();
create trigger rulebooks_set_updated_at before update on public.rulebooks
  for each row execute function private.set_updated_at();
create trigger rulebook_versions_set_updated_at before update on public.rulebook_versions
  for each row execute function private.set_updated_at();
create trigger tournament_prizes_set_updated_at before update on public.tournament_prizes
  for each row execute function private.set_updated_at();
create trigger entrants_set_updated_at before update on public.entrants
  for each row execute function private.set_updated_at();
create trigger entrant_roster_members_set_updated_at before update on public.entrant_roster_members
  for each row execute function private.set_updated_at();
create trigger roster_change_requests_set_updated_at before update on public.roster_change_requests
  for each row execute function private.set_updated_at();
create trigger prize_deliveries_set_updated_at before update on public.prize_deliveries
  for each row execute function private.set_updated_at();
create trigger phases_set_updated_at before update on public.phases
  for each row execute function private.set_updated_at();
create trigger groups_set_updated_at before update on public.groups
  for each row execute function private.set_updated_at();
create trigger phase_entrants_set_updated_at before update on public.phase_entrants
  for each row execute function private.set_updated_at();

-- Published rulebook versions are frozen: a change is a new version.
create function private.reject_published_rulebook_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.published_at is not null then
    raise exception 'rulebook_version_published' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger rulebook_versions_frozen
  before update on public.rulebook_versions
  for each row execute function private.reject_published_rulebook_change();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
create function private.is_tournament_staff(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tournament_staff
    where tournament_id = p_tournament_id and user_id = (select auth.uid())
  );
$$;

-- The viewer may see a registration that is not public yet: their team's,
-- their own, or one they submitted.
create function private.owns_entrant(p_entrant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entrants e
    where e.id = p_entrant_id
      and (
        e.registered_by = (select auth.uid())
        or e.user_id = (select auth.uid())
        or (e.team_id is not null and exists (
          select 1 from public.team_members m
          where m.team_id = e.team_id and m.user_id = (select auth.uid()) and m.left_at is null))
      )
  );
$$;

revoke execute on function private.is_tournament_staff(uuid), private.owns_entrant(uuid) from public, anon;
grant execute on function private.is_tournament_staff(uuid), private.owns_entrant(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security (reads only; writes go through the API)
-- ---------------------------------------------------------------------------
alter table public.seasons enable row level security;
alter table public.circuits enable row level security;
alter table public.circuit_tournaments enable row level security;
alter table public.tournament_templates enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_game_settings enable row level security;
alter table public.tournament_roster_rules enable row level security;
alter table public.eligibility_rules enable row level security;
alter table public.schedule_windows enable row level security;
alter table public.schedule_blackouts enable row level security;
alter table public.rulebooks enable row level security;
alter table public.rulebook_versions enable row level security;
alter table public.tournament_staff enable row level security;
alter table public.tournament_prizes enable row level security;
alter table public.prize_deliveries enable row level security;
alter table public.entrants enable row level security;
alter table public.entrant_roster_members enable row level security;
alter table public.roster_change_requests enable row level security;
alter table public.phases enable row level security;
alter table public.groups enable row level security;
alter table public.phase_entrants enable row level security;
alter table public.outbox_events enable row level security;

create policy "seasons: everyone" on public.seasons
  for select to anon, authenticated using (true);
create policy "circuits: everyone reads circuits that are not drafts" on public.circuits
  for select to anon, authenticated using (status <> 'draft');
create policy "circuit_tournaments: everyone" on public.circuit_tournaments
  for select to anon, authenticated using (true);
create policy "tournament_templates: super admin" on public.tournament_templates
  for select to authenticated using ((select private.is_super_admin()));

-- Published public and unlisted tournaments are open; drafts and private ones
-- only for staff.
create policy "tournaments: anon reads published public or unlisted" on public.tournaments
  for select to anon
  using (deleted_at is null and status <> 'draft' and visibility in ('public', 'unlisted'));
create policy "tournaments: published public or unlisted; staff; super admin" on public.tournaments
  for select to authenticated
  using (
    (deleted_at is null and status <> 'draft' and visibility in ('public', 'unlisted'))
    or (select private.is_super_admin())
    or (select private.is_tournament_staff(id))
  );

-- Configuration is readable exactly when its tournament is (RLS applies to the subquery).
create policy "tournament_game_settings: with the tournament" on public.tournament_game_settings
  for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id));
create policy "tournament_roster_rules: with the tournament" on public.tournament_roster_rules
  for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id));
create policy "eligibility_rules: with the tournament" on public.eligibility_rules
  for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id));
create policy "schedule_windows: with the tournament" on public.schedule_windows
  for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id));
create policy "schedule_blackouts: with the tournament" on public.schedule_blackouts
  for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id));
create policy "tournament_prizes: with the tournament" on public.tournament_prizes
  for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id));
create policy "phases: with the tournament" on public.phases
  for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id));
create policy "groups: with the phase" on public.groups
  for select to anon, authenticated
  using (exists (select 1 from public.phases p where p.id = phase_id));
create policy "phase_entrants: with the phase" on public.phase_entrants
  for select to anon, authenticated
  using (exists (select 1 from public.phases p where p.id = phase_id));

create policy "rulebooks: organization-wide or with the tournament" on public.rulebooks
  for select to anon, authenticated
  using (tournament_id is null or exists (select 1 from public.tournaments t where t.id = tournament_id));
create policy "rulebook_versions: anon reads published versions" on public.rulebook_versions
  for select to anon
  using (published_at is not null and exists (select 1 from public.rulebooks r where r.id = rulebook_id));
create policy "rulebook_versions: published versions; super admin" on public.rulebook_versions
  for select to authenticated
  using (
    (published_at is not null and exists (select 1 from public.rulebooks r where r.id = rulebook_id))
    or (select private.is_super_admin())
  );

create policy "tournament_staff: own assignments; super admin" on public.tournament_staff
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "prize_deliveries: recipient; super admin" on public.prize_deliveries
  for select to authenticated
  using (recipient_user_id = (select auth.uid()) or (select private.is_super_admin()));

-- Approved registrations are public (participants); the rest only for their
-- team, their submitter and staff. One team never sees another team's.
create policy "entrants: anon reads approved entrants of visible tournaments" on public.entrants
  for select to anon
  using (status = 'approved' and exists (select 1 from public.tournaments t where t.id = tournament_id));
create policy "entrants: approved; own; staff; super admin" on public.entrants
  for select to authenticated
  using (
    (status = 'approved' and exists (select 1 from public.tournaments t where t.id = tournament_id))
    or (select private.owns_entrant(id))
    or (select private.is_tournament_staff(tournament_id))
    or (select private.is_super_admin())
  );
create policy "entrant_roster_members: own registration; staff; super admin" on public.entrant_roster_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.owns_entrant(entrant_id))
    or (select private.is_super_admin())
    or exists (
      select 1 from public.entrants e
      where e.id = entrant_id and (select private.is_tournament_staff(e.tournament_id)))
  );
create policy "roster_change_requests: own registration; super admin" on public.roster_change_requests
  for select to authenticated
  using ((select private.owns_entrant(entrant_id)) or (select private.is_super_admin()));
-- outbox_events: no policy and no client grant (server only).

-- ---------------------------------------------------------------------------
-- Data API exposure
-- ---------------------------------------------------------------------------
grant select on
  public.seasons, public.circuits, public.circuit_tournaments,
  public.tournaments, public.tournament_game_settings, public.tournament_roster_rules,
  public.eligibility_rules, public.schedule_windows, public.schedule_blackouts,
  public.rulebooks, public.rulebook_versions, public.tournament_prizes,
  public.phases, public.groups, public.phase_entrants
  to anon, authenticated;
grant select on
  public.tournament_templates, public.tournament_staff, public.prize_deliveries,
  public.entrant_roster_members, public.roster_change_requests
  to authenticated;
-- Entrants: the public columns only (no eligibility detail, payment or reviewer).
grant select (
  id, tournament_id, team_id, user_id, display_name, display_tag, logo_path, status, seed,
  waitlist_position, created_at
) on public.entrants to anon, authenticated;

grant select, insert, update, delete on
  public.seasons, public.circuits, public.circuit_tournaments, public.tournament_templates,
  public.tournaments, public.tournament_game_settings, public.tournament_roster_rules,
  public.eligibility_rules, public.schedule_windows, public.schedule_blackouts,
  public.rulebooks, public.rulebook_versions, public.tournament_staff,
  public.tournament_prizes, public.prize_deliveries,
  public.entrants, public.entrant_roster_members, public.roster_change_requests,
  public.phases, public.groups, public.phase_entrants, public.outbox_events
  to service_role;

-- ---------------------------------------------------------------------------
-- Storage: tournament covers, written only by the API
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('tournament-covers', 'tournament-covers', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Write helpers: audit entries and domain events in the caller's transaction
-- ---------------------------------------------------------------------------
create function private.write_audit(
  p_organization_id uuid, p_actor uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_before jsonb, p_after jsonb, p_reason text
)
returns void
language sql
set search_path = ''
as $$
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, before, after, reason)
  values (p_organization_id, p_actor, p_action, p_entity_type, p_entity_id, p_before, p_after, p_reason);
$$;

create function private.emit_event(
  p_organization_id uuid, p_aggregate_type text, p_aggregate_id uuid, p_event_type text, p_payload jsonb
)
returns void
language sql
set search_path = ''
as $$
  insert into public.outbox_events (organization_id, aggregate_type, aggregate_id, event_type, payload)
  values (p_organization_id, p_aggregate_type, p_aggregate_id, p_event_type, coalesce(p_payload, '{}'));
$$;

-- Writes the configuration of a tournament from the API's flat payload:
-- { tournament: {columns}, game: {…}, roster: {…}, eligibility: [], windows: [],
--   blackouts: [], prizes: [], circuit_id }. Child rows are replaced.
create function private.apply_tournament_config(p_tournament_id uuid, p_actor uuid, p_config jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_timezone text;
begin
  update public.tournaments t set
    season_id = c.season_id, name = c.name, type = c.type, tier = c.tier, visibility = c.visibility,
    description = c.description, timezone = c.timezone,
    registration_opens_at = c.registration_opens_at, registration_closes_at = c.registration_closes_at,
    starts_at = c.starts_at, ends_at = c.ends_at, capacity = c.capacity, waitlist_enabled = c.waitlist_enabled,
    entrant_kind = c.entrant_kind, team_source = c.team_source, participant_policy = c.participant_policy,
    max_rosters_per_club = c.max_rosters_per_club, modality = c.modality, venue = c.venue,
    has_prizes = c.has_prizes, prize_pool_summary = c.prize_pool_summary,
    exclusivity_scope = c.exclusivity_scope, supervision_level = c.supervision_level,
    costream_policy = c.costream_policy, costream_delay_seconds = c.costream_delay_seconds,
    settings = c.settings, schema_version = c.schema_version, updated_by = p_actor
  from jsonb_populate_record(null::public.tournaments, p_config -> 'tournament') c
  where t.id = p_tournament_id
  returning t.timezone into v_timezone;

  insert into public.tournament_game_settings (tournament_id, team_size, map, pick_type, spectator_type, custom_win_condition)
  select p_tournament_id, g.team_size, g.map, g.pick_type, g.spectator_type, g.custom_win_condition
  from jsonb_populate_record(null::public.tournament_game_settings, p_config -> 'game') g
  on conflict (tournament_id) do update set
    team_size = excluded.team_size, map = excluded.map, pick_type = excluded.pick_type,
    spectator_type = excluded.spectator_type, custom_win_condition = excluded.custom_win_condition;

  insert into public.tournament_roster_rules (
    tournament_id, starters, max_substitutes, coach_allowed, max_roster_changes,
    min_games_for_playoffs, leave_cooldown_days)
  select p_tournament_id, r.starters, r.max_substitutes, r.coach_allowed, r.max_roster_changes,
         r.min_games_for_playoffs, r.leave_cooldown_days
  from jsonb_populate_record(null::public.tournament_roster_rules, p_config -> 'roster') r
  on conflict (tournament_id) do update set
    starters = excluded.starters, max_substitutes = excluded.max_substitutes,
    coach_allowed = excluded.coach_allowed, max_roster_changes = excluded.max_roster_changes,
    min_games_for_playoffs = excluded.min_games_for_playoffs, leave_cooldown_days = excluded.leave_cooldown_days;

  delete from public.eligibility_rules where tournament_id = p_tournament_id;
  insert into public.eligibility_rules (tournament_id, rule_type, params, applies_to, position)
  select p_tournament_id, r.rule_type, coalesce(r.params, '{}'), coalesce(r.applies_to, 'player'), (x.n - 1)::smallint
  from jsonb_array_elements(coalesce(p_config -> 'eligibility', '[]')) with ordinality as x(value, n)
  cross join lateral jsonb_populate_record(null::public.eligibility_rules, x.value) r;

  delete from public.schedule_windows where tournament_id = p_tournament_id and phase_id is null;
  insert into public.schedule_windows (tournament_id, weekday, start_time, end_time, timezone, slot_minutes, parallel_matches, priority)
  select p_tournament_id, w.weekday, w.start_time, w.end_time, v_timezone,
         coalesce(w.slot_minutes, 60), coalesce(w.parallel_matches, 1), coalesce(w.priority, 0)
  from jsonb_populate_recordset(null::public.schedule_windows, coalesce(p_config -> 'windows', '[]')) w;

  delete from public.schedule_blackouts where tournament_id = p_tournament_id;
  insert into public.schedule_blackouts (tournament_id, starts_at, ends_at, reason)
  select p_tournament_id, b.starts_at, b.ends_at, b.reason
  from jsonb_populate_recordset(null::public.schedule_blackouts, coalesce(p_config -> 'blackouts', '[]')) b;

  delete from public.tournament_prizes where tournament_id = p_tournament_id;
  insert into public.tournament_prizes (
    tournament_id, placement_from, placement_to, award_type, label, prize_type, description,
    amount, currency, quantity, distribution, position)
  select p_tournament_id, p.placement_from, p.placement_to, coalesce(p.award_type, 'placement'), p.label,
         p.prize_type, p.description, p.amount, p.currency, coalesce(p.quantity, 1),
         coalesce(p.distribution, 'team'), (x.n - 1)::smallint
  from jsonb_array_elements(coalesce(p_config -> 'prizes', '[]')) with ordinality as x(value, n)
  cross join lateral jsonb_populate_record(null::public.tournament_prizes, x.value) p;

  delete from public.circuit_tournaments where tournament_id = p_tournament_id;
  if nullif(p_config ->> 'circuit_id', '') is not null then
    insert into public.circuit_tournaments (circuit_id, tournament_id)
    values ((p_config ->> 'circuit_id')::uuid, p_tournament_id);
  end if;
end;
$$;

-- Replaces the (empty) phase structure: [{ name, position, format, series_format,
-- final_series_format, draft_mode, points_config, tiebreakers, advancement,
-- format_config, groups: ['A', 'B'] }]. Refused once fixtures exist (module 05).
create function private.replace_phases(p_tournament_id uuid, p_phases jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_phase jsonb;
  v_phase_id uuid;
begin
  if exists (
    select 1 from public.phase_entrants pe join public.phases p on p.id = pe.phase_id
    where p.tournament_id = p_tournament_id
  ) then
    raise exception 'phases_in_use' using errcode = 'P0001';
  end if;

  update public.tournament_roster_rules set roster_lock_at_phase_id = null where tournament_id = p_tournament_id;
  delete from public.phases where tournament_id = p_tournament_id;

  for v_phase in select value from jsonb_array_elements(coalesce(p_phases, '[]')) loop
    insert into public.phases (
      tournament_id, name, position, format, series_format, final_series_format, draft_mode,
      points_config, tiebreakers, advancement, format_config)
    values (
      p_tournament_id, v_phase ->> 'name', (v_phase ->> 'position')::smallint,
      (v_phase ->> 'format')::public.phase_format, (v_phase ->> 'series_format')::public.series_format,
      (v_phase ->> 'final_series_format')::public.series_format,
      coalesce(v_phase ->> 'draft_mode', 'standard')::public.draft_mode,
      coalesce(v_phase -> 'points_config', '{}'), coalesce(v_phase -> 'tiebreakers', '[]'),
      coalesce(v_phase -> 'advancement', '{}'), coalesce(v_phase -> 'format_config', '{}'))
    returning id into v_phase_id;

    insert into public.groups (phase_id, name, position)
    select v_phase_id, g.value #>> '{}', g.n::smallint
    from jsonb_array_elements(coalesce(v_phase -> 'groups', '[]')) with ordinality as g(value, n);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic writes used by the API. Business rules (lifecycle, edit policy,
-- eligibility, exclusivity) are checked in the API with packages/core; these
-- keep the rows, the audit log and the outbox consistent.
-- ---------------------------------------------------------------------------
create function public.svc_create_tournament(
  p_organization_id uuid, p_actor uuid, p_slug text, p_template_id uuid, p_config jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.tournaments (organization_id, slug, name, template_id, created_by, updated_by)
  values (p_organization_id, p_slug, p_config #>> '{tournament,name}', p_template_id, p_actor, p_actor)
  returning id into v_id;
  perform private.apply_tournament_config(v_id, p_actor, p_config);
  perform private.emit_event(p_organization_id, 'tournament', v_id, 'tournament.created', '{}');
  return v_id;
end;
$$;

-- p_phases: null keeps the structure; p_audit_action: null for a plain draft save.
create function public.svc_update_tournament(
  p_tournament_id uuid, p_actor uuid, p_config jsonb, p_phases jsonb,
  p_audit_action text, p_event_type text, p_changes jsonb, p_reason text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_tournament public.tournaments;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id and deleted_at is null for update;
  if not found then
    raise exception 'tournament_not_found' using errcode = 'P0001';
  end if;
  perform private.apply_tournament_config(p_tournament_id, p_actor, p_config);
  if p_phases is not null then
    perform private.replace_phases(p_tournament_id, p_phases);
  end if;
  if p_audit_action is not null then
    perform private.write_audit(v_tournament.organization_id, p_actor, p_audit_action, 'tournament',
      p_tournament_id, jsonb_build_object('status', v_tournament.status), p_changes, p_reason);
  end if;
  if p_event_type is not null then
    perform private.emit_event(v_tournament.organization_id, 'tournament', p_tournament_id, p_event_type,
      jsonb_build_object('sections', p_changes -> 'sections'));
  end if;
end;
$$;

-- Saves the draft version of the tournament rulebook (creating the rulebook).
create function public.svc_save_rulebook_draft(
  p_tournament_id uuid, p_actor uuid, p_title text, p_content text, p_change_summary text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_tournament public.tournaments;
  v_rulebook_id uuid;
  v_version_id uuid;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id and deleted_at is null;
  if not found then
    raise exception 'tournament_not_found' using errcode = 'P0001';
  end if;

  insert into public.rulebooks (organization_id, tournament_id, title)
  values (v_tournament.organization_id, p_tournament_id, p_title)
  on conflict (tournament_id) where tournament_id is not null do update set title = excluded.title
  returning id into v_rulebook_id;

  update public.rulebook_versions set content = p_content, change_summary = p_change_summary
  where rulebook_id = v_rulebook_id and published_at is null
  returning id into v_version_id;

  if v_version_id is null then
    insert into public.rulebook_versions (rulebook_id, version, content, change_summary, created_by)
    select v_rulebook_id, coalesce(max(version), 0) + 1, p_content, p_change_summary, p_actor
    from public.rulebook_versions where rulebook_id = v_rulebook_id
    returning id into v_version_id;
  end if;
  return v_version_id;
end;
$$;

-- Freezes the draft version and makes it the one registrations accept.
create function private.publish_rulebook_draft(p_tournament_id uuid, p_actor uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_version_id uuid;
begin
  update public.rulebook_versions v set published_at = now(), published_by = p_actor
  from public.rulebooks r
  where r.id = v.rulebook_id and r.tournament_id = p_tournament_id and v.published_at is null
  returning v.id into v_version_id;
  if v_version_id is not null then
    update public.tournaments set current_rulebook_version_id = v_version_id where id = p_tournament_id;
  end if;
  return v_version_id;
end;
$$;

create function public.svc_publish_rulebook_version(p_tournament_id uuid, p_actor uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_tournament public.tournaments;
  v_version_id uuid;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id and deleted_at is null for update;
  if not found then
    raise exception 'tournament_not_found' using errcode = 'P0001';
  end if;
  v_version_id := private.publish_rulebook_draft(p_tournament_id, p_actor);
  if v_version_id is null then
    raise exception 'no_rulebook_draft' using errcode = 'P0001';
  end if;
  perform private.write_audit(v_tournament.organization_id, p_actor, 'rulebook.version.published', 'tournament',
    p_tournament_id, jsonb_build_object('rulebook_version_id', v_tournament.current_rulebook_version_id),
    jsonb_build_object('rulebook_version_id', v_version_id), null);
  perform private.emit_event(v_tournament.organization_id, 'tournament', p_tournament_id,
    'rulebook.version_published', jsonb_build_object('rulebook_version_id', v_version_id));
  return v_version_id;
end;
$$;

-- Publishes a draft: freezes the rulebook draft and creates the empty phases.
create function public.svc_publish_tournament(p_tournament_id uuid, p_actor uuid, p_phases jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_tournament public.tournaments;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id and deleted_at is null for update;
  if not found or v_tournament.status <> 'draft' then
    raise exception 'tournament_not_draft' using errcode = 'P0001';
  end if;
  perform private.publish_rulebook_draft(p_tournament_id, p_actor);
  perform private.replace_phases(p_tournament_id, p_phases);
  update public.tournaments
  set status = 'published', published_at = now(), published_by = p_actor, updated_by = p_actor
  where id = p_tournament_id;

  perform private.write_audit(v_tournament.organization_id, p_actor, 'tournament.published', 'tournament',
    p_tournament_id, jsonb_build_object('status', 'draft'), jsonb_build_object('status', 'published'), null);
  perform private.emit_event(v_tournament.organization_id, 'tournament', p_tournament_id, 'tournament.published',
    jsonb_build_object('phases', jsonb_array_length(coalesce(p_phases, '[]'))));
end;
$$;

-- Status change decided by the API (core lifecycle). Fails if someone changed it meanwhile.
create function public.svc_transition_tournament(
  p_tournament_id uuid, p_actor uuid, p_from public.tournament_status, p_to public.tournament_status,
  p_audit_action text, p_event_type text, p_reason text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  update public.tournaments set status = p_to, updated_by = p_actor
  where id = p_tournament_id and status = p_from and deleted_at is null
  returning organization_id into v_organization_id;
  if not found then
    raise exception 'tournament_status_changed' using errcode = 'P0001';
  end if;
  -- A canceled tournament releases every roster (and its exclusivity scope).
  if p_to = 'canceled' then
    update public.entrant_roster_members r set removed_at = now()
    from public.entrants e
    where e.id = r.entrant_id and e.tournament_id = p_tournament_id and r.removed_at is null;
  end if;
  if p_audit_action is not null then
    perform private.write_audit(v_organization_id, p_actor, p_audit_action, 'tournament', p_tournament_id,
      jsonb_build_object('status', p_from), jsonb_build_object('status', p_to), p_reason);
  end if;
  perform private.emit_event(v_organization_id, 'tournament', p_tournament_id, p_event_type,
    jsonb_build_object('from', p_from, 'to', p_to));
end;
$$;

-- Registers an entrant with its roster. Capacity is checked under the
-- tournament row lock: beyond it the entrant is waitlisted (or refused).
-- p_entrant: { team_id, user_id, display_name, display_tag, logo_path,
--   rulebook_version_id, check_eligibility_result }
-- p_roster: [{ user_id, riot_account_id, roster_role, game_role, exclusivity_key }]
create function public.svc_register_entrant(
  p_tournament_id uuid, p_actor uuid, p_entrant jsonb, p_roster jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_tournament public.tournaments;
  v_taken integer;
  v_status public.entrant_status := 'pending';
  v_position integer;
  v_entrant_id uuid;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id and deleted_at is null for update;
  if not found or v_tournament.status <> 'registration_open' then
    raise exception 'registration_closed' using errcode = 'P0001';
  end if;

  select count(*) into v_taken from public.entrants
  where tournament_id = p_tournament_id and status in ('pending', 'approved');
  if v_tournament.capacity is not null and v_taken >= v_tournament.capacity then
    if not v_tournament.waitlist_enabled then
      raise exception 'tournament_full' using errcode = 'P0001';
    end if;
    v_status := 'waitlisted';
    select coalesce(max(waitlist_position), 0) + 1 into v_position
    from public.entrants where tournament_id = p_tournament_id and status = 'waitlisted';
  end if;

  insert into public.entrants (
    tournament_id, team_id, user_id, display_name, display_tag, logo_path, status, waitlist_position,
    rulebook_version_id, registered_by, check_eligibility_result)
  values (
    p_tournament_id, (p_entrant ->> 'team_id')::uuid, (p_entrant ->> 'user_id')::uuid,
    p_entrant ->> 'display_name', p_entrant ->> 'display_tag', p_entrant ->> 'logo_path', v_status, v_position,
    (p_entrant ->> 'rulebook_version_id')::uuid, p_actor, p_entrant -> 'check_eligibility_result')
  returning id into v_entrant_id;

  insert into public.entrant_roster_members (entrant_id, user_id, riot_account_id, roster_role, game_role, exclusivity_key)
  select v_entrant_id, r.user_id, r.riot_account_id, r.roster_role, r.game_role, r.exclusivity_key
  from jsonb_populate_recordset(null::public.entrant_roster_members, coalesce(p_roster, '[]')) r;

  perform private.emit_event(v_tournament.organization_id, 'entrant', v_entrant_id,
    case v_status when 'waitlisted' then 'registration.waitlisted' else 'registration.submitted' end,
    jsonb_build_object('tournament_id', p_tournament_id, 'team_id', p_entrant ->> 'team_id', 'status', v_status));
  return v_entrant_id;
end;
$$;

-- Decision on a registration, decided by the API (core entrant lifecycle):
-- approve, reject, withdraw, promote, disqualify. Leaving the tournament
-- releases the roster (and its exclusivity) and promotes the first waitlisted.
create function public.svc_decide_entrant(
  p_entrant_id uuid, p_actor uuid, p_from public.entrant_status, p_to public.entrant_status,
  p_audit_action text, p_event_type text, p_reason text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_entrant public.entrants;
  v_tournament public.tournaments;
  v_approved integer;
  v_position integer;
  v_next uuid;
begin
  select * into v_entrant from public.entrants where id = p_entrant_id;
  if not found then
    raise exception 'registration_not_found' using errcode = 'P0001';
  end if;
  select * into v_tournament from public.tournaments where id = v_entrant.tournament_id for update;
  select * into v_entrant from public.entrants where id = p_entrant_id for update;
  if v_entrant.status <> p_from then
    raise exception 'registration_status_changed' using errcode = 'P0001';
  end if;

  if p_to = 'approved' and v_tournament.capacity is not null then
    select count(*) into v_approved from public.entrants
    where tournament_id = v_entrant.tournament_id and status = 'approved';
    if v_approved >= v_tournament.capacity then
      raise exception 'tournament_full' using errcode = 'P0001';
    end if;
  end if;

  if p_to = 'waitlisted' then
    select coalesce(max(waitlist_position), 0) + 1 into v_position
    from public.entrants where tournament_id = v_entrant.tournament_id and status = 'waitlisted';
  end if;

  update public.entrants set
    status = p_to,
    waitlist_position = v_position,
    approved_by = case when p_to = 'approved' then p_actor else approved_by end,
    approved_at = case when p_to = 'approved' then now() else approved_at end,
    rejection_reason = case when p_to in ('rejected', 'disqualified') then p_reason else rejection_reason end
  where id = p_entrant_id;

  if p_to in ('rejected', 'withdrawn', 'disqualified') then
    update public.entrant_roster_members set removed_at = now()
    where entrant_id = p_entrant_id and removed_at is null;
  end if;

  if p_audit_action is not null then
    perform private.write_audit(v_tournament.organization_id, p_actor, p_audit_action, 'entrant', p_entrant_id,
      jsonb_build_object('status', p_from), jsonb_build_object('status', p_to), p_reason);
  end if;
  perform private.emit_event(v_tournament.organization_id, 'entrant', p_entrant_id, p_event_type,
    jsonb_build_object('tournament_id', v_entrant.tournament_id, 'team_id', v_entrant.team_id,
      'from', p_from, 'to', p_to));

  -- A slot was freed: the first in the waitlist moves to pending review.
  if p_from in ('pending', 'approved') and p_to in ('rejected', 'withdrawn', 'disqualified')
     and v_tournament.status in ('published', 'registration_open', 'registration_closed') then
    select id into v_next from public.entrants
    where tournament_id = v_entrant.tournament_id and status = 'waitlisted'
    order by waitlist_position limit 1;
    if v_next is not null then
      update public.entrants set status = 'pending', waitlist_position = null where id = v_next;
      perform private.emit_event(v_tournament.organization_id, 'entrant', v_next, 'registration.promoted',
        jsonb_build_object('tournament_id', v_entrant.tournament_id));
    end if;
  end if;
end;
$$;

-- p_seeds: [{ entrant_id, seed }] for every approved entrant.
create function public.svc_set_seeds(p_tournament_id uuid, p_actor uuid, p_method text, p_seeds jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_tournament public.tournaments;
  v_updated integer;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  update public.entrants set seed = null where tournament_id = p_tournament_id;
  update public.entrants e set seed = (s ->> 'seed')::smallint
  from jsonb_array_elements(p_seeds) s
  where e.id = (s ->> 'entrant_id')::uuid and e.tournament_id = p_tournament_id and e.status = 'approved';
  get diagnostics v_updated = row_count;
  if v_updated <> jsonb_array_length(p_seeds) then
    raise exception 'seeding_changed' using errcode = 'P0001';
  end if;
  perform private.write_audit(v_tournament.organization_id, p_actor, 'tournament.seeded', 'tournament',
    p_tournament_id, null, jsonb_build_object('method', p_method, 'seeds', p_seeds), null);
  perform private.emit_event(v_tournament.organization_id, 'tournament', p_tournament_id, 'tournament.seeded',
    jsonb_build_object('method', p_method));
end;
$$;

revoke execute on function
  public.svc_create_tournament(uuid, uuid, text, uuid, jsonb),
  public.svc_update_tournament(uuid, uuid, jsonb, jsonb, text, text, jsonb, text),
  public.svc_save_rulebook_draft(uuid, uuid, text, text, text),
  public.svc_publish_rulebook_version(uuid, uuid),
  public.svc_publish_tournament(uuid, uuid, jsonb),
  public.svc_transition_tournament(uuid, uuid, public.tournament_status, public.tournament_status, text, text, text),
  public.svc_register_entrant(uuid, uuid, jsonb, jsonb),
  public.svc_decide_entrant(uuid, uuid, public.entrant_status, public.entrant_status, text, text, text),
  public.svc_set_seeds(uuid, uuid, text, jsonb)
from public, anon, authenticated;

grant execute on function
  public.svc_create_tournament(uuid, uuid, text, uuid, jsonb),
  public.svc_update_tournament(uuid, uuid, jsonb, jsonb, text, text, jsonb, text),
  public.svc_save_rulebook_draft(uuid, uuid, text, text, text),
  public.svc_publish_rulebook_version(uuid, uuid),
  public.svc_publish_tournament(uuid, uuid, jsonb),
  public.svc_transition_tournament(uuid, uuid, public.tournament_status, public.tournament_status, text, text, text),
  public.svc_register_entrant(uuid, uuid, jsonb, jsonb),
  public.svc_decide_entrant(uuid, uuid, public.entrant_status, public.entrant_status, text, text, text),
  public.svc_set_seeds(uuid, uuid, text, jsonb)
to service_role;

-- Keep `private` closed (explicit grants such as is_tournament_staff stay);
-- the service functions run as service_role and call these helpers.
revoke execute on all functions in schema private from public, anon;
grant execute on function
  private.write_audit(uuid, uuid, text, text, uuid, jsonb, jsonb, text),
  private.emit_event(uuid, text, uuid, text, jsonb),
  private.apply_tournament_config(uuid, uuid, jsonb),
  private.replace_phases(uuid, jsonb),
  private.publish_rulebook_draft(uuid, uuid)
to service_role;
