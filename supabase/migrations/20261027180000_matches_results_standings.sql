-- Module 05: matches (series), check-in, games, dual report, disputes,
-- rescheduling and standings (docs/03 §6.3–6.4, docs/13 §8–9).
--
-- packages/core decides (fixtures, bracket advance, standings, lifecycles);
-- the API computes the changes and svc_commit_competition applies them in one
-- transaction, with the optimistic lock on matches, audit and outbox events.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.match_status as enum (
  'pending', 'scheduled', 'checkin', 'ready', 'live', 'awaiting_result',
  'disputed', 'completed', 'forfeit', 'canceled');
create type public.bracket_side as enum ('upper', 'lower', 'final');
create type public.match_slot as enum ('a', 'b');
create type public.result_source as enum ('riot_callback', 'dual_report', 'referee', 'admin_override', 'checkin_forfeit', 'bye');
create type public.match_official_role as enum ('referee', 'observer', 'caster', 'producer');
create type public.checkin_method as enum ('web', 'discord');
create type public.reschedule_status as enum ('pending', 'accepted', 'rejected', 'approved_by_admin', 'expired', 'canceled');
create type public.game_status as enum ('pending', 'lobby', 'live', 'completed', 'remade', 'forfeit');
create type public.game_side as enum ('blue', 'red');
create type public.draft_action_type as enum ('pick', 'ban');
create type public.dispute_category as enum ('result', 'conduct', 'technical', 'eligibility', 'other');
create type public.dispute_status as enum ('open', 'under_review', 'resolved', 'rejected');
create type public.standing_status as enum ('qualified', 'eliminated', 'in_contention');

-- ---------------------------------------------------------------------------
-- Matches (docs/03 §6.3)
-- ---------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid not null references public.organizations (id),
  tournament_id uuid not null references public.tournaments (id),
  phase_id uuid not null references public.phases (id),
  group_id uuid references public.groups (id),
  -- Id of the match in packages/core (`r1-m2`, `u-r2-m1`, `gf-1`…), unique per phase.
  bracket_key text not null check (bracket_key ~ '^[a-z0-9-]{1,40}$'),
  round smallint not null check (round >= 1),
  position smallint not null check (position >= 1),
  bracket_side public.bracket_side,
  entrant_a_id uuid references public.entrants (id),
  entrant_b_id uuid references public.entrants (id),
  source_a jsonb,
  source_b jsonb,
  next_match_winner_id uuid references public.matches (id),
  next_match_winner_slot public.match_slot,
  next_match_loser_id uuid references public.matches (id),
  next_match_loser_slot public.match_slot,
  series_format public.series_format not null,
  draft_mode public.draft_mode not null default 'standard',
  is_tiebreaker boolean not null default false,
  scheduled_at timestamptz,
  original_scheduled_at timestamptz,
  checkin_opens_at timestamptz,
  checkin_closes_at timestamptz,
  status public.match_status not null default 'pending',
  score_a smallint not null default 0 check (score_a >= 0),
  score_b smallint not null default 0 check (score_b >= 0),
  winner_entrant_id uuid references public.entrants (id),
  result_source public.result_source,
  finalized_at timestamptz,
  dispute_deadline timestamptz,
  is_broadcast boolean not null default false,
  stream_session_id uuid,
  -- Optimistic lock: every change checks and bumps it.
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phase_id, bracket_key),
  -- docs/03 §15: the winner is one of the participants.
  check (winner_entrant_id is null or winner_entrant_id = entrant_a_id or winner_entrant_id = entrant_b_id),
  check (entrant_a_id is null or entrant_b_id is null or entrant_a_id <> entrant_b_id)
);
create index matches_calendar_idx on public.matches (tournament_id, status, scheduled_at);
create index matches_entrant_a_idx on public.matches (entrant_a_id);
create index matches_entrant_b_idx on public.matches (entrant_b_id);
create index matches_phase_idx on public.matches (phase_id, round, position);
create index matches_checkin_due_idx on public.matches (checkin_closes_at) where status in ('scheduled', 'checkin');

create table public.match_officials (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.users (id),
  role public.match_official_role not null,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id, role)
);

create table public.match_checkins (
  id uuid primary key default private.uuid_v7(),
  match_id uuid not null references public.matches (id) on delete cascade,
  entrant_id uuid not null references public.entrants (id),
  user_id uuid references public.users (id),
  checked_in_at timestamptz not null default now(),
  method public.checkin_method not null default 'web',
  unique (match_id, entrant_id)
);

