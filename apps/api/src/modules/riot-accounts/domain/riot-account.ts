import type { GameRegion, RiotRank } from '@league/contracts';

/** Time the player has to set the icon (docs/12 §2, icon method). */
export const VERIFICATION_TTL_MS = 15 * 60 * 1000;

export interface VerificationAttempt {
  readonly id: string;
  readonly userId: string;
  readonly puuid: string;
  readonly gameName: string;
  readonly tagLine: string;
  readonly region: GameRegion;
  readonly expectedIconId: number;
  readonly status: 'pending' | 'verified' | 'expired' | 'failed';
  readonly expiresAt: Date;
}

export interface LinkedRiotAccount {
  readonly id: string;
  readonly userId: string;
  readonly puuid: string;
  readonly gameName: string;
  readonly tagLine: string;
  readonly region: GameRegion;
  readonly summonerLevel: number | null;
  readonly profileIconId: number | null;
  readonly verifiedAt: Date;
  readonly ranks: readonly RiotRank[];
}

/** Chooses the icon the player must set; never the one already set. */
export interface IconPicker {
  pick(currentIconId: number): number;
}

export class RandomIconPicker implements IconPicker {
  constructor(
    private readonly iconCount: number,
    private readonly random: () => number = Math.random,
  ) {}

  pick(currentIconId: number): number {
    const candidates = Array.from({ length: this.iconCount }, (_, i) => i).filter(
      (i) => i !== currentIconId,
    );
    return candidates[Math.floor(this.random() * candidates.length)] ?? 0;
  }
}

/** Deterministic picker for the Riot stub (E2E): the next base icon. */
export class NextIconPicker implements IconPicker {
  constructor(private readonly iconCount: number) {}

  pick(currentIconId: number): number {
    return (currentIconId + 1) % this.iconCount;
  }
}
