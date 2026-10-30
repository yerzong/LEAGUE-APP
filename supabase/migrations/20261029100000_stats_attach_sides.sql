-- Module 09: the match data also tells which registration played each side.
-- Until the Riot integration the sides of a game were a placeholder
-- (alternating); attaching the data writes the real ones.
-- p_game: { payload, duration_seconds, patch, riot_match_id, blue_entrant_id, red_entrant_id }
create or replace function public.svc_attach_game_data(
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
    blue_entrant_id = coalesce((p_game ->> 'blue_entrant_id')::uuid, blue_entrant_id),
    red_entrant_id = coalesce((p_game ->> 'red_entrant_id')::uuid, red_entrant_id),
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