create table public.reschedule_requests (
  id uuid primary key default private.uuid_v7(),
  match_id uuid not null references public.matches (id) on delete cascade,
  requested_by_entrant_id uuid not null references public.entrants (id),
  requested_by_user_id uuid not null references public.users (id),
  proposed_at timestamptz[] not null check (cardinality(proposed_at) between 1 and 3),
  chosen_at timestamptz,
  reason text check (char_length(reason) <= 500),
  status public.reschedule_status not null default 'pending',
  responded_by uuid references public.users (id),
  decided_by uuid references public.users (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One open request per match.
create unique index reschedule_requests_open_key on public.reschedule_requests (match_id)
  where status in ('pending', 'accepted');

-- ---------------------------------------------------------------------------
-- Games, draft and results (docs/03 §6.4)
-- ---------------------------------------------------------------------------
create table public.games (
  id uuid primary key default private.uuid_v7(),
  match_id uuid not null references public.matches (id) on delete cascade,
  game_number smallint not null check (game_number >= 1),
  status public.game_status not null default 'pending',
  blue_entrant_id uuid not null references public.entrants (id),
  red_entrant_id uuid not null references public.entrants (id),
  winner_entrant_id uuid references public.entrants (id),
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds >= 0),
  riot_match_id text,
  riot_game_id text,
  patch text,
  raw_match_payload jsonb,
  raw_timeline_payload jsonb,
  result_source public.result_source,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, game_number),
  check (blue_entrant_id <> red_entrant_id),
  check (winner_entrant_id is null or winner_entrant_id = blue_entrant_id or winner_entrant_id = red_entrant_id)
);

create table public.game_participants (
  id uuid primary key default private.uuid_v7(),
  game_id uuid not null references public.games (id) on delete cascade,
  entrant_id uuid not null references public.entrants (id),
  user_id uuid references public.users (id),
  riot_account_id uuid references public.riot_accounts (id),
  puuid text not null,
  side public.game_side not null,
  game_role public.player_role,
  champion_id integer,
  is_expected boolean not null default true,
  created_at timestamptz not null default now()
);
create index game_participants_game_idx on public.game_participants (game_id);

create table public.draft_actions (
  id uuid primary key default private.uuid_v7(),
  game_id uuid not null references public.games (id) on delete cascade,
  entrant_id uuid not null references public.entrants (id),
  action public.draft_action_type not null,
  champion_id integer not null,
  sequence smallint not null check (sequence >= 1),
  side public.game_side not null,
  created_at timestamptz not null default now(),
  unique (game_id, sequence)
);

-- Fearless (docs/02 §3): champions an entrant already picked in the series.
create view public.fearless_locks with (security_invoker = true) as
  select g.match_id, d.entrant_id, d.champion_id, d.game_id as locked_by_game_id
  from public.draft_actions d
  join public.games g on g.id = d.game_id
  where d.action = 'pick' and g.status = 'completed';

-- Dual report: the games each captain says were played (packages/core scores them).
create table public.result_reports (
  id uuid primary key default private.uuid_v7(),
  match_id uuid not null references public.matches (id) on delete cascade,
  game_id uuid references public.games (id),
  reported_by_entrant_id uuid not null references public.entrants (id),
  reported_by_user_id uuid not null references public.users (id),
  winner_entrant_id uuid not null references public.entrants (id),
  score_a smallint not null check (score_a >= 0),
  score_b smallint not null check (score_b >= 0),
  -- [{ number, winner: 'a' | 'b' }]
  games jsonb not null,
  -- Paths in the private `match-evidence` bucket.
  evidence_paths text[] not null default '{}' check (cardinality(evidence_paths) <= 5),
  submitted_at timestamptz not null default now()
);
create index result_reports_match_idx on public.result_reports (match_id, submitted_at);

