-- Module 06: notification engine (docs/03 §9, docs/15). The API consumes
-- outbox_events, resolves recipients, rules and preferences, renders the
-- templates and writes one in-app notification plus one delivery per channel.
-- notification_deliveries is also the per-channel send queue (retries with
-- backoff); everything is written by the API with the secret key.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.notification_channel as enum ('in_app', 'email', 'discord', 'push');
create type public.notification_category as enum (
  'tournaments', 'matches', 'team', 'staff', 'announcements', 'marketing'
);
create type public.notification_delivery_status as enum ('queued', 'sent', 'delivered', 'failed');
create type public.push_platform as enum ('web', 'ios', 'android');

-- ---------------------------------------------------------------------------
-- Outbox consumer bookkeeping: retries with backoff, a lease so two API
-- instances never take the same event, and a dead letter after N failures.
-- ---------------------------------------------------------------------------
alter table public.outbox_events
  add column next_attempt_at timestamptz,
  add column locked_until timestamptz,
  add column last_error text check (char_length(last_error) <= 500),
  add column dead_at timestamptz;

drop index public.outbox_events_unpublished_idx;
create index outbox_events_unpublished_idx on public.outbox_events (occurred_at)
  where published_at is null and dead_at is null;

-- ---------------------------------------------------------------------------
-- Catalog, templates and rules
-- ---------------------------------------------------------------------------
create table public.notification_types (
  key text primary key check (key ~ '^[a-z_]+(\.[a-z_]+)+$'),
  category public.notification_category not null,
  -- Critical ones (match code, forfeit, sanction) cannot be turned off, only moved to another channel.
  is_critical boolean not null default false,
  default_channels public.notification_channel[] not null,
  -- Who receives it: entrant | match_parties | tournament_entrants | tournament_staff | opted_in.
  audience text not null check (audience in ('entrant', 'match_parties', 'tournament_entrants', 'tournament_staff', 'opted_in')),
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

-- organization_id null = the platform's base template; an organization row overrides it.
create table public.notification_templates (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid references public.organizations (id),
  type_key text not null references public.notification_types (key),
  channel public.notification_channel not null,
  locale text not null default 'es-419' check (locale ~ '^[a-z]{2}(-[A-Za-z0-9]{2,3})?$'),
  subject text check (char_length(subject) <= 200),
  body text not null check (char_length(body) between 1 and 4000),
  variables text[] not null default '{}',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id),
  unique nulls not distinct (organization_id, type_key, channel, locale)
);

-- tournament_id null = the organization-wide rule; a tournament row overrides it.
create table public.notification_rules (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid not null references public.organizations (id),
  tournament_id uuid references public.tournaments (id),
  type_key text not null references public.notification_types (key),
  enabled boolean not null default true,
  -- null = the type's default channels.
  channels public.notification_channel[],
  -- Reminder offsets such as '-24h', '-1h' (used by the reminder jobs).
  offsets text[] not null default '{}',
  conditions jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id),
  unique nulls not distinct (organization_id, tournament_id, type_key)
);

create table public.user_notification_preferences (
  user_id uuid not null references public.users (id),
  category public.notification_category not null,
  channel public.notification_channel not null,
  enabled boolean not null,
  quiet_hours jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, category, channel)
);

-- ---------------------------------------------------------------------------
-- In-app inbox and deliveries
-- ---------------------------------------------------------------------------
-- source_event_id is the outbox event (no FK: the outbox can be pruned, the
-- inbox is history). One notification per user and event.
create table public.notifications (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid references public.organizations (id),
  user_id uuid not null references public.users (id),
  type_key text not null references public.notification_types (key),
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) <= 4000),
  link text check (link ~ '^/'),
  data jsonb not null default '{}',
  read_at timestamptz,
  source_event_id uuid not null,
  created_at timestamptz not null default now(),
  unique (source_event_id, user_id)
);
create index notifications_user_idx on public.notifications (user_id, id desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.notification_deliveries (
  id uuid primary key default private.uuid_v7(),
  notification_id uuid not null references public.notifications (id),
  source_event_id uuid not null,
  user_id uuid not null references public.users (id),
  channel public.notification_channel not null,
  status public.notification_delivery_status not null default 'queued',
  -- Rendered for this channel; recipients' addresses are looked up when sending, never stored.
  subject text check (char_length(subject) <= 200),
  body text not null check (char_length(body) <= 4000),
  provider_message_id text,
  attempts integer not null default 0,
  last_error text check (char_length(last_error) <= 500),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_event_id, user_id, channel)
);
create index notification_deliveries_due_idx on public.notification_deliveries (next_attempt_at)
  where status = 'queued';
