-- Module 09: stats, MVPs, achievements and follows (docs/03 §8, docs/specs/m09).
-- Everything here is derived from games.raw_match_payload by the API
-- (packages/core computes it) and written with the secret key. stats_jobs is
-- the recalculation queue: a trigger enqueues the match when it closes or
-- when its match data arrives, and the API worker drains it.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.stats_scope as enum ('tournament', 'circuit', 'season', 'all_time');
create type public.mvp_scope as enum ('game', 'match', 'week', 'phase', 'tournament');
create type public.followable_type as enum ('team', 'user', 'tournament', 'organization');

-- ---------------------------------------------------------------------------
-- Per game (docs/03 §8)
-- ---------------------------------------------------------------------------
create table public.player_game_stats (
  id uuid primary key default private.uuid_v7(),
  game_id uuid not null references public.games (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  tournament_id uuid not null references public.tournaments (id),
  user_id uuid references public.users (id),
  puuid text not null check (char_length(puuid) between 1 and 100),
  entrant_id uuid not null references public.entrants (id),
  side public.game_side not null,
  champion_id integer not null check (champion_id > 0),
  game_role public.player_role,
  win boolean not null,
  duration_seconds integer not null check (duration_seconds > 0),
  played_at timestamptz not null,
  kills smallint not null check (kills >= 0),
  deaths smallint not null check (deaths >= 0),
  assists smallint not null check (assists >= 0),
  kda numeric(6, 2) not null,
  cs integer not null check (cs >= 0),
  cs_per_min numeric(6, 2) not null,
  gold integer not null check (gold >= 0),
  gold_per_min numeric(7, 2) not null,
  damage_to_champions integer not null check (damage_to_champions >= 0),
  damage_per_min numeric(7, 2) not null,
  damage_share numeric(5, 4) not null,
  damage_taken integer not null check (damage_taken >= 0),
  vision_score integer not null check (vision_score >= 0),
  vision_per_min numeric(6, 2) not null,
  wards_placed smallint not null check (wards_placed >= 0),
  wards_killed smallint not null check (wards_killed >= 0),
  kill_participation numeric(5, 4) not null,
  first_blood boolean not null default false,
  -- { turrets, dragons, barons, multikills: { double, triple, quadra, penta } }
  objectives jsonb not null default '{}',
  items jsonb not null default '[]',
  runes jsonb not null default '{}',
  score numeric(7, 2) not null,
  is_mvp boolean not null default false,
  created_at timestamptz not null default now(),
  unique (game_id, puuid)
);
create index player_game_stats_user_idx on public.player_game_stats (user_id, played_at);
create index player_game_stats_tournament_idx on public.player_game_stats (tournament_id);
create index player_game_stats_match_idx on public.player_game_stats (match_id);

create table public.team_game_stats (
  id uuid primary key default private.uuid_v7(),
  game_id uuid not null references public.games (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  tournament_id uuid not null references public.tournaments (id),
  entrant_id uuid not null references public.entrants (id),
  team_id uuid references public.teams (id),
  side public.game_side not null,
  win boolean not null,
  duration_seconds integer not null check (duration_seconds > 0),
  played_at timestamptz not null,
  kills smallint not null check (kills >= 0),
  gold integer not null check (gold >= 0),
  towers smallint not null check (towers >= 0),
  dragons smallint not null check (dragons >= 0),
  barons smallint not null check (barons >= 0),
  heralds smallint not null check (heralds >= 0),
  grubs smallint not null check (grubs >= 0),
  inhibitors smallint not null check (inhibitors >= 0),
  -- { blood, tower, dragon, baron }
  first_objectives jsonb not null default '{}',
  bans integer[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (game_id, entrant_id)
);
create index team_game_stats_team_idx on public.team_game_stats (team_id, played_at);
create index team_game_stats_tournament_idx on public.team_game_stats (tournament_id);

-- Notable moments for the narrative. timestamp_ms needs the timeline (m08);
-- from the match payload alone it is null.
create table public.game_timeline_events (
  id uuid primary key default private.uuid_v7(),
  game_id uuid not null references public.games (id) on delete cascade,
  tournament_id uuid not null references public.tournaments (id),
  timestamp_ms integer check (timestamp_ms >= 0),
  type text not null check (type in ('first_blood', 'first_tower', 'first_dragon', 'first_baron', 'quadrakill', 'pentakill', 'baron', 'dragon', 'ace', 'steal')),
  actor_puuid text,
  side public.game_side,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index game_timeline_events_game_idx on public.game_timeline_events (game_id);

-- ---------------------------------------------------------------------------
-- Aggregates by scope: tournament, circuit, season (scope_id) or all-time (null)
-- ---------------------------------------------------------------------------
create table public.player_aggregate_stats (
  id uuid primary key default private.uuid_v7(),
  user_id uuid not null references public.users (id),
  scope_type public.stats_scope not null,
  scope_id uuid,
  games integer not null check (games >= 0),
  wins integer not null check (wins >= 0),
  kills integer not null default 0,
  deaths integer not null default 0,
  assists integer not null default 0,
  kda numeric(6, 2) not null,
  avg_cs_per_min numeric(6, 2) not null,
  avg_gold_per_min numeric(7, 2) not null,
  avg_damage_per_min numeric(7, 2) not null,
  avg_vision numeric(6, 2) not null,
  avg_kp numeric(5, 4) not null,
  avg_damage_share numeric(5, 4) not null,
  avg_score numeric(7, 2) not null,
  mvps integer not null default 0,
  -- { aggression, vision, farming, teamfight, survival }: 0–100 (packages/core)
  radar jsonb not null,
  updated_at timestamptz not null default now(),
  check ((scope_type = 'all_time') = (scope_id is null)),
  unique nulls not distinct (user_id, scope_type, scope_id)
);
create index player_aggregate_stats_scope_idx on public.player_aggregate_stats (scope_type, scope_id);

create table public.player_champion_stats (
  id uuid primary key default private.uuid_v7(),
  user_id uuid not null references public.users (id),
  scope_type public.stats_scope not null,
  scope_id uuid,
  champion_id integer not null check (champion_id > 0),
  games integer not null check (games >= 0),
  wins integer not null check (wins >= 0),
  kills integer not null default 0,
  deaths integer not null default 0,
  assists integer not null default 0,
  kda numeric(6, 2) not null,
  updated_at timestamptz not null default now(),
  check ((scope_type = 'all_time') = (scope_id is null)),
  unique nulls not distinct (user_id, scope_type, scope_id, champion_id)
);

create table public.team_aggregate_stats (
  id uuid primary key default private.uuid_v7(),
  team_id uuid not null references public.teams (id),
  scope_type public.stats_scope not null,
  scope_id uuid,
  games integer not null check (games >= 0),
  wins integer not null check (wins >= 0),
  avg_game_duration integer not null,
  avg_kills numeric(6, 2) not null,
  avg_towers numeric(6, 2) not null,
  avg_dragons numeric(6, 2) not null,
  avg_barons numeric(6, 2) not null,
  first_blood_rate numeric(5, 4) not null,
  first_tower_rate numeric(5, 4) not null,
  updated_at timestamptz not null default now(),
  check ((scope_type = 'all_time') = (scope_id is null)),
  unique nulls not distinct (team_id, scope_type, scope_id)
);

create table public.champion_meta_stats (
  tournament_id uuid not null references public.tournaments (id),
  champion_id integer not null check (champion_id > 0),
  picks integer not null default 0,
  bans integer not null default 0,
  wins integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tournament_id, champion_id)
);

-- ---------------------------------------------------------------------------
-- Achievements and MVPs
-- ---------------------------------------------------------------------------
-- organization_id null = a platform achievement; criteria is evaluated by
-- packages/core (evaluateAchievements) and validated by packages/contracts.
create table public.achievements (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid references public.organizations (id),
  key text not null check (key ~ '^[a-z0-9_]{3,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  description text not null check (char_length(description) between 2 and 200),
  icon text not null default 'trophy' check (icon in ('trophy', 'flame', 'swords', 'eye', 'crown', 'star', 'target', 'shield')),
  icon_media_id uuid,
  criteria jsonb not null,
  is_active boolean not null default true,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id),
  unique nulls not distinct (organization_id, key)
);
create trigger achievements_set_updated_at before update on public.achievements
  for each row execute function private.set_updated_at();

create table public.user_achievements (
  user_id uuid not null references public.users (id),
  achievement_id uuid not null references public.achievements (id),
  awarded_at timestamptz not null default now(),
  tournament_id uuid references public.tournaments (id),
  -- { gameId, value }
  context jsonb not null default '{}',
  primary key (user_id, achievement_id)
);

-- scope_id: the game, match, phase or tournament id; a week (jornada) is
-- '<phase_id>:<round>'.
create table public.mvp_awards (
  id uuid primary key default private.uuid_v7(),
  scope_type public.mvp_scope not null,
  scope_id text not null check (scope_id ~ '^[0-9a-f-]{36}(:[0-9]{1,3})?$'),
  tournament_id uuid not null references public.tournaments (id),
  user_id uuid not null references public.users (id),
  entrant_id uuid references public.entrants (id),
  score numeric(7, 2) not null,
  games smallint not null default 1,
  -- Filled by the monetization module.
  sponsor_placement_id uuid,
  awarded_at timestamptz not null default now(),
  unique (scope_type, scope_id)
);
create index mvp_awards_user_idx on public.mvp_awards (user_id);
create index mvp_awards_tournament_idx on public.mvp_awards (tournament_id, scope_type);

-- ---------------------------------------------------------------------------
-- Follows: private to the follower (counts are public through the API)
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_user_id uuid not null references public.users (id),
  followable_type public.followable_type not null,
  followable_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (follower_user_id, followable_type, followable_id)
);
create index follows_followable_idx on public.follows (followable_type, followable_id);

-- ---------------------------------------------------------------------------
-- Recalculation queue (one row per match; requested again = pending again)
-- ---------------------------------------------------------------------------
create table public.stats_jobs (
  match_id uuid primary key references public.matches (id) on delete cascade,
  tournament_id uuid not null references public.tournaments (id),
  requested_at timestamptz not null default now(),
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  locked_until timestamptz,
  last_error text check (char_length(last_error) <= 500),
  processed_at timestamptz,
  dead_at timestamptz
);
create index stats_jobs_pending_idx on public.stats_jobs (requested_at)
  where processed_at is null and dead_at is null;

create function private.request_stats_job(p_match_id uuid, p_tournament_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.stats_jobs (match_id, tournament_id)
  values (p_match_id, p_tournament_id)
  on conflict (match_id) do update set
    requested_at = clock_timestamp(), attempts = 0, next_attempt_at = null,
    last_error = null, processed_at = null, dead_at = null;
$$;

-- A match closes (or its result is overridden): recalculate.
create function private.enqueue_match_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('completed', 'forfeit')
     and (old.status is distinct from new.status or old.finalized_at is distinct from new.finalized_at) then
    perform private.request_stats_job(new.id, new.tournament_id);
  end if;
  return new;
end;
$$;
create trigger matches_enqueue_stats after update on public.matches
  for each row execute function private.enqueue_match_stats();

-- Match data arrives (Riot callback in m08, or uploaded by staff).
create function private.enqueue_game_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_id uuid;
begin
  if new.raw_match_payload is distinct from old.raw_match_payload then
    select tournament_id into v_tournament_id from public.matches where id = new.match_id;
    perform private.request_stats_job(new.match_id, v_tournament_id);
  end if;
  return new;
end;
$$;
create trigger games_enqueue_stats after update of raw_match_payload on public.games
  for each row execute function private.enqueue_game_stats();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.player_game_stats enable row level security;
alter table public.team_game_stats enable row level security;
alter table public.game_timeline_events enable row level security;
alter table public.player_aggregate_stats enable row level security;
alter table public.player_champion_stats enable row level security;
alter table public.team_aggregate_stats enable row level security;
alter table public.champion_meta_stats enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.mvp_awards enable row level security;
alter table public.follows enable row level security;
alter table public.stats_jobs enable row level security;

-- Public competition data, read live by the profile and tournament pages.
create policy "player_aggregate_stats: public" on public.player_aggregate_stats
  for select to anon, authenticated using (true);
create policy "champion_meta_stats: public" on public.champion_meta_stats
  for select to anon, authenticated using (true);
-- Who follows whom is private: each user reads only their own follows.
create policy "follows: own" on public.follows
  for select to authenticated using (follower_user_id = (select auth.uid()));
-- The rest (game lines carry the PUUID, the queue, achievements and MVPs) has
-- no policy and no client grant: the API serves it with privacy applied.

grant select on public.player_aggregate_stats, public.champion_meta_stats to anon, authenticated;
grant select on public.follows to authenticated;
grant select, insert, update, delete on
  public.player_game_stats, public.team_game_stats, public.game_timeline_events,
  public.player_aggregate_stats, public.player_champion_stats, public.team_aggregate_stats,
  public.champion_meta_stats, public.achievements, public.user_achievements, public.mvp_awards,
  public.follows, public.stats_jobs
  to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.player_aggregate_stats, public.champion_meta_stats;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Service functions (secret key only)
-- ---------------------------------------------------------------------------

-- Takes up to p_limit pending jobs that are due and leases them.
create function public.svc_claim_stats_jobs(p_limit integer, p_lease_seconds integer)
returns setof public.stats_jobs
language sql
set search_path = ''
as $$
  update public.stats_jobs j set locked_until = now() + make_interval(secs => p_lease_seconds)
  where j.match_id in (
    select match_id from public.stats_jobs
    where processed_at is null and dead_at is null
      and (next_attempt_at is null or next_attempt_at <= now())
      and (locked_until is null or locked_until < now())
    order by requested_at
    limit p_limit
    for update skip locked
  )
  returning j.*;
$$;

create function public.svc_fail_stats_job(
  p_match_id uuid, p_error text, p_next_attempt_at timestamptz, p_dead boolean
)
returns void
language sql
set search_path = ''
as $$
  update public.stats_jobs set
    attempts = attempts + 1,
    last_error = left(p_error, 500),
    next_attempt_at = p_next_attempt_at,
    locked_until = null,
    dead_at = case when p_dead then now() end
  where match_id = p_match_id;
$$;

-- Writes everything one recalculation produced, atomically. Idempotent: rows
-- are replaced (game lines, champion lists, meta) or upserted (aggregates,
-- MVPs); achievements are never awarded twice. The job is marked processed
-- unless it was requested again meanwhile (then it runs once more).
-- p_data: { games: [{ game_id, players: [], teams: [], events: [] }],
--   player_aggregates: [], player_champions: { scopes: [], rows: [] },
--   team_aggregates: [], champion_meta: [], mvp_scopes: [], mvp_awards: [],
--   achievements: [] }
create function public.svc_save_match_stats(p_match_id uuid, p_requested_at timestamptz, p_data jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_match public.matches;
  v_awarded integer;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'match_not_found' using errcode = 'P0001';
  end if;

  delete from public.player_game_stats where match_id = p_match_id;
  delete from public.team_game_stats where match_id = p_match_id;
  delete from public.game_timeline_events e using public.games g
    where g.id = e.game_id and g.match_id = p_match_id;

  insert into public.player_game_stats (
    game_id, match_id, tournament_id, user_id, puuid, entrant_id, side, champion_id, game_role, win,
    duration_seconds, played_at, kills, deaths, assists, kda, cs, cs_per_min, gold, gold_per_min,
    damage_to_champions, damage_per_min, damage_share, damage_taken, vision_score, vision_per_min,
    wards_placed, wards_killed, kill_participation, first_blood, objectives, items, runes, score, is_mvp)
  select (g ->> 'game_id')::uuid, p_match_id, v_match.tournament_id, r.user_id, r.puuid, r.entrant_id,
    r.side, r.champion_id, r.game_role, r.win, r.duration_seconds, r.played_at, r.kills, r.deaths,
    r.assists, r.kda, r.cs, r.cs_per_min, r.gold, r.gold_per_min, r.damage_to_champions,
    r.damage_per_min, r.damage_share, r.damage_taken, r.vision_score, r.vision_per_min, r.wards_placed,
    r.wards_killed, r.kill_participation, coalesce(r.first_blood, false), coalesce(r.objectives, '{}'),
    coalesce(r.items, '[]'), coalesce(r.runes, '{}'), r.score, coalesce(r.is_mvp, false)
  from jsonb_array_elements(coalesce(p_data -> 'games', '[]')) g,
    jsonb_populate_recordset(null::public.player_game_stats, g -> 'players') r;

  insert into public.team_game_stats (
    game_id, match_id, tournament_id, entrant_id, team_id, side, win, duration_seconds, played_at, kills,
    gold, towers, dragons, barons, heralds, grubs, inhibitors, first_objectives, bans)
  select (g ->> 'game_id')::uuid, p_match_id, v_match.tournament_id, r.entrant_id, r.team_id, r.side,
    r.win, r.duration_seconds, r.played_at, r.kills, r.gold, r.towers, r.dragons, r.barons, r.heralds,
    r.grubs, r.inhibitors, coalesce(r.first_objectives, '{}'), coalesce(r.bans, '{}')
  from jsonb_array_elements(coalesce(p_data -> 'games', '[]')) g,
    jsonb_populate_recordset(null::public.team_game_stats, g -> 'teams') r;

  insert into public.game_timeline_events (game_id, tournament_id, timestamp_ms, type, actor_puuid, side, payload)
  select (g ->> 'game_id')::uuid, v_match.tournament_id, r.timestamp_ms, r.type, r.actor_puuid, r.side,
    coalesce(r.payload, '{}')
  from jsonb_array_elements(coalesce(p_data -> 'games', '[]')) g,
    jsonb_populate_recordset(null::public.game_timeline_events, g -> 'events') r;

  insert into public.player_aggregate_stats (
    user_id, scope_type, scope_id, games, wins, kills, deaths, assists, kda, avg_cs_per_min,
    avg_gold_per_min, avg_damage_per_min, avg_vision, avg_kp, avg_damage_share, avg_score, mvps, radar,
    updated_at)
  select r.user_id, r.scope_type, r.scope_id, r.games, r.wins, r.kills, r.deaths, r.assists, r.kda,
    r.avg_cs_per_min, r.avg_gold_per_min, r.avg_damage_per_min, r.avg_vision, r.avg_kp,
    r.avg_damage_share, r.avg_score, r.mvps, r.radar, now()
  from jsonb_populate_recordset(null::public.player_aggregate_stats, coalesce(p_data -> 'player_aggregates', '[]')) r
  on conflict (user_id, scope_type, scope_id) do update set
    games = excluded.games, wins = excluded.wins, kills = excluded.kills, deaths = excluded.deaths,
    assists = excluded.assists, kda = excluded.kda, avg_cs_per_min = excluded.avg_cs_per_min,
    avg_gold_per_min = excluded.avg_gold_per_min, avg_damage_per_min = excluded.avg_damage_per_min,
    avg_vision = excluded.avg_vision, avg_kp = excluded.avg_kp,
    avg_damage_share = excluded.avg_damage_share, avg_score = excluded.avg_score, mvps = excluded.mvps,
    radar = excluded.radar, updated_at = now();

  -- A player who no longer has games in a scope (overridden result) loses its row.
  delete from public.player_aggregate_stats a
  using jsonb_populate_recordset(null::public.player_aggregate_stats, coalesce(p_data -> 'player_aggregates_clear', '[]')) c
  where a.user_id = c.user_id and a.scope_type = c.scope_type and a.scope_id is not distinct from c.scope_id;

  delete from public.player_champion_stats p
  using jsonb_populate_recordset(null::public.player_champion_stats, coalesce(p_data #> '{player_champions,scopes}', '[]')) s
  where p.user_id = s.user_id and p.scope_type = s.scope_type and p.scope_id is not distinct from s.scope_id;
  insert into public.player_champion_stats (user_id, scope_type, scope_id, champion_id, games, wins, kills, deaths, assists, kda)
  select r.user_id, r.scope_type, r.scope_id, r.champion_id, r.games, r.wins, r.kills, r.deaths, r.assists, r.kda
  from jsonb_populate_recordset(null::public.player_champion_stats, coalesce(p_data #> '{player_champions,rows}', '[]')) r;

  insert into public.team_aggregate_stats (
    team_id, scope_type, scope_id, games, wins, avg_game_duration, avg_kills, avg_towers, avg_dragons,
    avg_barons, first_blood_rate, first_tower_rate, updated_at)
  select r.team_id, r.scope_type, r.scope_id, r.games, r.wins, r.avg_game_duration, r.avg_kills,
    r.avg_towers, r.avg_dragons, r.avg_barons, r.first_blood_rate, r.first_tower_rate, now()
  from jsonb_populate_recordset(null::public.team_aggregate_stats, coalesce(p_data -> 'team_aggregates', '[]')) r
  on conflict (team_id, scope_type, scope_id) do update set
    games = excluded.games, wins = excluded.wins, avg_game_duration = excluded.avg_game_duration,
    avg_kills = excluded.avg_kills, avg_towers = excluded.avg_towers, avg_dragons = excluded.avg_dragons,
    avg_barons = excluded.avg_barons, first_blood_rate = excluded.first_blood_rate,
    first_tower_rate = excluded.first_tower_rate, updated_at = now();

  delete from public.champion_meta_stats where tournament_id = v_match.tournament_id;
  insert into public.champion_meta_stats (tournament_id, champion_id, picks, bans, wins)
  select v_match.tournament_id, r.champion_id, r.picks, r.bans, r.wins
  from jsonb_populate_recordset(null::public.champion_meta_stats, coalesce(p_data -> 'champion_meta', '[]')) r;

  delete from public.mvp_awards m
  using jsonb_populate_recordset(null::public.mvp_awards, coalesce(p_data -> 'mvp_scopes', '[]')) s
  where m.scope_type = s.scope_type and m.scope_id = s.scope_id;
  insert into public.mvp_awards (scope_type, scope_id, tournament_id, user_id, entrant_id, score, games)
  select r.scope_type, r.scope_id, v_match.tournament_id, r.user_id, r.entrant_id, r.score, coalesce(r.games, 1)
  from jsonb_populate_recordset(null::public.mvp_awards, coalesce(p_data -> 'mvp_awards', '[]')) r;

  insert into public.user_achievements (user_id, achievement_id, tournament_id, context)
  select r.user_id, r.achievement_id, v_match.tournament_id, coalesce(r.context, '{}')
  from jsonb_populate_recordset(null::public.user_achievements, coalesce(p_data -> 'achievements', '[]')) r
  on conflict (user_id, achievement_id) do nothing;
  get diagnostics v_awarded = row_count;

  update public.stats_jobs set
    processed_at = case when requested_at = p_requested_at then now() end,
    locked_until = null, last_error = null
  where match_id = p_match_id;
  return v_awarded;
end;
$$;

-- Match data of one completed game (Match-V5, from Riot or uploaded by staff):
-- stores the payload and replaces its participants and draft. The games
-- trigger then enqueues the recalculation. Audited.
-- p_game: { payload, duration_seconds, patch, riot_match_id }
-- p_participants: [game_participants columns]; p_draft: [draft_actions columns]
create function public.svc_attach_game_data(
  p_game_id uuid, p_actor uuid, p_game jsonb, p_participants jsonb, p_draft jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_game public.games;
  v_match public.matches;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;
  if v_game.status <> 'completed' then
    raise exception 'game_not_completed' using errcode = 'P0001';
  end if;
  select * into v_match from public.matches where id = v_game.match_id;

  update public.games set
    raw_match_payload = p_game -> 'payload',
    duration_seconds = (p_game ->> 'duration_seconds')::integer,
    patch = p_game ->> 'patch',
    riot_match_id = coalesce(p_game ->> 'riot_match_id', riot_match_id),
    updated_at = now()
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

  perform private.write_audit(v_match.organization_id, p_actor, 'game.match_data.attached', 'game', p_game_id,
    jsonb_build_object('had_payload', v_game.raw_match_payload is not null),
    jsonb_build_object('riot_match_id', p_game ->> 'riot_match_id', 'participants', jsonb_array_length(coalesce(p_participants, '[]'))),
    null);
end;
$$;

-- Recalculate a whole tournament (staff action): every closed match again.
create function public.svc_request_tournament_stats(p_tournament_id uuid, p_actor uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_match public.matches;
  v_count integer := 0;
  v_org uuid;
begin
  select organization_id into v_org from public.tournaments where id = p_tournament_id;
  if not found then
    raise exception 'tournament_not_found' using errcode = 'P0001';
  end if;
  for v_match in select * from public.matches where tournament_id = p_tournament_id and status in ('completed', 'forfeit') loop
    perform private.request_stats_job(v_match.id, p_tournament_id);
    v_count := v_count + 1;
  end loop;
  perform private.write_audit(v_org, p_actor, 'tournament.stats.recalculated', 'tournament', p_tournament_id,
    null, jsonb_build_object('matches', v_count), null);
  return v_count;
end;
$$;

-- Achievement rules are edited by staff and audited.
create function public.svc_save_achievement(
  p_organization_id uuid, p_actor uuid, p_key text, p_name text, p_description text, p_icon text,
  p_criteria jsonb, p_active boolean
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  select to_jsonb(a) into v_before from public.achievements a
  where organization_id is not distinct from p_organization_id and key = p_key;
  insert into public.achievements (organization_id, key, name, description, icon, criteria, is_active, updated_by)
  values (p_organization_id, p_key, p_name, p_description, p_icon, p_criteria, p_active, p_actor)
  on conflict (organization_id, key) do update set
    name = excluded.name, description = excluded.description, icon = excluded.icon,
    criteria = excluded.criteria, is_active = excluded.is_active, updated_by = excluded.updated_by;
  perform private.write_audit(p_organization_id, p_actor, 'achievement.saved', 'achievement', null,
    v_before, jsonb_build_object('key', p_key, 'criteria', p_criteria, 'active', p_active), null);
end;
$$;

revoke execute on function
  public.svc_claim_stats_jobs(integer, integer),
  public.svc_fail_stats_job(uuid, text, timestamptz, boolean),
  public.svc_save_match_stats(uuid, timestamptz, jsonb),
  public.svc_attach_game_data(uuid, uuid, jsonb, jsonb, jsonb),
  public.svc_request_tournament_stats(uuid, uuid),
  public.svc_save_achievement(uuid, uuid, text, text, text, text, jsonb, boolean)
from public, anon, authenticated;
grant execute on function
  public.svc_claim_stats_jobs(integer, integer),
  public.svc_fail_stats_job(uuid, text, timestamptz, boolean),
  public.svc_save_match_stats(uuid, timestamptz, jsonb),
  public.svc_attach_game_data(uuid, uuid, jsonb, jsonb, jsonb),
  public.svc_request_tournament_stats(uuid, uuid),
  public.svc_save_achievement(uuid, uuid, text, text, text, text, jsonb, boolean)
to service_role;
revoke execute on function private.request_stats_job(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Base achievements (platform-wide)
-- ---------------------------------------------------------------------------
insert into public.achievements (organization_id, key, name, description, icon, criteria, position) values
  (null, 'first_win', 'Primera victoria', 'Gana tu primer game oficial.', 'trophy',
    '{"type": "games", "gte": 1, "wins": true}', 10),
  (null, 'games_10', 'Constante', 'Juega 10 games oficiales.', 'shield',
    '{"type": "games", "gte": 10}', 20),
  (null, 'win_streak_3', 'En racha', 'Gana 3 games seguidos.', 'flame',
    '{"type": "win_streak", "gte": 3}', 30),
  (null, 'win_streak_5', 'Imparable', 'Gana 5 games seguidos.', 'flame',
    '{"type": "win_streak", "gte": 5}', 31),
  (null, 'first_pentakill', 'Pentakill', 'Consigue tu primer pentakill en un game oficial.', 'swords',
    '{"type": "game", "conditions": [{"stat": "pentaKills", "gte": 1}]}', 40),
  (null, 'perfect_game', 'Partida perfecta', 'Termina un game sin morir y con 10 o más kills + asistencias.', 'star',
    '{"type": "game", "conditions": [{"stat": "deaths", "lte": 0}, {"stat": "kda", "gte": 10}]}', 50),
  (null, 'vision_master', 'Ojo de halcón', 'Logra 70 o más de puntuación de visión en un game.', 'eye',
    '{"type": "game", "conditions": [{"stat": "visionScore", "gte": 70}]}', 60),
  (null, 'mvp_week', 'MVP de la jornada', 'Sé el mejor jugador de una jornada.', 'crown',
    '{"type": "mvp", "scope": "week", "gte": 1}', 70),
  (null, 'mvp_games_5', 'Figura', 'Sé MVP de 5 games.', 'target',
    '{"type": "mvp", "scope": "game", "gte": 5}', 80);

-- ---------------------------------------------------------------------------
-- Notifications (m06): "your team plays" for followers
-- ---------------------------------------------------------------------------
alter table public.notification_types drop constraint notification_types_audience_check;
alter table public.notification_types add constraint notification_types_audience_check
  check (audience in ('entrant', 'match_parties', 'tournament_entrants', 'tournament_staff', 'opted_in', 'followers'));

insert into public.notification_types (key, category, is_critical, default_channels, audience, position) values
  ('follow.match_scheduled', 'matches', false, '{in_app}', 'followers', 28);

insert into public.notification_templates (organization_id, type_key, channel, locale, subject, body, variables) values
  (null, 'follow.match_scheduled', 'in_app', 'es-419', '{{entrant.name}} juega pronto',
    '{{entrant.name}} contra {{opponent.name}} en {{tournament.name}}: {{match.scheduled_at}}.',
    '{entrant.name,match.scheduled_at,opponent.name,tournament.name}'),
  (null, 'follow.match_scheduled', 'email', 'es-419', '{{entrant.name}} juega pronto',
    E'Hola, {{user.name}}:\n\n{{entrant.name}}, a quien sigues, juega contra {{opponent.name}} en {{tournament.name}}: {{match.scheduled_at}}.',
    '{entrant.name,match.scheduled_at,opponent.name,tournament.name,user.name}');
