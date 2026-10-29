# Modelo de Datos Completo

> Documento vivo. Modelo relacional en **PostgreSQL (Supabase)**. Cubre todos
> los dominios: identidad, organizaciones, equipos, competencia, integridad,
> estadísticas, notificaciones, media, redes, transmisión, integraciones,
> monetización y auditoría. Soporta 1v1, 2v2 y 5v5, multi-torneo y multi-tenant.
>
> Las reglas de negocio están en `02-formatos-competencia.md` y
> `13-reglas-integridad.md`. Este documento es el contrato para las migraciones.

---

## 0. Convenciones

- Nombres en inglés, `snake_case`, tablas en plural.
- PK `id uuid` (UUID v7, ordenable por tiempo).
- Todas las tablas: `created_at`, `updated_at`. Las editables por usuarios:
  `created_by`, `updated_by`.
- Borrado lógico (`deleted_at`) en entidades con historial (usuarios, equipos,
  torneos). **Nunca** se borran partidas, resultados ni auditoría.
- Multi-tenant: toda tabla de negocio lleva `organization_id`; RLS por
  organización.
- Configuración flexible en `jsonb` **validada por esquemas Zod versionados**
  (`schema_version`), nunca jsonb libre sin contrato.
- Enums como tipos Postgres o tablas catálogo cuando el admin deba editarlos.
- Montos en enteros (centavos) + `currency`.
- Fechas en `timestamptz` (UTC); zona horaria del evento guardada aparte.

---

## 1. Diagrama de dominios

```
IDENTIDAD ──── ORGANIZACIÓN / ACCESO ──── MARCA
    │                  │
    ▼                  ▼
EQUIPOS ─────► COMPETENCIA (core) ◄───── TEMPORADAS / CIRCUITOS
                 │     │     │
     ┌───────────┘     │     └─────────────┐
     ▼                 ▼                   ▼
INTEGRIDAD       ESTADÍSTICAS       OPERACIÓN DE PARTIDA
(sanciones,      (stats, logros)    (check-in, códigos,
 alertas)                            reportes, disputas)
     │                 │                   │
     └──────► EVENTOS DE DOMINIO (outbox) ◄┘
                       │
   ┌─────────┬─────────┼──────────┬──────────────┐
   ▼         ▼         ▼          ▼              ▼
NOTIFIC.   MEDIA    REDES     TRANSMISIÓN   INTEGRACIONES
                                             (Riot, Discord)
                       │
                MONETIZACIÓN (fase 4) · AUDITORÍA (transversal)
```

---

## 2. Identidad y perfil

```
users                      (1:1 con auth.users de Supabase)
  id (= auth.users.id), username (único, citext), display_name,
  avatar_media_id, avatar_cutout_media_id, banner_media_id, bio,
  country_code, game_region, birth_date, locale, timezone,
  primary_role, secondary_role, is_free_agent, availability (jsonb),
  platform_role (user|support|super_admin), status (active|suspended|banned),
  onboarding_step, last_seen_at, deleted_at

user_private_data          (separada, RLS estricta: solo dueño y staff autorizado)
  user_id, legal_first_name, legal_last_name, phone_e164, phone_verified_at,
  institutional_email, institutional_email_verified_at,
  guardian_name, guardian_contact, guardian_consent_at,
  gender (woman|man|non_binary|prefer_not_to_say), gender_declared_at,
  gender_locked (bool: true tras la primera declaración)

gender_change_requests     (cambiar el género declarado requiere revisión)
  id, user_id, from_value, to_value, reason, status (pending|approved|
  rejected), reviewed_by, reviewed_at

user_social_links
  user_id, platform (twitch|youtube|tiktok|x|instagram|kick|other),
  url, handle, visibility

user_privacy_settings
  user_id, field_key, visibility (public|team|staff|private)

legal_documents            (términos, privacidad, código de conducta)
  id, organization_id null, type, version, content, published_at
user_consents
  user_id, legal_document_id, accepted_at, ip, user_agent
marketing_consents
  user_id, channel, granted, updated_at

riot_accounts
  id, user_id, puuid (ÚNICO global), game_name, tag_line, region,
  summoner_level, profile_icon_id, is_primary, verification_method (rso|icon),
  verified_at, last_synced_at, unlinked_at
riot_verification_attempts
  id, user_id, riot_account_id, method, expected_icon_id, status, expires_at
riot_rank_snapshots        (para peak rank; job periódico)
  riot_account_id, queue (solo|flex), tier, division, lp, wins, losses,
  captured_at
riot_id_history
  riot_account_id, game_name, tag_line, seen_at
```