create index notification_deliveries_recent_idx on public.notification_deliveries (id desc);
create index notification_deliveries_notification_idx on public.notification_deliveries (notification_id);

-- Structure only: web push and native push arrive in later modules.
create table public.push_subscriptions (
  id uuid primary key default private.uuid_v7(),
  user_id uuid not null references public.users (id),
  platform public.push_platform not null,
  endpoint text not null check (char_length(endpoint) <= 2000),
  keys jsonb not null default '{}',
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create trigger notification_templates_set_updated_at before update on public.notification_templates
  for each row execute function private.set_updated_at();
create trigger notification_rules_set_updated_at before update on public.notification_rules
  for each row execute function private.set_updated_at();
create trigger user_notification_preferences_set_updated_at before update on public.user_notification_preferences
  for each row execute function private.set_updated_at();
create trigger notification_deliveries_set_updated_at before update on public.notification_deliveries
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: each user reads only their own inbox and preferences.
-- ---------------------------------------------------------------------------
alter table public.notification_types enable row level security;
alter table public.notification_templates enable row level security;
alter table public.notification_rules enable row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "notification_types: signed-in users" on public.notification_types
  for select to authenticated using (true);
create policy "user_notification_preferences: own" on public.user_notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notification_deliveries: own; super admin" on public.notification_deliveries
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "push_subscriptions: own" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
-- notification_templates and notification_rules: no policy and no client grant (the API serves them).

grant select on
  public.notification_types, public.user_notification_preferences, public.notifications,
  public.notification_deliveries, public.push_subscriptions
  to authenticated;
grant select, insert, update, delete on
  public.notification_types, public.notification_templates, public.notification_rules,
  public.user_notification_preferences, public.notifications, public.notification_deliveries,
  public.push_subscriptions
  to service_role;

-- The bell updates live (Realtime applies the select policy above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Service functions (secret key only)
-- ---------------------------------------------------------------------------

-- Takes up to p_limit events that are due and leases them for p_lease_seconds.
create function public.svc_claim_outbox_events(p_limit integer, p_lease_seconds integer)
returns setof public.outbox_events
language sql
set search_path = ''
as $$
  update public.outbox_events o set locked_until = now() + make_interval(secs => p_lease_seconds)
  where o.id in (
    select id from public.outbox_events
    where published_at is null and dead_at is null
      and (next_attempt_at is null or next_attempt_at <= now())
      and (locked_until is null or locked_until < now())
    order by occurred_at
    limit p_limit
    for update skip locked
  )
  returning o.*;
$$;

-- Writes the notifications of one event and marks it published, atomically.
-- Idempotent: an event processed twice adds nothing (unique keys).
-- p_items: [{ user_id, type_key, title, body, link, data,
--             deliveries: [{ channel, subject, body }] }]
create function public.svc_enqueue_notifications(p_event_id uuid, p_items jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_event public.outbox_events;
  v_item jsonb;
  v_delivery jsonb;
  v_notification_id uuid;
  v_created integer := 0;
begin
  select * into v_event from public.outbox_events where id = p_event_id for update;
  if not found then
    raise exception 'event_not_found' using errcode = 'P0001';
  end if;
  if v_event.published_at is not null then
    return 0;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    insert into public.notifications (organization_id, user_id, type_key, title, body, link, data, source_event_id)
    values (v_event.organization_id, (v_item ->> 'user_id')::uuid, v_item ->> 'type_key', v_item ->> 'title',
      v_item ->> 'body', v_item ->> 'link', coalesce(v_item -> 'data', '{}'), p_event_id)
    on conflict (source_event_id, user_id) do nothing
    returning id into v_notification_id;
    if v_notification_id is null then
      continue;
    end if;
    v_created := v_created + 1;

    for v_delivery in select * from jsonb_array_elements(coalesce(v_item -> 'deliveries', '[]')) loop
      insert into public.notification_deliveries (
        notification_id, source_event_id, user_id, channel, status, subject, body, sent_at
      )
      values (
        v_notification_id, p_event_id, (v_item ->> 'user_id')::uuid,
        (v_delivery ->> 'channel')::public.notification_channel,
        -- The inbox row is the in-app delivery itself.
        case when v_delivery ->> 'channel' = 'in_app' then 'delivered' else 'queued' end::public.notification_delivery_status,
        v_delivery ->> 'subject', v_delivery ->> 'body',
        case when v_delivery ->> 'channel' = 'in_app' then now() end
      )
      on conflict (source_event_id, user_id, channel) do nothing;
    end loop;
  end loop;

  update public.outbox_events
  set published_at = now(), locked_until = null, last_error = null
  where id = p_event_id;
  return v_created;
end;
$$;

-- Records a failed attempt: retried at p_next_attempt_at, or dead-lettered.
create function public.svc_fail_outbox_event(
  p_event_id uuid, p_error text, p_next_attempt_at timestamptz, p_dead boolean
)
returns void
language sql
set search_path = ''
as $$
  update public.outbox_events set
    attempts = attempts + 1,
    last_error = left(p_error, 500),
    next_attempt_at = p_next_attempt_at,
    locked_until = null,
    dead_at = case when p_dead then now() end
  where id = p_event_id;
$$;

-- Takes up to p_limit queued deliveries that are due and leases them.
create function public.svc_claim_deliveries(p_limit integer, p_lease_seconds integer)
returns setof public.notification_deliveries
language sql
set search_path = ''
as $$
  update public.notification_deliveries d set locked_until = now() + make_interval(secs => p_lease_seconds)
  where d.id in (
    select id from public.notification_deliveries
    where status = 'queued' and next_attempt_at <= now()
      and (locked_until is null or locked_until < now())
    order by next_attempt_at
    limit p_limit
    for update skip locked
  )
  returning d.*;
$$;

-- Template edits and rules are audited with the change (docs/17).
create function public.svc_save_notification_template(
  p_organization_id uuid, p_actor uuid, p_type_key text, p_channel public.notification_channel,
  p_locale text, p_subject text, p_body text, p_variables text[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_before public.notification_templates;
  v_id uuid;
begin
  select * into v_before from public.notification_templates
  where organization_id = p_organization_id and type_key = p_type_key and channel = p_channel and locale = p_locale
  for update;
  insert into public.notification_templates (organization_id, type_key, channel, locale, subject, body, variables, updated_by)
  values (p_organization_id, p_type_key, p_channel, p_locale, p_subject, p_body, p_variables, p_actor)
  on conflict (organization_id, type_key, channel, locale) do update set
    subject = excluded.subject, body = excluded.body, variables = excluded.variables,
    version = public.notification_templates.version + 1, updated_by = excluded.updated_by
  returning id into v_id;
  perform private.write_audit(p_organization_id, p_actor, 'notification_template.updated', 'notification_template', v_id,
    case when v_before.id is null then null
      else jsonb_build_object('subject', v_before.subject, 'body', v_before.body, 'version', v_before.version) end,
    jsonb_build_object('type_key', p_type_key, 'channel', p_channel, 'locale', p_locale,
      'subject', p_subject, 'body', p_body),
    null);
end;
$$;

-- Removes the organization's override: the base template applies again.
create function public.svc_reset_notification_template(
  p_organization_id uuid, p_actor uuid, p_type_key text, p_channel public.notification_channel, p_locale text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_before public.notification_templates;
begin
  delete from public.notification_templates
  where organization_id = p_organization_id and type_key = p_type_key and channel = p_channel and locale = p_locale
  returning * into v_before;
  if v_before.id is null then
    return;
  end if;
  perform private.write_audit(p_organization_id, p_actor, 'notification_template.reset', 'notification_template',
    v_before.id, jsonb_build_object('subject', v_before.subject, 'body', v_before.body, 'version', v_before.version),
    null, null);
end;
$$;

create function public.svc_save_notification_rule(
  p_organization_id uuid, p_actor uuid, p_type_key text, p_enabled boolean,
  p_channels public.notification_channel[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_before public.notification_rules;
  v_id uuid;
begin
  select * into v_before from public.notification_rules
  where organization_id = p_organization_id and tournament_id is null and type_key = p_type_key
  for update;
  insert into public.notification_rules (organization_id, type_key, enabled, channels, updated_by)
  values (p_organization_id, p_type_key, p_enabled, p_channels, p_actor)
  on conflict (organization_id, tournament_id, type_key) do update set
    enabled = excluded.enabled, channels = excluded.channels, updated_by = excluded.updated_by
  returning id into v_id;
  perform private.write_audit(p_organization_id, p_actor, 'notification_rule.updated', 'notification_rule', v_id,
    case when v_before.id is null then null
      else jsonb_build_object('enabled', v_before.enabled, 'channels', v_before.channels) end,
    jsonb_build_object('type_key', p_type_key, 'enabled', p_enabled, 'channels', p_channels),
    null);
end;
$$;

revoke execute on function
  public.svc_claim_outbox_events(integer, integer),
  public.svc_enqueue_notifications(uuid, jsonb),
  public.svc_fail_outbox_event(uuid, text, timestamptz, boolean),
  public.svc_claim_deliveries(integer, integer),
  public.svc_save_notification_template(uuid, uuid, text, public.notification_channel, text, text, text, text[]),
  public.svc_reset_notification_template(uuid, uuid, text, public.notification_channel, text),
  public.svc_save_notification_rule(uuid, uuid, text, boolean, public.notification_channel[])
from public, anon, authenticated;

grant execute on function
  public.svc_claim_outbox_events(integer, integer),
  public.svc_enqueue_notifications(uuid, jsonb),
  public.svc_fail_outbox_event(uuid, text, timestamptz, boolean),
  public.svc_claim_deliveries(integer, integer),
  public.svc_save_notification_template(uuid, uuid, text, public.notification_channel, text, text, text, text[]),
  public.svc_reset_notification_template(uuid, uuid, text, public.notification_channel, text),
  public.svc_save_notification_rule(uuid, uuid, text, boolean, public.notification_channel[])
to service_role;

-- ---------------------------------------------------------------------------
-- Catalog (docs/15 §3): the events the platform already emits.
-- ---------------------------------------------------------------------------
insert into public.notification_types (key, category, is_critical, default_channels, audience, position) values
  ('registration.received', 'tournaments', false, '{in_app,email,discord}', 'entrant', 10),
  ('registration.waitlisted', 'tournaments', false, '{in_app,email}', 'entrant', 11),
  ('registration.approved', 'tournaments', false, '{in_app,email,discord}', 'entrant', 12),
  ('registration.rejected', 'tournaments', false, '{in_app,email,discord}', 'entrant', 13),
  ('registration.promoted', 'tournaments', false, '{in_app,email}', 'entrant', 14),
  ('registration.disqualified', 'tournaments', true, '{in_app,email}', 'entrant', 15),
  ('tournament.rules_changed', 'tournaments', false, '{in_app,email}', 'tournament_entrants', 16),
  ('tournament.schedule_published', 'matches', false, '{in_app,email,discord}', 'tournament_entrants', 20),
  ('match.scheduled', 'matches', false, '{in_app,discord}', 'match_parties', 21),
  ('match.rescheduled', 'matches', false, '{in_app,email,discord}', 'match_parties', 22),
  ('match.checkin_open', 'matches', false, '{in_app,discord,push}', 'match_parties', 23),
  ('match.forfeit', 'matches', true, '{in_app,email,discord}', 'match_parties', 24),
  ('match.result_confirmed', 'matches', false, '{in_app,discord}', 'match_parties', 25),
  ('dispute.opened', 'matches', false, '{in_app,email}', 'match_parties', 26),
  ('dispute.resolved', 'matches', false, '{in_app,email}', 'match_parties', 27),
  ('tournament.published', 'announcements', false, '{in_app,discord}', 'opted_in', 30),
  ('staff.registration_submitted', 'staff', false, '{in_app,discord}', 'tournament_staff', 40),
  ('staff.dispute_opened', 'staff', false, '{in_app,discord}', 'tournament_staff', 41);

-- Base templates in es-419. `variables` lists the {{placeholders}} each one uses.
insert into public.notification_templates (organization_id, type_key, channel, locale, subject, body, variables)
select null, t.type_key, t.channel::public.notification_channel, 'es-419', t.subject, t.body,
  array(
    select distinct m[1]
    from regexp_matches(coalesce(t.subject, '') || ' ' || t.body, '\{\{\s*([a-z_.]+)\s*\}\}', 'g') m
    order by 1
  )
from (values
  ('registration.received', 'in_app', 'Inscripción recibida',
    '{{entrant.name}} quedó inscrito en {{tournament.name}}. El staff revisará la inscripción.'),
  ('registration.received', 'email', 'Recibimos la inscripción de {{entrant.name}}',
    E'Hola, {{user.name}}:\n\nRecibimos la inscripción de {{entrant.name}} en {{tournament.name}}. El staff la revisará y te avisaremos cuando haya una decisión.'),
  ('registration.waitlisted', 'in_app', 'En lista de espera',
    '{{entrant.name}} está en la lista de espera de {{tournament.name}}. Te avisaremos si se libera un lugar.'),
  ('registration.waitlisted', 'email', '{{entrant.name}} está en la lista de espera',
    E'Hola, {{user.name}}:\n\nEl cupo de {{tournament.name}} está lleno, así que {{entrant.name}} quedó en la lista de espera. Te avisaremos si se libera un lugar.'),
  ('registration.approved', 'in_app', 'Inscripción aprobada',
    '{{entrant.name}} ya está dentro de {{tournament.name}}.'),
  ('registration.approved', 'email', '{{entrant.name}} está dentro de {{tournament.name}}',
    E'Hola, {{user.name}}:\n\nEl staff aprobó la inscripción de {{entrant.name}} en {{tournament.name}}. Revisa el reglamento y el calendario para no perderte ninguna partida.'),
  ('registration.rejected', 'in_app', 'Inscripción rechazada',
    'La inscripción de {{entrant.name}} en {{tournament.name}} fue rechazada. Motivo: {{reason}}'),
  ('registration.rejected', 'email', 'La inscripción de {{entrant.name}} fue rechazada',
    E'Hola, {{user.name}}:\n\nEl staff rechazó la inscripción de {{entrant.name}} en {{tournament.name}}.\n\nMotivo: {{reason}}'),
  ('registration.promoted', 'in_app', 'Salieron de la lista de espera',
    'Se liberó un lugar en {{tournament.name}}: la inscripción de {{entrant.name}} pasa a revisión.'),
  ('registration.promoted', 'email', 'Se liberó un lugar en {{tournament.name}}',
    E'Hola, {{user.name}}:\n\nSe liberó un lugar en {{tournament.name}} y la inscripción de {{entrant.name}} salió de la lista de espera. El staff la revisará.'),
  ('registration.disqualified', 'in_app', 'Descalificación',
    '{{entrant.name}} fue descalificado de {{tournament.name}}. Motivo: {{reason}}'),
  ('registration.disqualified', 'email', '{{entrant.name}} fue descalificado de {{tournament.name}}',
    E'Hola, {{user.name}}:\n\nEl staff descalificó a {{entrant.name}} de {{tournament.name}}.\n\nMotivo: {{reason}}'),
  ('tournament.rules_changed', 'in_app', 'Cambió el reglamento',
    'El reglamento de {{tournament.name}} tiene una nueva versión. Revísala antes de tu próxima partida.'),
  ('tournament.rules_changed', 'email', 'Nuevo reglamento de {{tournament.name}}',
    E'Hola, {{user.name}}:\n\nEl reglamento de {{tournament.name}} tiene una nueva versión. Revísala antes de tu próxima partida.'),
  ('tournament.schedule_published', 'in_app', 'Calendario publicado',
    'Ya está el calendario de {{tournament.name}}. Revisa tus partidas.'),
  ('tournament.schedule_published', 'email', 'Calendario de {{tournament.name}}',
    E'Hola, {{user.name}}:\n\nYa está el calendario de {{tournament.name}}. Revisa cuándo juega {{entrant.name}}.'),
  ('match.scheduled', 'in_app', 'Partida programada',
    '{{entrant.name}} vs {{opponent.name}}: {{match.scheduled_at}}.'),
  ('match.rescheduled', 'in_app', 'Partida reprogramada',
    '{{entrant.name}} vs {{opponent.name}} se movió a {{match.scheduled_at}}.'),
  ('match.rescheduled', 'email', 'Partida reprogramada: {{entrant.name}} vs {{opponent.name}}',
    E'Hola, {{user.name}}:\n\nLa partida {{entrant.name}} vs {{opponent.name}} de {{tournament.name}} se movió a {{match.scheduled_at}}.'),
  ('match.checkin_open', 'in_app', 'Check-in abierto',
    'Ya puedes hacer check-in para {{entrant.name}} vs {{opponent.name}} ({{tournament.name}}).'),
  ('match.forfeit', 'in_app', 'Forfeit aplicado',
    'Se aplicó forfeit en {{entrant.name}} vs {{opponent.name}}. Ganador: {{winner.name}}.'),
  ('match.forfeit', 'email', 'Forfeit en {{entrant.name}} vs {{opponent.name}}',
    E'Hola, {{user.name}}:\n\nSe aplicó forfeit en la partida {{entrant.name}} vs {{opponent.name}} de {{tournament.name}}. Ganador: {{winner.name}}.'),
  ('match.result_confirmed', 'in_app', 'Resultado confirmado',
    '{{entrant.name}} vs {{opponent.name}}: ganó {{winner.name}}.'),
  ('dispute.opened', 'in_app', 'Disputa abierta',
    'Se abrió una disputa en {{entrant.name}} vs {{opponent.name}}. El staff la revisará.'),
  ('dispute.opened', 'email', 'Disputa abierta en {{entrant.name}} vs {{opponent.name}}',
    E'Hola, {{user.name}}:\n\nSe abrió una disputa en la partida {{entrant.name}} vs {{opponent.name}} de {{tournament.name}}. El staff la revisará y te avisaremos cuando la resuelva.'),
  ('dispute.resolved', 'in_app', 'Disputa resuelta',
    'El staff resolvió la disputa de {{entrant.name}} vs {{opponent.name}}.'),
  ('dispute.resolved', 'email', 'Disputa resuelta: {{entrant.name}} vs {{opponent.name}}',
    E'Hola, {{user.name}}:\n\nEl staff resolvió la disputa de la partida {{entrant.name}} vs {{opponent.name}} de {{tournament.name}}. Revisa el resultado en la plataforma.'),
  ('tournament.published', 'in_app', 'Nuevo torneo: {{tournament.name}}',
    'Ya puedes ver los detalles y el reglamento de {{tournament.name}}.'),
  ('tournament.published', 'email', 'Nuevo torneo: {{tournament.name}}',
    E'Hola, {{user.name}}:\n\nSe publicó {{tournament.name}}. Revisa los detalles y el reglamento antes de que abran las inscripciones.'),
  ('staff.registration_submitted', 'in_app', 'Nueva inscripción',
    '{{entrant.name}} se inscribió en {{tournament.name}}.'),
  ('staff.dispute_opened', 'in_app', 'Disputa por revisar',
    'Hay una disputa en {{tournament.name}}: {{entrant.name}} vs {{opponent.name}}.')
) as t (type_key, channel, subject, body);
