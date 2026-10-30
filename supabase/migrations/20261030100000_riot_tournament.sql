-- Module 08: Riot Tournament API (docs/03 §6.4 §12, docs/06, docs/specs/m08).
-- The provider/tournament registered in Riot, the per-game tournament codes with
-- the frozen roster's PUUIDs, the inbound webhook log (idempotent), and the
-- integrity alerts a post-game roster check raises. The games, participants and
-- draft tables already exist (m05); this reuses them. All writes by the API.

create type public.riot_setup_status as enum ('active', 'disabled');
create type public.tournament_code_status as enum ('active', 'used', 'revoked');
create type public.inbound_webhook_status as enum ('received', 'processed', 'failed', 'skipped');
create type public.integrity_alert_type as enum (
  'roster_mismatch', 'smurf_suspected', 'rank_violation', 'riot_id_changed', 'duplicate_identity', 'other'
);
create type public.integrity_alert_status as enum ('open', 'dismissed', 'actioned');
create type public.subject_type as enum ('user', 'team', 'entrant', 'game');

-- ---------------------------------------------------------------------------
-- Riot provider and tournament (registered once per org/tournament)
-- ---------------------------------------------------------------------------
create table public.riot_providers (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid not null references public.organizations (id),
  region public.game_region not null,
  riot_provider_id bigint not null,
  callback_url text not null check (char_length(callback_url) <= 400),
  status public.riot_setup_status not null default 'active',
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  unique (organization_id, region)
);

create table public.riot_tournaments (
  id uuid primary key default private.uuid_v7(),
  tournament_id uuid not null references public.tournaments (id),
  riot_provider_id uuid not null references public.riot_providers (id),
  riot_tournament_id bigint not null,
  name text not null check (char_length(name) <= 120),
  status public.riot_setup_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (tournament_id)
);

-- One code per game (docs/13 §7 cap 2): the frozen roster's PUUIDs, single use.
create table public.riot_tournament_codes (
  id uuid primary key default private.uuid_v7(),
  game_id uuid not null references public.games (id) on delete cascade,
  riot_tournament_id bigint not null,
  code text not null unique check (char_length(code) between 3 and 120),
  allowed_puuids text[] not null default '{}',
  team_size smallint not null check (team_size between 1 and 5),
  map text not null,
  pick_type text not null,
  spectator_type text not null,
  metadata text not null,
  status public.tournament_code_status not null default 'active',
  generated_at timestamptz not null default now(),
  used_at timestamptz
);
create index riot_tournament_codes_game_idx on public.riot_tournament_codes (game_id);
-- At most one active code per game.
create unique index riot_tournament_codes_active_key on public.riot_tournament_codes (game_id)
  where status = 'active';

-- Everything that arrives from outside (Riot callbacks first). Idempotent.
create table public.inbound_webhooks (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid references public.organizations (id),
  source text not null check (char_length(source) <= 40),
  event_type text not null check (char_length(event_type) <= 80),
  payload jsonb not null default '{}',
  signature_valid boolean not null default false,
  idempotency_key text not null,
  status public.inbound_webhook_status not null default 'received',
  error text check (char_length(error) <= 500),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (source, idempotency_key)
);
create index inbound_webhooks_unprocessed_idx on public.inbound_webhooks (received_at)
  where processed_at is null;

-- Integrity alerts (docs/03 §7): a human reviews; never an automatic sanction.
create table public.integrity_alerts (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid not null references public.organizations (id),
  type public.integrity_alert_type not null,
  severity smallint not null default 2 check (severity between 1 and 3),
  subject_type public.subject_type not null,
  subject_id uuid not null,
  evidence jsonb not null default '{}',
  risk_score numeric(5, 2),
  status public.integrity_alert_status not null default 'open',
  reviewed_by uuid references public.users (id),
  reviewed_at timestamptz,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);
create index integrity_alerts_open_idx on public.integrity_alerts (organization_id, created_at)
  where status = 'open';

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.riot_providers enable row level security;
alter table public.riot_tournaments enable row level security;
alter table public.riot_tournament_codes enable row level security;
alter table public.inbound_webhooks enable row level security;
alter table public.integrity_alerts enable row level security;

