// Fearless Draft: champions played earlier in a series cannot be picked again.

import type { ChampionId, DraftPick, EntrantId, Game } from '../types.js';

/**
 * `per_team`: a team cannot repeat its own champions (the scene's standard).
 * `global`: nobody can pick a champion either team already played.
 */
export type FearlessMode = 'per_team' | 'global';

export interface FearlessOptions {
  readonly mode: FearlessMode;
}

export interface FearlessSeries {
  readonly entrants: readonly [EntrantId, EntrantId];
  /** Games already drafted. Remakes never lock champions. */
  readonly games: readonly Game[];
}

/** Mirrors the `fearless_locks` table. */
export interface FearlessLock {
  readonly entrantId: EntrantId;
  readonly championId: ChampionId;
  readonly lockedByGame: number;
}

export type DraftViolation =
  | {
      readonly reason: 'champion_locked';
      readonly entrantId: EntrantId;
      readonly championId: ChampionId;
      readonly lockedByGame: number;
    }
  | {
      readonly reason: 'duplicate_pick';
      readonly entrantId: EntrantId;
      readonly championId: ChampionId;
    }
  | {
      readonly reason: 'unknown_entrant';
      readonly entrantId: EntrantId;
      readonly championId: ChampionId;
    };

export interface DraftValidation {
  readonly valid: boolean;
  readonly violations: readonly DraftViolation[];
}

/** Champions locked for the next game, per entrant, in the order they were locked. */
export function computeFearlessLocks(
  series: FearlessSeries,
  { mode }: FearlessOptions,
): FearlessLock[] {
  const locks: FearlessLock[] = [];
  const seen = new Set<string>();
  const games = series.games
    .filter((g) => g.status !== 'remade')
    .sort((x, y) => x.number - y.number);
  for (const game of games) {
    for (const pick of game.picks ?? []) {
      const owners = mode === 'global' ? series.entrants : [pick.entrantId];
      for (const entrantId of owners) {
        const key = `${entrantId}:${String(pick.championId)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        locks.push({ entrantId, championId: pick.championId, lockedByGame: game.number });
      }
    }
  }
  return locks;
}

export function lockedChampions(
  locks: readonly FearlessLock[],
  entrantId: EntrantId,
): ChampionId[] {
  return locks.filter((l) => l.entrantId === entrantId).map((l) => l.championId);
}

/** Checks a proposed set of picks for the next game against the locks. */
export function validateDraft(
  locks: readonly FearlessLock[],
  picks: readonly DraftPick[],
  entrants: readonly EntrantId[],
): DraftValidation {
  const violations: DraftViolation[] = [];
  const picked = new Set<ChampionId>();
  for (const { entrantId, championId } of picks) {
    if (!entrants.includes(entrantId)) {
      violations.push({ reason: 'unknown_entrant', entrantId, championId });
      continue;
    }
    if (picked.has(championId)) {
      violations.push({ reason: 'duplicate_pick', entrantId, championId });
      continue;
    }
    picked.add(championId);
    const lock = locks.find((l) => l.entrantId === entrantId && l.championId === championId);
    if (lock) {
      violations.push({
        reason: 'champion_locked',
        entrantId,
        championId,
        lockedByGame: lock.lockedByGame,
      });
    }
  }
  return { valid: violations.length === 0, violations };
}