Índice clave: `UNIQUE (puuid) WHERE unlinked_at IS NULL` → una cuenta Riot,
un usuario.

---

## 3. Organización, acceso y marca

```
organizations
  id, name, slug (único), plan, status, default_timezone, default_locale,
  settings (jsonb: límites como max_teams_created_per_user), deleted_at

organization_members
  id, organization_id, user_id, status (invited|active|removed),
  invited_by, joined_at

permissions                (catálogo: 'tournament:create', 'match:result.override'…)
  key, description, category
roles
  id, organization_id null (null = rol de sistema), key, name, is_system
role_permissions
  role_id, permission_key
member_role_assignments    (rol con alcance)
  id, organization_member_id, role_id,
  scope_type (organization|tournament|team), scope_id null,
  granted_by, expires_at null

brand_themes
  id, organization_id, name, is_default, logo_media_id, tokens (jsonb:
  colores, tipografías, radios), schema_version
custom_domains
  organization_id, domain, verified_at

feature_flags
  key, organization_id null, enabled, rollout (jsonb)
```

---

## 4. Clubes y equipos

> **Vocabulario:** `organizations` = tenant de la plataforma (tu liga; en el
> SaaS, cada organizador). `clubs` = organización de esports que compite (ej.
> un club con roster principal, femenil y academia). Se llaman distinto a
> propósito para no confundirlos.

```
clubs
  id, organization_id, name, tag, slug, logo_media_id, banner_media_id,
  owner_user_id, description, social_links (jsonb), website,
  status (pending|active|inactive|banned), verified_at, deleted_at
club_members               (staff del club: dueño, manager, coach)
  id, club_id, user_id, club_role (owner|manager|coach|analyst), joined_at,
  left_at

teams
  id, organization_id, club_id null (null = equipo independiente),
  name, tag, slug, logo_media_id, banner_media_id,
  kind (permanent|ad_hoc), owner_user_id, region, description,
  status (active|inactive|disbanded|banned), social_links (jsonb),
  approved_at (moderación), deleted_at
  UNIQUE (organization_id, lower(name)) WHERE kind='permanent'
  UNIQUE (organization_id, lower(tag))  WHERE kind='permanent'

team_members
  id, team_id, user_id, team_role (captain|co_captain|player|substitute|coach|manager),
  game_role null, joined_at, left_at null, left_reason
  UNIQUE (team_id, user_id) WHERE left_at IS NULL

team_invitations
  id, team_id, invited_user_id null, invite_code null, team_role,
  status (pending|accepted|declined|expired|revoked), expires_at, created_by
team_join_requests
  id, team_id, user_id, message, status, decided_by, decided_at
team_name_history
  team_id, name, tag, changed_at, changed_by
free_agent_listings
  id, user_id, organization_id, roles (array), rank_snapshot_id, message,
  availability (jsonb), active_until
```

---

## 5. Temporadas y circuitos

```
seasons
  id, organization_id, name ('2027 Split 1'), starts_at, ends_at, status

circuits
  id, organization_id, season_id, name, description, points_config (jsonb),
  exclusivity_scope (none|circuit), status
circuit_tournaments
  circuit_id, tournament_id, weight
circuit_points
  id, circuit_id, entrant_key (team_id o user_id), tournament_id, points, reason
circuit_rankings           (materializado / recalculado por job)
  circuit_id, team_id null, user_id null, points, rank, updated_at
```

---

## 6. Competencia (core)