create table public.disputes (
  id uuid primary key default private.uuid_v7(),
  match_id uuid not null references public.matches (id) on delete cascade,
  game_id uuid references public.games (id),
  opened_by_user_id uuid references public.users (id),
  opened_by_entrant_id uuid references public.entrants (id),
  category public.dispute_category not null default 'result',
  description text not null check (char_length(description) between 1 and 2000),
  status public.dispute_status not null default 'open',
  assigned_to uuid references public.users (id),
  resolution text check (char_length(resolution) <= 2000),
  resolved_by uuid references public.users (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One open dispute per match.
create unique index disputes_open_key on public.disputes (match_id) where status in ('open', 'under_review');

create table public.dispute_evidence (
  id uuid primary key default private.uuid_v7(),
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  storage_path text,
  url text check (url ~ '^https://'),
  note text check (char_length(note) <= 1000),
  added_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  check (storage_path is not null or url is not null or note is not null)
);

-- ---------------------------------------------------------------------------
-- Standings: recomputed by packages/core, never edited by hand
-- ---------------------------------------------------------------------------
create table public.standings (
  phase_id uuid not null references public.phases (id) on delete cascade,
  tournament_id uuid not null references public.tournaments (id),
  group_id uuid references public.groups (id),
  entrant_id uuid not null references public.entrants (id),
  rank smallint not null check (rank >= 1),
  points integer not null default 0,
  played smallint not null default 0,
  wins smallint not null default 0,
  losses smallint not null default 0,
  draws smallint not null default 0,
  game_wins smallint not null default 0,
  game_losses smallint not null default 0,
  game_diff smallint not null default 0,
  -- { steps: TiebreakStep[], tiedWith: [] } from packages/core.
  tiebreak_details jsonb not null default '{}',
  status public.standing_status not null default 'in_contention',
  updated_at timestamptz not null default now(),
  primary key (phase_id, entrant_id)
);
create index standings_tournament_idx on public.standings (tournament_id);

create table public.standing_overrides (
  id uuid primary key default private.uuid_v7(),
  phase_id uuid not null references public.phases (id) on delete cascade,
  entrant_id uuid not null references public.entrants (id),
  field text not null check (field ~ '^[a-z_]+$'),
  value jsonb not null,
  reason text not null check (char_length(reason) between 10 and 500),
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger matches_set_updated_at before update on public.matches
  for each row execute function private.set_updated_at();
create trigger reschedule_requests_set_updated_at before update on public.reschedule_requests
  for each row execute function private.set_updated_at();
create trigger games_set_updated_at before update on public.games
  for each row execute function private.set_updated_at();
create trigger disputes_set_updated_at before update on public.disputes
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
-- Participants of the match (either registration), its tournament staff and super admins.
create function private.is_match_party(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and (
        (m.entrant_a_id is not null and private.owns_entrant(m.entrant_a_id))
        or (m.entrant_b_id is not null and private.owns_entrant(m.entrant_b_id))
        or private.is_tournament_staff(m.tournament_id)
        or private.is_super_admin()
      )
  );
$$;

revoke execute on function private.is_match_party(uuid) from public, anon;
grant execute on function private.is_match_party(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security (reads only; writes go through the API)
-- ---------------------------------------------------------------------------
alter table public.matches enable row level security;
alter table public.match_officials enable row level security;
alter table public.match_checkins enable row level security;
alter table public.reschedule_requests enable row level security;
alter table public.games enable row level security;
alter table public.game_participants enable row level security;
alter table public.draft_actions enable row level security;
alter table public.result_reports enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_evidence enable row level security;
alter table public.standings enable row level security;
alter table public.standing_overrides enable row level security;

-- Public results: readable exactly when the tournament is (also by Realtime).
create policy "matches: with the tournament" on public.matches
  for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id));
create policy "standings: with the tournament" on public.standings
  for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id));
create policy "games: with the match" on public.games
  for select to anon, authenticated
  using (exists (select 1 from public.matches m where m.id = match_id));
create policy "game_participants: with the game" on public.game_participants
  for select to anon, authenticated
  using (exists (select 1 from public.games g where g.id = game_id));
create policy "draft_actions: with the game" on public.draft_actions
  for select to anon, authenticated
  using (exists (select 1 from public.games g where g.id = game_id));
create policy "match_officials: with the match" on public.match_officials
  for select to authenticated
  using (exists (select 1 from public.matches m where m.id = match_id));
create policy "match_checkins: with the match" on public.match_checkins
  for select to authenticated
  using (exists (select 1 from public.matches m where m.id = match_id));

-- Reports, disputes and reschedules: only the two registrations and staff.
create policy "result_reports: match parties" on public.result_reports
  for select to authenticated using ((select private.is_match_party(match_id)));
create policy "disputes: match parties" on public.disputes
  for select to authenticated using ((select private.is_match_party(match_id)));
create policy "dispute_evidence: match parties" on public.dispute_evidence
  for select to authenticated
  using (exists (
    select 1 from public.disputes d
    where d.id = dispute_id and (select private.is_match_party(d.match_id))));
create policy "reschedule_requests: match parties" on public.reschedule_requests
  for select to authenticated using ((select private.is_match_party(match_id)));
