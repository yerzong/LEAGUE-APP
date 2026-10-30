// From a stored Match-V5 payload to packages/core's game input: which
// registration played each side and which platform user each PUUID is.

import { MatchDataSchema } from '@league/contracts';
import type { GameInput } from '@league/core';
import { normalizeMatchV5, type NormalizedMatch } from '@league/integrations';

import type { StatsEntrant } from './ports.js';

/** `null` when the payload is missing or not a match we can read (degrades to W/L). */
export function readMatchData(payload: unknown): NormalizedMatch | null {
  if (payload === null || payload === undefined) return null;
  const parsed = MatchDataSchema.safeParse(payload);
  return parsed.success ? normalizeMatchV5(parsed.data) : null;
}

export interface Accounts {
  get(puuid: string): { readonly userId: string; readonly riotAccountId: string } | undefined;
}

/**
 * The registration of each side. The rosters' PUUIDs decide (Riot may put a
 * team on either side); without any known PUUID, the sides of the game row.
 */
export function sideEntrants(
  match: NormalizedMatch,
  game: { readonly blueEntrantId: string; readonly redEntrantId: string },
  entrants: ReadonlyMap<string, StatsEntrant>,
  accounts: Accounts,
): { blue: string; red: string } {
  const entrantOf = (puuid: string) => {
    const userId = accounts.get(puuid)?.userId;
    if (!userId) return null;
    return [game.blueEntrantId, game.redEntrantId].find((id) =>
      entrants.get(id)?.userIds.includes(userId),
    );
  };
  let straight = 0;
  let swapped = 0;
  for (const p of match.participants) {
    const entrant = entrantOf(p.puuid);
    const expected = p.side === 'blue' ? game.blueEntrantId : game.redEntrantId;
    if (entrant === expected) straight += 1;
    else if (entrant) swapped += 1;
  }
  return swapped > straight
    ? { blue: game.redEntrantId, red: game.blueEntrantId }
    : { blue: game.blueEntrantId, red: game.redEntrantId };
}

export function toGameInput(
  match: NormalizedMatch,
  sides: { readonly blue: string; readonly red: string },
  accounts: Accounts,
): GameInput {
  return {
    durationSeconds: match.durationSeconds,
    teams: match.teams.map((t) => ({
      side: t.side,
      entrantId: sides[t.side],
      win: t.win,
      bans: t.bans.map((b) => b.championId),
      towers: t.towers,
      dragons: t.dragons,
      barons: t.barons,
      heralds: t.heralds,
      grubs: t.grubs,
      inhibitors: t.inhibitors,
      firstTower: t.firstTower,
      firstDragon: t.firstDragon,
      firstBaron: t.firstBaron,
    })),
    participants: match.participants.map(({ riotId: _riotId, ...p }) => ({
      ...p,
      userId: accounts.get(p.puuid)?.userId ?? null,
      entrantId: sides[p.side],
    })),
  };
}

/** The winning registration according to the payload. */
export function payloadWinner(
  match: NormalizedMatch,
  sides: { readonly blue: string; readonly red: string },
): string | null {
  const winner = match.teams.find((t) => t.win);
  return winner ? sides[winner.side] : null;
}