### 6.1 Torneo y configuración
```
tournament_templates
  id, organization_id, name, config (jsonb completo del wizard), schema_version

tournaments
  id, organization_id, season_id null, template_id null, slug, name,
  type (league|flash|womens|university|ranked_tier|custom), tier (1|2|3),
  status (draft|published|registration_open|registration_closed|seeding|
          in_progress|completed|canceled|archived),
  visibility (public|unlisted|private),
  description, cover_media_id, timezone,
  registration_opens_at, registration_closes_at, starts_at, ends_at,
  capacity, waitlist_enabled,
  entrant_kind (team|solo), team_source (permanent_only|ad_hoc_allowed|ad_hoc_only),
  participant_policy (independent_only|clubs_only|mixed),
  max_rosters_per_club (n, default 1),
  modality (online|onsite|hybrid), venue (jsonb null: nombre, dirección,
  ciudad, mapa, capacidad — solo si onsite/hybrid),
  has_prizes (bool), prize_pool_summary (texto público),
  exclusivity_scope (none|tournament|circuit|season),
  supervision_level (automatic|dual_report|referee|broadcast),
  costream_policy (disabled|registered_creators|approval_required),
  costream_delay_seconds,
  current_rulebook_version_id, settings (jsonb), schema_version,
  published_at, published_by, deleted_at

tournament_game_settings   (lo que se envía a Riot al generar códigos)
  tournament_id, team_size (1..5), map (summoners_rift|howling_abyss),
  pick_type (tournament_draft|blind_pick|draft_mode|all_random),
  spectator_type (none|lobbyonly|all), custom_win_condition (texto, ej. 1v1)

tournament_roster_rules
  tournament_id, starters (n), max_substitutes, coach_allowed,
  max_roster_changes, roster_lock_at_phase_id null, min_games_for_playoffs,
  leave_cooldown_days

eligibility_rules          (motor de reglas — Specification pattern)
  id, tournament_id, rule_type ('rank_max','peak_rank_max','age_min',
     'region','institution','gender','max_tier_roster','not_sanctioned',…),
  params (jsonb), applies_to (player|team_average|roster), position, is_active

rulebooks
  id, organization_id, tournament_id null, title
rulebook_versions
  id, rulebook_id, version, content (markdown), change_summary, published_at

tournament_staff           (asignaciones; también expresable con member_role_assignments)
  tournament_id, user_id, staff_role (manager|referee|producer|caster)

tournament_prizes          (opcional por torneo; disponible desde el piloto)
  id, tournament_id, placement_from, placement_to (ej. 1–1, 3–4),
  award_type (placement|mvp|special),  label (ej. "MVP de la final"),
  prize_type (cash|peripheral|merch|in_game|voucher|prestige|custom),
  description, amount null, currency (MXN) null, quantity,
  sponsor_id null, image_media_id null,
  distribution (team|per_player|captain), position
  → el entregable real se registra en prize_payouts (efectivo) o
    prize_deliveries (físico/digital)

prize_deliveries           (premios en especie)
  id, tournament_prize_id, entrant_id, recipient_user_id,
  status (pending|shipped|delivered|claimed), shipping_info_ref,
  tracking, delivered_at
```

### 6.2 Inscripciones (entrants) y rosters
```
entrants                   (participante de un torneo: equipo o jugador solo)
  id, tournament_id, team_id null, user_id null (si solo),
  display_name, display_tag, logo_media_id (snapshot),
  status (pending|approved|rejected|waitlisted|withdrawn|disqualified),
  seed null, rejection_reason, waitlist_position null,
  rulebook_version_id (aceptada), registered_by, approved_by, approved_at,
  payment_id null, check_eligibility_result (jsonb)
  CHECK (team_id IS NOT NULL OR user_id IS NOT NULL)
  UNIQUE (tournament_id, team_id) WHERE status NOT IN ('withdrawn','rejected')

entrant_roster_members
  id, entrant_id, user_id, riot_account_id, roster_role (starter|substitute|coach),
  game_role null, exclusivity_key (texto calculado: 'season:<id>',
  'circuit:<id>', 'tournament:<id>' o null), added_at, removed_at null
  UNIQUE (user_id, exclusivity_key) WHERE removed_at IS NULL
                                    AND exclusivity_key IS NOT NULL
  ← este índice parcial es el ANTI-CHAPULINEO garantizado por la base de datos

roster_change_requests
  id, entrant_id, action (add|remove|swap), user_id, replaces_user_id null,
  reason, status, requested_by, decided_by, decided_at
```