create policy "standing_overrides: super admin" on public.standing_overrides
  for select to authenticated using ((select private.is_super_admin()));

-- ---------------------------------------------------------------------------
-- Data API exposure
-- ---------------------------------------------------------------------------
grant select on public.matches, public.standings, public.games, public.game_participants,
  public.draft_actions, public.fearless_locks to anon, authenticated;
grant select on public.match_officials, public.match_checkins, public.reschedule_requests,
  public.result_reports, public.disputes, public.dispute_evidence, public.standing_overrides
  to authenticated;
grant select, insert, update, delete on
  public.matches, public.match_officials, public.match_checkins, public.reschedule_requests,
  public.games, public.game_participants, public.draft_actions, public.result_reports,
  public.disputes, public.dispute_evidence, public.standings, public.standing_overrides
  to service_role;
grant select on public.fearless_locks to service_role;

-- Live bracket and tables (docs/14 §5): Realtime streams these tables to the
-- browser, filtered by the RLS policies above.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.matches, public.standings;
  end if;
end;
$$;

-- Evidence screenshots: private, served with signed URLs by the API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('match-evidence', 'match-evidence', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Unit of work of the competition. p_change (all keys optional):
-- {
--   matches_insert: [match rows with their ids, links already resolved],
--   matches_update: [{ id, version, set: { column: value } }],   -- optimistic lock
--   games_replace: [{ match_id, games: [game rows] }],
--   phase_entrants_upsert: [{ phase_id, group_id, entrant_id, seed, status }],
--   phases_update: [{ id, status, starts_at }],
--   standings_replace: [{ phase_id, rows: [standing rows] }],
--   checkins_insert, reports_insert, disputes_insert, evidence_insert,
--   reschedules_insert: [rows],
--   disputes_update, reschedules_update: [{ id, set: { column: value } }],
--   tournament_transition: { from, to },
--   audits: [{ action, entity_type, entity_id, before, after, reason }],
--   events: [{ aggregate_type, aggregate_id, event_type, payload }]
-- }
-- Raises `match_version_conflict` when a match changed meanwhile.
-- ---------------------------------------------------------------------------
create function public.svc_commit_competition(p_tournament_id uuid, p_actor uuid, p_change jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_tournament public.tournaments;
  v_item jsonb;
  v_set jsonb;
  v_rows integer;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  if not found then
    raise exception 'tournament_not_found' using errcode = 'P0001';
  end if;

  if p_change ? 'tournament_transition' then
    update public.tournaments set status = (p_change #>> '{tournament_transition,to}')::public.tournament_status,
      updated_by = p_actor
    where id = p_tournament_id and status = (p_change #>> '{tournament_transition,from}')::public.tournament_status;
    if not found then
      raise exception 'tournament_status_changed' using errcode = 'P0001';
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_change -> 'phases_update', '[]')) loop
    update public.phases set
      status = coalesce((v_item ->> 'status')::public.phase_status, status),
      starts_at = coalesce((v_item ->> 'starts_at')::timestamptz, starts_at)
    where id = (v_item ->> 'id')::uuid and tournament_id = p_tournament_id;
  end loop;

  insert into public.phase_entrants (phase_id, group_id, entrant_id, seed, status)
  select r.phase_id, r.group_id, r.entrant_id, r.seed, coalesce(r.status, 'active')
  from jsonb_populate_recordset(null::public.phase_entrants, coalesce(p_change -> 'phase_entrants_upsert', '[]')) r
  on conflict (phase_id, entrant_id) do update set
    group_id = excluded.group_id, seed = excluded.seed, status = excluded.status;

  -- Inserted with their ids so the bracket links can point at each other.
  insert into public.matches (
    id, organization_id, tournament_id, phase_id, group_id, bracket_key, round, position, bracket_side,
    entrant_a_id, entrant_b_id, source_a, source_b, series_format, draft_mode, is_tiebreaker,
    status, score_a, score_b, winner_entrant_id, result_source, finalized_at)
  select r.id, v_tournament.organization_id, p_tournament_id, r.phase_id, r.group_id, r.bracket_key,
    r.round, r.position, r.bracket_side, r.entrant_a_id, r.entrant_b_id, r.source_a, r.source_b,
    r.series_format, coalesce(r.draft_mode, 'standard'), coalesce(r.is_tiebreaker, false),
    coalesce(r.status, 'pending'), coalesce(r.score_a, 0), coalesce(r.score_b, 0),
    r.winner_entrant_id, r.result_source, r.finalized_at
  from jsonb_populate_recordset(null::public.matches, coalesce(p_change -> 'matches_insert', '[]')) r;

  update public.matches m set
    next_match_winner_id = r.next_match_winner_id, next_match_winner_slot = r.next_match_winner_slot,
    next_match_loser_id = r.next_match_loser_id, next_match_loser_slot = r.next_match_loser_slot
  from jsonb_populate_recordset(null::public.matches, coalesce(p_change -> 'matches_insert', '[]')) r
  where m.id = r.id;

  for v_item in select value from jsonb_array_elements(coalesce(p_change -> 'matches_update', '[]')) loop
    v_set := v_item -> 'set';
    update public.matches m set
      status = case when v_set ? 'status' then (v_set ->> 'status')::public.match_status else m.status end,
      entrant_a_id = case when v_set ? 'entrant_a_id' then (v_set ->> 'entrant_a_id')::uuid else m.entrant_a_id end,
      entrant_b_id = case when v_set ? 'entrant_b_id' then (v_set ->> 'entrant_b_id')::uuid else m.entrant_b_id end,
      score_a = case when v_set ? 'score_a' then (v_set ->> 'score_a')::smallint else m.score_a end,
      score_b = case when v_set ? 'score_b' then (v_set ->> 'score_b')::smallint else m.score_b end,
      winner_entrant_id = case when v_set ? 'winner_entrant_id' then (v_set ->> 'winner_entrant_id')::uuid else m.winner_entrant_id end,
      result_source = case when v_set ? 'result_source' then (v_set ->> 'result_source')::public.result_source else m.result_source end,
      finalized_at = case when v_set ? 'finalized_at' then (v_set ->> 'finalized_at')::timestamptz else m.finalized_at end,
      dispute_deadline = case when v_set ? 'dispute_deadline' then (v_set ->> 'dispute_deadline')::timestamptz else m.dispute_deadline end,
      scheduled_at = case when v_set ? 'scheduled_at' then (v_set ->> 'scheduled_at')::timestamptz else m.scheduled_at end,
      original_scheduled_at = case when v_set ? 'original_scheduled_at' then (v_set ->> 'original_scheduled_at')::timestamptz else m.original_scheduled_at end,
      checkin_opens_at = case when v_set ? 'checkin_opens_at' then (v_set ->> 'checkin_opens_at')::timestamptz else m.checkin_opens_at end,
      checkin_closes_at = case when v_set ? 'checkin_closes_at' then (v_set ->> 'checkin_closes_at')::timestamptz else m.checkin_closes_at end,
      is_broadcast = case when v_set ? 'is_broadcast' then (v_set ->> 'is_broadcast')::boolean else m.is_broadcast end,
      version = m.version + 1
    where m.id = (v_item ->> 'id')::uuid and m.tournament_id = p_tournament_id
      and m.version = (v_item ->> 'version')::integer;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      raise exception 'match_version_conflict' using errcode = 'P0001';
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_change -> 'games_replace', '[]')) loop
    delete from public.games where match_id = (v_item ->> 'match_id')::uuid;
    insert into public.games (match_id, game_number, status, blue_entrant_id, red_entrant_id, winner_entrant_id, result_source, ended_at)
    select (v_item ->> 'match_id')::uuid, g.game_number, g.status, g.blue_entrant_id, g.red_entrant_id,
      g.winner_entrant_id, g.result_source, g.ended_at
    from jsonb_populate_recordset(null::public.games, coalesce(v_item -> 'games', '[]')) g;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_change -> 'standings_replace', '[]')) loop
    delete from public.standings where phase_id = (v_item ->> 'phase_id')::uuid;
    insert into public.standings (phase_id, tournament_id, group_id, entrant_id, rank, points, played, wins,
      losses, draws, game_wins, game_losses, game_diff, tiebreak_details, status)
    select (v_item ->> 'phase_id')::uuid, p_tournament_id, s.group_id, s.entrant_id, s.rank, coalesce(s.points, 0),
      coalesce(s.played, 0), coalesce(s.wins, 0), coalesce(s.losses, 0), coalesce(s.draws, 0),
      coalesce(s.game_wins, 0), coalesce(s.game_losses, 0), coalesce(s.game_diff, 0),
      coalesce(s.tiebreak_details, '{}'), coalesce(s.status, 'in_contention')
    from jsonb_populate_recordset(null::public.standings, coalesce(v_item -> 'rows', '[]')) s;
  end loop;

  insert into public.match_checkins (match_id, entrant_id, user_id, method)
  select r.match_id, r.entrant_id, r.user_id, coalesce(r.method, 'web')
  from jsonb_populate_recordset(null::public.match_checkins, coalesce(p_change -> 'checkins_insert', '[]')) r;

  insert into public.result_reports (match_id, reported_by_entrant_id, reported_by_user_id, winner_entrant_id,
    score_a, score_b, games, evidence_paths)
  select r.match_id, r.reported_by_entrant_id, r.reported_by_user_id, r.winner_entrant_id, r.score_a, r.score_b,
    r.games, coalesce(r.evidence_paths, '{}')
  from jsonb_populate_recordset(null::public.result_reports, coalesce(p_change -> 'reports_insert', '[]')) r;

  insert into public.disputes (id, match_id, opened_by_user_id, opened_by_entrant_id, category, description)
  select coalesce(r.id, private.uuid_v7()), r.match_id, r.opened_by_user_id, r.opened_by_entrant_id,
    coalesce(r.category, 'result'), r.description
  from jsonb_populate_recordset(null::public.disputes, coalesce(p_change -> 'disputes_insert', '[]')) r;

  for v_item in select value from jsonb_array_elements(coalesce(p_change -> 'disputes_update', '[]')) loop
    v_set := v_item -> 'set';
    update public.disputes d set
      status = case when v_set ? 'status' then (v_set ->> 'status')::public.dispute_status else d.status end,
      resolution = case when v_set ? 'resolution' then v_set ->> 'resolution' else d.resolution end,
      resolved_by = case when v_set ? 'resolved_by' then (v_set ->> 'resolved_by')::uuid else d.resolved_by end,
      resolved_at = case when v_set ? 'resolved_at' then (v_set ->> 'resolved_at')::timestamptz else d.resolved_at end,
      assigned_to = case when v_set ? 'assigned_to' then (v_set ->> 'assigned_to')::uuid else d.assigned_to end
    where d.id = (v_item ->> 'id')::uuid and d.status in ('open', 'under_review');
    if not found then
      raise exception 'dispute_not_open' using errcode = 'P0001';
    end if;
  end loop;

  insert into public.dispute_evidence (dispute_id, storage_path, url, note, added_by)
  select r.dispute_id, r.storage_path, r.url, r.note, r.added_by
  from jsonb_populate_recordset(null::public.dispute_evidence, coalesce(p_change -> 'evidence_insert', '[]')) r;

  insert into public.reschedule_requests (match_id, requested_by_entrant_id, requested_by_user_id, proposed_at, reason)
  select r.match_id, r.requested_by_entrant_id, r.requested_by_user_id, r.proposed_at, r.reason
  from jsonb_populate_recordset(null::public.reschedule_requests, coalesce(p_change -> 'reschedules_insert', '[]')) r;

  for v_item in select value from jsonb_array_elements(coalesce(p_change -> 'reschedules_update', '[]')) loop
    v_set := v_item -> 'set';
    update public.reschedule_requests r set
      status = case when v_set ? 'status' then (v_set ->> 'status')::public.reschedule_status else r.status end,
      chosen_at = case when v_set ? 'chosen_at' then (v_set ->> 'chosen_at')::timestamptz else r.chosen_at end,
      responded_by = case when v_set ? 'responded_by' then (v_set ->> 'responded_by')::uuid else r.responded_by end,
      decided_by = case when v_set ? 'decided_by' then (v_set ->> 'decided_by')::uuid else r.decided_by end,
      decided_at = case when v_set ? 'decided_at' then (v_set ->> 'decided_at')::timestamptz else r.decided_at end
    where r.id = (v_item ->> 'id')::uuid and r.status in ('pending', 'accepted');
    if not found then
      raise exception 'reschedule_not_open' using errcode = 'P0001';
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_change -> 'audits', '[]')) loop
    perform private.write_audit(v_tournament.organization_id, p_actor, v_item ->> 'action',
      v_item ->> 'entity_type', (v_item ->> 'entity_id')::uuid, v_item -> 'before', v_item -> 'after',
      v_item ->> 'reason');
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_change -> 'events', '[]')) loop
    perform private.emit_event(v_tournament.organization_id, v_item ->> 'aggregate_type',
      (v_item ->> 'aggregate_id')::uuid, v_item ->> 'event_type', v_item -> 'payload');
  end loop;
end;
$$;

revoke execute on function public.svc_commit_competition(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.svc_commit_competition(uuid, uuid, jsonb) to service_role;

revoke execute on all functions in schema private from public, anon;