-- Staff-only reads; no client writes. Codes reach the captain through the API.
create policy "riot_providers: super admin" on public.riot_providers
  for select to authenticated using ((select private.is_super_admin()));
create policy "riot_tournaments: super admin" on public.riot_tournaments
  for select to authenticated using ((select private.is_super_admin()));
create policy "integrity_alerts: super admin" on public.integrity_alerts
  for select to authenticated using ((select private.is_super_admin()));
-- riot_tournament_codes and inbound_webhooks: no policy, API only.

grant select on public.riot_providers, public.riot_tournaments, public.integrity_alerts
  to authenticated;
grant select, insert, update, delete on
  public.riot_providers, public.riot_tournaments, public.riot_tournament_codes,
  public.inbound_webhooks, public.integrity_alerts
  to service_role;

-- ---------------------------------------------------------------------------
-- Service functions (secret key only)
-- ---------------------------------------------------------------------------

-- Persist the provider/tournament registered in Riot (ids come from the adapter).
create function public.svc_save_riot_provider(
  p_organization_id uuid, p_actor uuid, p_region public.game_region, p_provider_id bigint, p_callback_url text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.riot_providers (organization_id, region, riot_provider_id, callback_url, created_by)
  values (p_organization_id, p_region, p_provider_id, p_callback_url, p_actor)
  on conflict (organization_id, region) do update set
    riot_provider_id = excluded.riot_provider_id, callback_url = excluded.callback_url, status = 'active'
  returning id into v_id;
  return v_id;
end;
$$;

create function public.svc_save_riot_tournament(
  p_tournament_id uuid, p_provider uuid, p_riot_tournament_id bigint, p_name text
)
returns void
language sql
set search_path = ''
as $$
  insert into public.riot_tournaments (tournament_id, riot_provider_id, riot_tournament_id, name)
  values (p_tournament_id, p_provider, p_riot_tournament_id, p_name)
  on conflict (tournament_id) do update set
    riot_provider_id = excluded.riot_provider_id, riot_tournament_id = excluded.riot_tournament_id,
    name = excluded.name, status = 'active';
$$;

-- Ensures a game row exists for (match, game_number) in 'live' state and returns
-- its id, so a tournament code can reference it before the game is played.
create function public.svc_open_riot_game(
  p_match_id uuid, p_game_number smallint, p_blue uuid, p_red uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.games where match_id = p_match_id and game_number = p_game_number;
  if v_id is null then
    insert into public.games (match_id, game_number, status, blue_entrant_id, red_entrant_id)
    values (p_match_id, p_game_number, 'live', p_blue, p_red)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Stores a freshly generated code, revoking any previous active code of the game.
create function public.svc_save_tournament_code(
  p_game_id uuid, p_riot_tournament_id bigint, p_code text, p_allowed_puuids text[],
  p_team_size smallint, p_map text, p_pick_type text, p_spectator_type text, p_metadata text
)
returns void
language sql
set search_path = ''
as $$
  update public.riot_tournament_codes set status = 'revoked'
  where game_id = p_game_id and status = 'active';
  insert into public.riot_tournament_codes (
    game_id, riot_tournament_id, code, allowed_puuids, team_size, map, pick_type, spectator_type, metadata)
  values (p_game_id, p_riot_tournament_id, p_code, coalesce(p_allowed_puuids, '{}'), p_team_size,
    p_map, p_pick_type, p_spectator_type, p_metadata);
$$;

-- Logs an inbound webhook; returns true only the first time (idempotency).
create function public.svc_log_inbound_webhook(
  p_organization_id uuid, p_source text, p_event_type text, p_idempotency_key text,
  p_payload jsonb, p_signature_valid boolean
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  insert into public.inbound_webhooks (organization_id, source, event_type, idempotency_key, payload, signature_valid)
  values (p_organization_id, p_source, p_event_type, p_idempotency_key, coalesce(p_payload, '{}'), p_signature_valid);
  return true;
exception when unique_violation then
  return false;
end;
$$;

create function public.svc_mark_webhook(p_source text, p_idempotency_key text, p_status public.inbound_webhook_status, p_error text)
returns void
language sql
set search_path = ''
as $$
  update public.inbound_webhooks
  set status = p_status, error = left(p_error, 500), processed_at = now()
  where source = p_source and idempotency_key = p_idempotency_key;
$$;

-- Records a Riot game result: the game's winner and payload, its participants and
-- draft, and marks the code used. The games trigger (m09) enqueues the stats job.
create function public.svc_record_riot_game(
  p_game_id uuid, p_winner uuid, p_payload jsonb, p_duration integer, p_patch text,
  p_riot_match_id text, p_participants jsonb, p_draft jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.games set
    status = 'completed', winner_entrant_id = p_winner, ended_at = now(),
    duration_seconds = p_duration, patch = p_patch, riot_match_id = p_riot_match_id,
    raw_match_payload = p_payload, result_source = 'riot_callback', updated_at = now()
  where id = p_game_id;

  delete from public.game_participants where game_id = p_game_id;
  insert into public.game_participants (game_id, entrant_id, user_id, riot_account_id, puuid, side, game_role, champion_id, is_expected)
  select p_game_id, r.entrant_id, r.user_id, r.riot_account_id, r.puuid, r.side, r.game_role, r.champion_id,
    coalesce(r.is_expected, true)
  from jsonb_populate_recordset(null::public.game_participants, coalesce(p_participants, '[]')) r;

  delete from public.draft_actions where game_id = p_game_id;
  insert into public.draft_actions (game_id, entrant_id, action, champion_id, sequence, side)
  select p_game_id, r.entrant_id, r.action, r.champion_id, r.sequence, r.side
  from jsonb_populate_recordset(null::public.draft_actions, coalesce(p_draft, '[]')) r;

  update public.riot_tournament_codes set status = 'used', used_at = now()
  where game_id = p_game_id and status = 'active';
end;
$$;

-- Raises an integrity alert for staff review (never an automatic sanction).
create function public.svc_raise_integrity_alert(
  p_organization_id uuid, p_type public.integrity_alert_type, p_severity smallint,
  p_subject_type public.subject_type, p_subject_id uuid, p_evidence jsonb
)
returns uuid
language sql
set search_path = ''
as $$
  insert into public.integrity_alerts (organization_id, type, severity, subject_type, subject_id, evidence)
  values (p_organization_id, p_type, coalesce(p_severity, 2), p_subject_type, p_subject_id, coalesce(p_evidence, '{}'))
  returning id;
$$;

revoke execute on function
  public.svc_save_riot_provider(uuid, uuid, public.game_region, bigint, text),
  public.svc_save_riot_tournament(uuid, uuid, bigint, text),
  public.svc_open_riot_game(uuid, smallint, uuid, uuid),
  public.svc_save_tournament_code(uuid, bigint, text, text[], smallint, text, text, text, text),
  public.svc_log_inbound_webhook(uuid, text, text, text, jsonb, boolean),
  public.svc_mark_webhook(text, text, public.inbound_webhook_status, text),
  public.svc_record_riot_game(uuid, uuid, jsonb, integer, text, text, jsonb, jsonb),
  public.svc_raise_integrity_alert(uuid, public.integrity_alert_type, smallint, public.subject_type, uuid, jsonb)
from public, anon, authenticated;
grant execute on function
  public.svc_save_riot_provider(uuid, uuid, public.game_region, bigint, text),
  public.svc_save_riot_tournament(uuid, uuid, bigint, text),
  public.svc_open_riot_game(uuid, smallint, uuid, uuid),
  public.svc_save_tournament_code(uuid, bigint, text, text[], smallint, text, text, text, text),
  public.svc_log_inbound_webhook(uuid, text, text, text, jsonb, boolean),
  public.svc_mark_webhook(text, text, public.inbound_webhook_status, text),
  public.svc_record_riot_game(uuid, uuid, jsonb, integer, text, text, jsonb, jsonb),
  public.svc_raise_integrity_alert(uuid, public.integrity_alert_type, smallint, public.subject_type, uuid, jsonb)
to service_role;
