// pnpm seed:reset — removes exactly what the demo seed created: tournaments,
// teams, season and circuit named "demo: …" and the @demo.penta.local
// accounts. audit_logs is append-only: an account that appears in it as the
// actor is anonymized (no name, no role, banned) instead of deleted, and its
// entries stay. The tables have no cascades by design, so children go first.
import type { SeedContext } from './context.js';
import { listAuthUsers } from './context.js';
import { DEMO_CIRCUIT, DEMO_NAME_PREFIX, DEMO_SEASON, isDemoEmail } from './demo-data.js';

export interface ResetSummary {
  tournaments: number;
  teams: number;
  deletedAccounts: number;
  anonymizedAccounts: number;
}

type Step = () => PromiseLike<{ error: { message: string } | null }>;

async function run(label: string, steps: readonly Step[]): Promise<void> {
  for (const step of steps) {
    const { error } = await step();
    if (error) throw new Error(`${label} cleanup failed: ${error.message}`);
  }
}

const ids = (rows: { id: string }[] | null) => (rows ?? []).map((r) => r.id);
/** Accounts already anonymized by a previous reset. */
const ANONYMIZED = 'removed-';

async function deleteTournaments(ctx: SeedContext): Promise<number> {
  const db = ctx.db;
  const T = ids(
    (await db.from('tournaments').select('id').like('name', `${DEMO_NAME_PREFIX}%`)).data,
  );
  if (T.length === 0) return 0;
  const E = ids((await db.from('entrants').select('id').in('tournament_id', T)).data);
  const P = ids((await db.from('phases').select('id').in('tournament_id', T)).data);
  const R = ids((await db.from('rulebooks').select('id').in('tournament_id', T)).data);
  const M = ids((await db.from('matches').select('id').in('tournament_id', T)).data);
  await run('match', [
    () => db.from('outbox_events').delete().in('aggregate_id', M),
    () => db.from('standings').delete().in('tournament_id', T),
    // Games, check-ins, reports, disputes and reschedules go with their match.
    () =>
      db
        .from('matches')
        .update({ next_match_winner_id: null, next_match_loser_id: null })
        .in('tournament_id', T),
    () => db.from('matches').delete().in('tournament_id', T),
  ]);
  await run('tournament', [
    () =>
      db
        .from('outbox_events')
        .delete()
        .in('aggregate_id', [...T, ...E]),
    () => db.from('entrant_roster_members').delete().in('entrant_id', E),
    () => db.from('phase_entrants').delete().in('phase_id', P),
    () => db.from('entrants').delete().in('id', E),
    () => db.from('tournament_roster_rules').delete().in('tournament_id', T),
    () => db.from('groups').delete().in('phase_id', P),
    () => db.from('phases').delete().in('id', P),
    () => db.from('tournament_game_settings').delete().in('tournament_id', T),
    () => db.from('eligibility_rules').delete().in('tournament_id', T),
    () => db.from('schedule_windows').delete().in('tournament_id', T),
    () => db.from('schedule_blackouts').delete().in('tournament_id', T),
    () => db.from('tournament_prizes').delete().in('tournament_id', T),
    () => db.from('tournament_staff').delete().in('tournament_id', T),
    () => db.from('circuit_tournaments').delete().in('tournament_id', T),
    () => db.from('tournaments').update({ current_rulebook_version_id: null }).in('id', T),
    () => db.from('rulebook_versions').delete().in('rulebook_id', R),
    () => db.from('rulebooks').delete().in('id', R),
    () => db.from('tournaments').delete().in('id', T),
  ]);
  return T.length;
}

