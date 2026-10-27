import type { ProfileQueries } from '../../identity/application/profile.use-cases.js';
import type { RiotAccountQueries } from '../../riot-accounts/application/riot-verification.use-cases.js';
import type { PlayerFacts, PlayerFactsReader } from '../application/ports.js';

/** Eligibility facts from identity and riot-accounts, through their read APIs. */
export class PlayerFactsAdapter implements PlayerFactsReader {
  constructor(
    private readonly profiles: Pick<ProfileQueries, 'summaries' | 'eligibilityFacts'>,
    private readonly riot: Pick<RiotAccountQueries, 'eligibilityFacts'>,
  ) {}

  async factsOf(userIds: readonly string[]): Promise<Map<string, PlayerFacts>> {
    if (userIds.length === 0) return new Map();
    const [summaries, profile, riot] = await Promise.all([
      this.profiles.summaries(userIds),
      this.profiles.eligibilityFacts(userIds),
      this.riot.eligibilityFacts(userIds),
    ]);
    return new Map(
      userIds.flatMap((userId) => {
        const summary = summaries.get(userId);
        if (!summary) return [];
        const facts = profile.get(userId);
        return [
          [
            userId,
            {
              userId,
              username: summary.username,
              displayName: summary.displayName,
              avatarUrl: summary.avatarUrl,
              riot: riot.get(userId) ?? null,
              birthDate: facts?.birthDate ?? null,
              countryCode: facts?.countryCode ?? null,
              gender: facts?.gender ?? null,
              legalNameProvided: facts?.legalNameProvided ?? false,
              institution: facts?.institution ?? null,
            },
          ] as const,
        ];
      }),
    );
  }
}
