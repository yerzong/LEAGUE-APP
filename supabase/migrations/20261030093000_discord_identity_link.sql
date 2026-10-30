-- Module 07: make the Discord id of users who sign in with Discord available
-- to the bot without a scan. Supabase Auth stores it in auth.identities
-- (provider 'discord', provider_id = the Discord user id); this trigger mirrors
-- it into public.user_discord_links so a single indexed table maps both ways.
-- Users who signed in before this runs are backfilled once.

create function private.sync_discord_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider = 'discord' and new.provider_id ~ '^[0-9]{5,25}$' then
    insert into public.user_discord_links (user_id, discord_user_id, discord_username)
    values (new.user_id, new.provider_id, new.identity_data ->> 'full_name')
    on conflict (user_id) do update set
      discord_user_id = excluded.discord_user_id, linked_at = now();
  end if;
  return new;
end;
$$;

create trigger identities_sync_discord
  after insert or update of provider_id on auth.identities
  for each row execute function private.sync_discord_identity();

insert into public.user_discord_links (user_id, discord_user_id, discord_username)
select i.user_id, i.provider_id, i.identity_data ->> 'full_name'
from auth.identities i
where i.provider = 'discord' and i.provider_id ~ '^[0-9]{5,25}$'
on conflict (user_id) do nothing;
