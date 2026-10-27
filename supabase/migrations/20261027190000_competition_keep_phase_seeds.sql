-- Module 05: progress updates of phase entrants (status) must keep the seed
-- and group assigned when the phase was generated.
create or replace function public.svc_commit_competition(p_tournament_id uuid, p_actor uuid, p_change jsonb)
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
    group_id = coalesce(excluded.group_id, phase_entrants.group_id),
    seed = coalesce(excluded.seed, phase_entrants.seed),
    status = excluded.status;

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

