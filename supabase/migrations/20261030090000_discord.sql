-- Module 07: Discord bot (docs/03 §12, docs/specs/m07). The platform's Discord
-- presence: the installed guild and its settings, the channel each purpose maps
-- to, the temporary voice channels of a match, and the link between a platform
-- user and their Discord id (for users who did not sign in with Discord).
-- Everything is written by the API with the secret key; the admin console reads
-- the guild config through the API, the bot process reads nothing directly.

create type public.discord_channel_purpose as enum (
  'announcements', 'results', 'staff', 'match_voice_category'
);

-- ---------------------------------------------------------------------------
-- The installed guild (one per organization for now) and its toggles.
-- settings: { features: { checkin, voiceChannels, autoRoles, staffAlerts,
--   results }, roles: { verified, byTournament: {<id>: roleId} } }
-- ---------------------------------------------------------------------------
create table public.discord_guilds (
  id uuid primary key default private.uuid_v7(),
  organization_id uuid not null references public.organizations (id),
  guild_id text not null check (guild_id ~ '^[0-9]{5,25}$'),
  name text check (char_length(name) <= 120),
  installed_by uuid references public.users (id),
  settings jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id),
  unique (guild_id)
);
create trigger discord_guilds_set_updated_at before update on public.discord_guilds
  for each row execute function private.set_updated_at();

create table public.discord_channel_links (
  id uuid primary key default private.uuid_v7(),
  guild_id uuid not null references public.discord_guilds (id) on delete cascade,
  purpose public.discord_channel_purpose not null,
  channel_id text not null check (channel_id ~ '^[0-9]{5,25}$'),
  -- A purpose can be scoped to a tournament (its own announcements channel).
  tournament_id uuid references public.tournaments (id),
  created_at timestamptz not null default now(),
  unique nulls not distinct (guild_id, purpose, tournament_id)
);
create index discord_channel_links_guild_idx on public.discord_channel_links (guild_id);