### 6.3 Fases, grupos y bracket
```
phases
  id, tournament_id, name, position,
  format (round_robin|double_round_robin|groups|single_elimination|
          double_elimination|swiss|gauntlet),
  series_format (bo1|bo3|bo5), final_series_format null,
  draft_mode (standard|fearless),
  points_config (jsonb: win, loss, draw, bonus), tiebreakers (jsonb: lista
  ordenada), advancement (jsonb: cuántos avanzan, a qué fase, seeding),
  format_config (jsonb: rondas suizas, tamaño de grupos, third_place_match…),
  status (pending|in_progress|completed), starts_at, schema_version

groups
  id, phase_id, name, position

phase_entrants
  phase_id, group_id null, entrant_id, seed, status (active|eliminated|advanced)

matches                    (serie)
  id, organization_id, tournament_id, phase_id, group_id null,
  round, position, bracket_side (upper|lower|final|null),
  entrant_a_id null, entrant_b_id null (null = por definir),
  source_a (jsonb: {from_match_id, outcome: winner|loser} | {seed}),
  source_b (jsonb),
  next_match_winner_id null, next_match_winner_slot (a|b),
  next_match_loser_id null, next_match_loser_slot (a|b),
  series_format, draft_mode,
  scheduled_at, original_scheduled_at, checkin_opens_at, checkin_closes_at,
  status (pending|scheduled|checkin|ready|live|awaiting_result|
          disputed|completed|forfeit|canceled),
  score_a, score_b, winner_entrant_id null, result_source
  (riot_callback|dual_report|referee|admin_override), finalized_at,
  is_broadcast, stream_session_id null, version (optimistic lock)

schedule_windows           (horarios permitidos; parametrizables por torneo o fase)
  id, tournament_id, phase_id null, weekday (0–6), start_time, end_time,
  timezone, slot_minutes (duración estimada por serie), parallel_matches
  (cuántas series a la vez), priority
schedule_blackouts         (fechas sin partidos: festivos, eventos)
  id, tournament_id, starts_at, ends_at, reason
  → el generador de fixtures asigna series a estos slots; las
    reprogramaciones solo pueden caer dentro de ventanas permitidas

match_broadcast_settings
  match_id, official_broadcast (bool), costream_allowed (bool),
  costream_delay_seconds, assigned_casters (array), priority (featured|normal)

costream_registrations     (creadores que transmiten una partida)
  id, match_id, creator_user_id, stream_channel_id, status
  (requested|approved|live|ended), overlay_token_hash, started_at, ended_at,
  peak_viewers

match_officials
  match_id, user_id, role (referee|observer|caster|producer)

match_checkins
  id, match_id, entrant_id, user_id null, checked_in_at, method (web|discord)

reschedule_requests
  id, match_id, requested_by_entrant_id, proposed_at (array de opciones),
  status (pending|accepted|rejected|approved_by_admin|expired), decided_by
```

### 6.4 Partidas individuales, draft y resultados
```
games
  id, match_id, game_number, status (pending|lobby|live|completed|remade|forfeit),
  blue_entrant_id, red_entrant_id, winner_entrant_id null,
  started_at, ended_at, duration_seconds,
  riot_match_id null, riot_game_id null, patch, raw_match_payload (jsonb),
  raw_timeline_payload (jsonb, opcional/en storage), result_source
  UNIQUE (match_id, game_number)

riot_tournament_codes
  id, game_id, code (único), riot_tournament_id, allowed_puuids (array),
  team_size, map, pick_type, spectator_type, metadata, generated_at,
  used_at null, status (active|used|revoked)

game_participants
  id, game_id, entrant_id, user_id null, riot_account_id null, puuid,
  side (blue|red), game_role, champion_id, is_expected (estaba en el roster)

draft_actions              (picks y bans; base de Fearless y overlays)
  id, game_id, entrant_id, action (pick|ban), champion_id, sequence, side

fearless_locks             (vista o tabla derivada)
  match_id, entrant_id, champion_id, locked_by_game_id

result_reports             (doble reporte)
  id, match_id, game_id null, reported_by_entrant_id, reported_by_user_id,
  winner_entrant_id, score_a, score_b, evidence_media_ids (array), submitted_at

disputes
  id, match_id, game_id null, opened_by_user_id, opened_by_entrant_id,
  category (result|conduct|technical|eligibility|other), description,
  status (open|under_review|resolved|rejected), assigned_to,
  resolution, resolved_by, resolved_at
dispute_evidence
  dispute_id, media_id null, url null, note, added_by

standings                  (recalculado por el core, nunca editado a mano)
  phase_id, group_id null, entrant_id, rank, points, played, wins, losses,
  draws, game_wins, game_losses, game_diff, tiebreak_details (jsonb),
  status (qualified|eliminated|in_contention), updated_at
standing_overrides         (excepcional, auditado)
  phase_id, entrant_id, field, value, reason, created_by
```