async function deleteTeams(ctx: SeedContext, users: readonly string[]): Promise<number> {
  const db = ctx.db;
  const byName = (await db.from('teams').select('id').like('name', `${DEMO_NAME_PREFIX}%`)).data;
  const byUser = (
    await db
      .from('teams')
      .select('id')
      .in('created_by', [...users])
  ).data;
  const teamIds = [...new Set([...ids(byName), ...ids(byUser)])];
  if (teamIds.length === 0) return 0;
  for (const teamId of teamIds) {
    const { data } = await db.storage.from('team-logos').list(teamId);
    const paths = (data ?? []).map((f) => `${teamId}/${f.name}`);
    if (paths.length > 0) await db.storage.from('team-logos').remove(paths);
  }
  await run('team', [
    () => db.from('team_captaincy_transfers').delete().in('team_id', teamIds),
    () => db.from('team_join_requests').delete().in('team_id', teamIds),
    () => db.from('team_invitations').delete().in('team_id', teamIds),
    () => db.from('team_members').delete().in('team_id', teamIds),
    () => db.from('team_name_history').delete().in('team_id', teamIds),
    () => db.from('teams').delete().in('id', teamIds),
  ]);
  return teamIds.length;
}

async function deleteSeasonAndCircuit(ctx: SeedContext): Promise<void> {
  await run('season', [
    () =>
      ctx.db
        .from('circuits')
        .delete()
        .eq('organization_id', ctx.organizationId)
        .eq('name', DEMO_CIRCUIT.name),
    () =>
      ctx.db
        .from('seasons')
        .delete()
        .eq('organization_id', ctx.organizationId)
        .eq('name', DEMO_SEASON.name),
  ]);
}

async function deleteUserData(ctx: SeedContext, users: readonly string[]): Promise<void> {
  const db = ctx.db;
  const list = [...users];
  const riot = ids((await db.from('riot_accounts').select('id').in('user_id', list)).data);
  await run('account', [
    () => db.from('team_join_requests').delete().in('user_id', list),
    () => db.from('team_invitations').delete().in('invited_user_id', list),
    () => db.from('team_members').delete().in('user_id', list),
    () => db.from('free_agent_listings').delete().in('user_id', list),
    () => db.from('riot_rank_snapshots').delete().in('riot_account_id', riot),
    () => db.from('riot_id_history').delete().in('riot_account_id', riot),
    () => db.from('riot_verification_attempts').delete().in('user_id', list),
    () => db.from('riot_accounts').delete().in('user_id', list),
    () => db.from('user_social_links').delete().in('user_id', list),
    () => db.from('user_privacy_settings').delete().in('user_id', list),
    () => db.from('user_private_data').delete().in('user_id', list),
  ]);
}

export async function seedReset(ctx: SeedContext): Promise<ResetSummary> {
  const demo = (await listAuthUsers(ctx.auth)).filter(
    (u) => isDemoEmail(u.email) && !u.email?.startsWith(ANONYMIZED),
  );
  const userIds = demo.map((u) => u.id);

  const tournaments = await deleteTournaments(ctx);
  const teams = await deleteTeams(ctx, userIds);
  await deleteSeasonAndCircuit(ctx);
  if (userIds.length === 0)
    return { tournaments, teams, deletedAccounts: 0, anonymizedAccounts: 0 };

  await deleteUserData(ctx, userIds);
  const { data: audited, error } = await ctx.db
    .from('audit_logs')
    .select('actor_user_id')
    .in('actor_user_id', userIds);
  if (error) throw new Error(`audit read failed: ${error.message}`);
  const keep = new Set(audited.map((a) => a.actor_user_id));

  for (const id of userIds) {
    if (keep.has(id)) {
      const { error: anonymizeError } = await ctx.db
        .from('users')
        .update({
          username: null,
          display_name: null,
          platform_role: 'user',
          status: 'banned',
          deleted_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (anonymizeError) throw new Error(`anonymize failed: ${anonymizeError.message}`);
      const { error: authError } = await ctx.auth.admin.updateUserById(id, {
        email: `${ANONYMIZED}${id}@demo.penta.local`,
        ban_duration: '876000h',
      });
      if (authError) throw new Error(`anonymize failed: ${authError.message}`);
    } else {
      const { error: userError } = await ctx.db.from('users').delete().eq('id', id);
      if (userError) throw new Error(`account cleanup failed: ${userError.message}`);
      const { error: authError } = await ctx.auth.admin.deleteUser(id);
      if (authError) throw new Error(`account cleanup failed: ${authError.message}`);
    }
  }
  return {
    tournaments,
    teams,
    deletedAccounts: userIds.length - keep.size,
    anonymizedAccounts: keep.size,
  };
}