create table public.discord_temp_channels (
  id uuid primary key default private.uuid_v7(),
  guild_id uuid not null references public.discord_guilds (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  entrant_id uuid references public.entrants (id),
  channel_id text not null check (char_length(channel_id) between 5 and 25),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (match_id, entrant_id)
);
create index discord_temp_channels_open_idx on public.discord_temp_channels (match_id)
  where deleted_at is null;

-- Discord id of a platform user. Users who signed in with Discord already have
-- it in auth.identities; this stores the manual link from /vincular for the
-- rest, and is the one the directory reads (falling back to the identity).
create table public.user_discord_links (
  user_id uuid primary key references public.users (id),
  discord_user_id text not null unique check (discord_user_id ~ '^[0-9]{5,25}$'),
  discord_username text check (char_length(discord_username) <= 60),
  linked_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.discord_guilds enable row level security;
alter table public.discord_channel_links enable row level security;
alter table public.discord_temp_channels enable row level security;
alter table public.user_discord_links enable row level security;

-- Guild config and channel links are staff-only reads (the admin console goes
-- through the API, but a super admin may read directly). No client writes.
create policy "discord_guilds: super admin" on public.discord_guilds
  for select to authenticated using ((select private.is_super_admin()));
create policy "discord_channel_links: super admin" on public.discord_channel_links
  for select to authenticated using ((select private.is_super_admin()));
-- Each user sees their own Discord link (to show "linked" in settings).
create policy "user_discord_links: owner" on public.user_discord_links
  for select to authenticated using (user_id = (select auth.uid()));
-- discord_temp_channels: no policy, no client grant (bookkeeping, API only).

grant select on public.discord_guilds, public.discord_channel_links to authenticated;
grant select on public.user_discord_links to authenticated;
grant select, insert, update, delete on
  public.discord_guilds, public.discord_channel_links, public.discord_temp_channels,
  public.user_discord_links
  to service_role;

-- ---------------------------------------------------------------------------
-- Service functions (secret key only)
-- ---------------------------------------------------------------------------

-- Connects (or updates) the guild and its settings. Audited.
create function public.svc_save_discord_guild(
  p_organization_id uuid, p_actor uuid, p_guild_id text, p_name text, p_settings jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_before jsonb;
begin
  select to_jsonb(g) into v_before from public.discord_guilds g where organization_id = p_organization_id;
  insert into public.discord_guilds (organization_id, guild_id, name, installed_by, settings)
  values (p_organization_id, p_guild_id, p_name, p_actor, coalesce(p_settings, '{}'))
  on conflict (organization_id) do update set
    guild_id = excluded.guild_id, name = excluded.name,
    settings = excluded.settings, is_active = true
  returning id into v_id;
  perform private.write_audit(p_organization_id, p_actor, 'discord.guild.saved', 'discord_guild', v_id,
    v_before, jsonb_build_object('guild_id', p_guild_id, 'settings', coalesce(p_settings, '{}')), null);
  return v_id;
end;
$$;

-- Points a purpose at a channel (null channel clears it). Audited.
create function public.svc_set_discord_channel(
  p_organization_id uuid, p_actor uuid, p_purpose public.discord_channel_purpose,
  p_channel_id text, p_tournament_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_guild uuid;
begin
  select id into v_guild from public.discord_guilds where organization_id = p_organization_id;
  if not found then
    raise exception 'discord_guild_not_connected' using errcode = 'P0001';
  end if;
  delete from public.discord_channel_links
  where guild_id = v_guild and purpose = p_purpose and tournament_id is not distinct from p_tournament_id;
  if p_channel_id is not null then
    insert into public.discord_channel_links (guild_id, purpose, channel_id, tournament_id)
    values (v_guild, p_purpose, p_channel_id, p_tournament_id);
  end if;
  perform private.write_audit(p_organization_id, p_actor, 'discord.channel.set', 'discord_guild', v_guild,
    null, jsonb_build_object('purpose', p_purpose, 'channel_id', p_channel_id, 'tournament_id', p_tournament_id), null);
end;
$$;

-- Records a temporary voice channel of a match (idempotent per match+entrant).
create function public.svc_record_temp_channel(
  p_guild_id uuid, p_match_id uuid, p_entrant_id uuid, p_channel_id text
)
returns void
language sql
set search_path = ''
as $$
  insert into public.discord_temp_channels (guild_id, match_id, entrant_id, channel_id)
  values (p_guild_id, p_match_id, p_entrant_id, p_channel_id)
  on conflict (match_id, entrant_id) do update set channel_id = excluded.channel_id, deleted_at = null;
$$;

-- Marks the temp channels of a match deleted; returns the channel ids to remove.
create function public.svc_close_temp_channels(p_match_id uuid)
returns setof text
language sql
set search_path = ''
as $$
  update public.discord_temp_channels set deleted_at = now()
  where match_id = p_match_id and deleted_at is null
  returning channel_id;
$$;

-- Links a platform user to a Discord id (the /vincular fallback). Idempotent.
create function public.svc_link_discord_user(
  p_user_id uuid, p_discord_user_id text, p_discord_username text
)
returns void
language sql
set search_path = ''
as $$
  insert into public.user_discord_links (user_id, discord_user_id, discord_username)
  values (p_user_id, p_discord_user_id, p_discord_username)
  on conflict (user_id) do update set
    discord_user_id = excluded.discord_user_id,
    discord_username = excluded.discord_username,
    linked_at = now();
$$;

revoke execute on function
  public.svc_save_discord_guild(uuid, uuid, text, text, jsonb),
  public.svc_set_discord_channel(uuid, uuid, public.discord_channel_purpose, text, uuid),
  public.svc_record_temp_channel(uuid, uuid, uuid, text),
  public.svc_close_temp_channels(uuid),
  public.svc_link_discord_user(uuid, text, text)
from public, anon, authenticated;
grant execute on function
  public.svc_save_discord_guild(uuid, uuid, text, text, jsonb),
  public.svc_set_discord_channel(uuid, uuid, public.discord_channel_purpose, text, uuid),
  public.svc_record_temp_channel(uuid, uuid, uuid, text),
  public.svc_close_temp_channels(uuid),
  public.svc_link_discord_user(uuid, text, text)
to service_role;