---

## 7. Integridad y sanciones

```
integrity_alerts
  id, organization_id, type (roster_mismatch|smurf_suspected|rank_violation|
       riot_id_changed|duplicate_identity|other),
  severity, subject_type (user|team|entrant|game), subject_id,
  evidence (jsonb), risk_score null, status (open|dismissed|actioned),
  reviewed_by, reviewed_at, notes

sanctions
  id, organization_id, subject_type (user|team), subject_id,
  type (warning|game_loss|match_loss|points_deduction|disqualification|
        suspension|ban),
  scope (organization|tournament|circuit|season), scope_id null,
  reason, rulebook_reference, starts_at, ends_at null (null = permanente),
  related_match_id null, related_dispute_id null, issued_by, revoked_at
sanction_appeals
  id, sanction_id, submitted_by, message, status, decided_by, decision_note

user_reports               (reportes de usuarios: fotos, nombres, conducta)
  id, reporter_user_id, subject_type, subject_id, reason, details,
  status, handled_by
moderation_queue
  id, organization_id, subject_type (media|team_name|bio|…), subject_id,
  source (auto|report|new_content), ai_labels (jsonb), status
  (pending|approved|rejected), reviewed_by
```

---

## 8. Estadísticas, logros y seguimiento

```
player_game_stats          (derivado de raw_match_payload)
  game_id, user_id null, puuid, entrant_id, champion_id, game_role,
  kills, deaths, assists, kda, cs, cs_per_min, gold, gold_per_min,
  damage_to_champions, damage_share, damage_taken, vision_score,
  wards_placed, wards_killed, kill_participation, first_blood,
  objectives (jsonb), items (jsonb), runes (jsonb), is_mvp
team_game_stats
  game_id, entrant_id, side, kills, gold, towers, dragons, barons, heralds,
  grubs, inhibitors, first_objectives (jsonb), bans (array)
game_timeline_events       (selección de eventos notables para narrativa)
  game_id, timestamp_ms, type (baron|dragon|pentakill|ace|steal|…),
  actor_puuid, payload (jsonb)

player_aggregate_stats     (por ámbito: tournament / circuit / season / all_time)
  user_id, scope_type, scope_id null, games, wins, kda, avg_cs_per_min,
  avg_gold_per_min, avg_vision, avg_kp, avg_damage_share,
  radar (jsonb: aggression, vision, farming, teamfight, survival — 0-100),
  updated_at
player_champion_stats
  user_id, scope_type, scope_id, champion_id, games, wins, kda
team_aggregate_stats
  team_id, scope_type, scope_id, games, wins, avg_game_duration, first_blood_rate…
champion_meta_stats        (por torneo: picks, bans, winrate)
  tournament_id, champion_id, picks, bans, wins

achievements
  id, organization_id null, key, name, description, icon_media_id, criteria (jsonb)
user_achievements
  user_id, achievement_id, awarded_at, context (jsonb)
mvp_awards
  scope_type (game|match|week|phase|tournament), scope_id, user_id,
  sponsor_placement_id null

follows
  follower_user_id, followable_type (team|user|tournament|organization),
  followable_id, created_at
```

---

## 9. Notificaciones

```
notification_types         (catálogo: 'registration.approved', 'match.reminder'…)
  key, category, is_critical, default_channels (array), audience
notification_templates
  id, organization_id null, type_key, channel, locale, subject, body,
  variables (array), version
notification_rules         (configuración por org o por torneo)
  id, organization_id, tournament_id null, type_key, enabled, channels,
  offsets (array, ej. ['-24h','-1h']), conditions (jsonb)
user_notification_preferences
  user_id, category, channel, enabled, quiet_hours (jsonb)
notifications              (bandeja in-app)
  id, user_id, type_key, title, body, link, data (jsonb), read_at,
  source_event_id
notification_deliveries
  id, notification_id, channel, status (queued|sent|delivered|failed),
  provider_message_id, attempts, last_error, sent_at
  UNIQUE (source_event_id, user_id, channel)   ← idempotencia
  (m06: también es la cola por canal: source_event_id, user_id, subject/body
  ya renderizados, next_attempt_at, locked_until; la dirección de correo se
  busca al enviar, nunca se guarda)
push_subscriptions
  id, user_id, platform (web|ios|android), endpoint/token, keys (jsonb),
  last_used_at
```

---

## 10. Media, contenido e IA

```
media_assets
  id, organization_id, owner_user_id, kind (avatar|cutout|team_logo|banner|
       evidence|graphic|clip|sponsor_logo|other),
  storage_bucket, storage_path, mime_type, width, height, size_bytes,
  derived_from_media_id null, processing_status (pending|ready|failed),
  moderation_status (pending|approved|rejected), alt_text, tags (array)
media_variants
  media_id, variant (thumb|md|lg|webp|avif), storage_path, width, height

graphic_templates
  id, organization_id, key, name, format (1:1|4:5|9:16|16:9), trigger_event
  null, definition (jsonb o referencia a componente), brand_theme_id,
  requires_approval, version
graphic_renders
  id, template_id, source_type, source_id, data (jsonb), media_id,
  status (pending|rendered|approved|published|failed)

news_posts
  id, organization_id, slug, title, excerpt, body, cover_media_id,
  author_user_id, origin (manual|ai), status (draft|review|published),
  related (jsonb: tournament/match/team ids), published_at
ai_generations             (trazabilidad de todo lo generado por IA)
  id, organization_id, kind (match_recap|press_note|caster_script|
       social_copy|smurf_assessment), source_type, source_id,
  provider, model, prompt_version, input_hash, output (text/jsonb),
  status (draft|approved|rejected|published), reviewed_by, cost_tokens
```

---

## 11. Redes sociales y transmisión

```
social_accounts
  id, organization_id, platform (x|instagram|facebook|tiktok|youtube|discord|…),
  handle, external_id, connection_provider (direct|unified_api),
  credentials_ref (referencia al vault, nunca tokens en claro),
  status, connected_by, expires_at
social_posts
  id, organization_id, origin (manual|automatic), trigger_event null,
  base_text, media_ids (array), scheduled_at null,
  status (draft|pending_approval|scheduled|publishing|published|partial|failed),
  approved_by
social_post_targets
  id, social_post_id, social_account_id, text_override, status,
  external_post_id, url, error, published_at, metrics (jsonb)

stream_channels
  id, organization_id, platform (twitch|youtube|kick), channel_id, url, is_primary
stream_sessions
  id, stream_channel_id, started_at, ended_at, title, peak_viewers,
  avg_viewers, vod_url, tournament_id null

overlay_themes
  id, organization_id, brand_theme_id, name, config (jsonb), version
overlay_scenes
  id, organization_id, key (starting|waiting|break|draft|ingame|mvp|result|
       upcoming), overlay_theme_id, config (jsonb)
broadcast_sessions         (sesión de producción ligada a una partida)
  id, match_id, producer_user_id, overlay_theme_id, state (jsonb: qué está
  visible), started_at, ended_at
observer_agents
  id, organization_id, name, machine_label, token_hash, last_heartbeat_at,
  version, status
live_match_state           (estado en vivo; se emite por Realtime)
  match_id, game_id, phase (champ_select|in_game|post_game), state (jsonb),
  source (observer_agent|manual), updated_at
```

---

## 12. Integraciones y eventos

```
discord_guilds
  id, organization_id, guild_id, installed_by, settings (jsonb)
discord_channel_links
  guild_id, purpose (announcements|results|staff|match_voice_category|…),
  channel_id, tournament_id null
discord_temp_channels
  match_id, entrant_id, channel_id, created_at, deleted_at

riot_providers
  id, organization_id, region, riot_provider_id, callback_url
riot_tournaments
  id, tournament_id, riot_provider_id, riot_tournament_id, name

inbound_webhooks           (todo lo que llega: Riot callbacks, Twitch, Stripe)
  id, source, event_type, payload (jsonb), signature_valid, received_at,
  processed_at, status, error, idempotency_key (único)

outbox_events              (eventos de dominio: patrón outbox transaccional)
  id, organization_id, aggregate_type, aggregate_id, event_type, payload,
  occurred_at, published_at null, attempts
  (m06: next_attempt_at, locked_until, last_error, dead_at para el consumidor:
  backoff, lease entre instancias y dead letter)

jobs                       (gestionada por pg-boss en su propio schema; aquí
                            solo como referencia de lo que se monitorea)
  id, queue, name, payload, status, run_at, attempts, last_error

external_api_calls         (observabilidad de llamadas a Riot/redes)
  provider, endpoint, status_code, duration_ms, rate_limit_remaining, at
```

---

## 13. Monetización (fase 4, siempre al final)

```
sponsors
  id, organization_id, name, logo_media_id, website, category,
  is_prohibited_category (validación Riot), contact (jsonb), status
sponsor_contracts
  id, sponsor_id, starts_at, ends_at, amount, currency, deliverables (jsonb)
sponsor_placements
  id, sponsor_id, placement_type (mvp|overlay|graphic|stream|page_section|
       tournament_title), scope_type, scope_id, starts_at, ends_at
sponsor_impressions        (para reportes del media kit)
  placement_id, channel, count, period

fees
  id, tournament_id, amount, currency, per (entrant|player), refundable_until
payments
  id, organization_id, payer_user_id, provider (stripe|…), provider_ref,
  amount, currency, status, purpose (registration|season_pass|merch|…),
  related_type, related_id
refunds
  payment_id, amount, reason, status, provider_ref
prize_payouts              (premios en efectivo; disponible desde el piloto)
  id, tournament_prize_id, entrant_id, recipient_user_id, amount, currency,
  status, method, provider_ref, paid_at, tax_info_ref, guardian_consent_ref

staff_compensation_rules   (solo owner/super admin)
  id, organization_id, staff_role, model (volunteer|per_event|per_match|
  per_deliverable|fixed), amount null, currency, notes
staff_assignments_payable
  id, user_id, organization_id, source_type (match|tournament|
  content_request|stream), source_id, staff_role, amount, currency,
  status (pending|approved|paid|canceled), approved_by
staff_payouts
  id, user_id, period, total_amount, currency, method, status, paid_at,
  provider_ref, items (array de staff_assignments_payable)
saas_subscriptions
  organization_id, plan, status, provider_ref, current_period_end
```

---

## 14. Auditoría (transversal)

```
audit_logs                 (append-only; sin UPDATE ni DELETE por RLS)
  id, organization_id null, actor_user_id null, actor_type (user|system|
  agent), action ('match.result.override'), entity_type, entity_id,
  before (jsonb), after (jsonb), reason, ip, user_agent, correlation_id,
  created_at
```

---

## 15. Reglas de integridad garantizadas por la base de datos

| Regla | Mecanismo |
|-------|-----------|
| Una cuenta Riot por usuario | `UNIQUE (puuid) WHERE unlinked_at IS NULL` |
| Anti-chapulineo (un roster por ámbito) | `UNIQUE (user_id, exclusivity_key)` parcial en `entrant_roster_members` |
| Un equipo no se inscribe dos veces al mismo torneo | `UNIQUE (tournament_id, team_id)` parcial |
| Partida única por número en una serie | `UNIQUE (match_id, game_number)` |
| Ganador debe ser uno de los participantes | `CHECK` en `matches` y `games` |
| No notificaciones duplicadas | `UNIQUE (source_event_id, user_id, channel)` |
| Webhooks procesados una sola vez | `UNIQUE (idempotency_key)` |
| Ediciones concurrentes de partidas | Bloqueo optimista (`version`) |
| Auditoría inmutable | RLS sin permisos de UPDATE/DELETE |
| Aislamiento entre organizaciones | RLS por `organization_id` |

Reglas que valida el **dominio** (no la base de datos): elegibilidad, tier
máximo, peak rank, ventanas de transferencia, transiciones de estado, Fearless,
cálculo de standings y avance de fase.

---

## 16. Índices y rendimiento (iniciales)

- `matches (tournament_id, status, scheduled_at)` — calendarios y paneles.
- `matches (entrant_a_id)`, `matches (entrant_b_id)` — partidas de un equipo.
- `entrant_roster_members (user_id) WHERE removed_at IS NULL`.
- `player_game_stats (user_id, game_id)`.
- `notifications (user_id, read_at)`.
- `outbox_events (published_at) WHERE published_at IS NULL`.
- Búsqueda de usuarios y equipos: `pg_trgm` sobre `username` y `name`.
- `raw_timeline_payload` grande → mover a Storage si crece.
