// Presentation helpers for tournaments: event time zone, ranks, eligibility
// reasons and rule summaries. Pure (no fetching), shared by admin, portal and
// public pages.
import type {
  EligibilityFailure,
  EligibilityRuleConfig,
  EntrantStatus,
  PhaseConfig,
  RankConfig,
  TournamentStatus,
  TournamentType,
} from '@league/contracts';
import { format } from '@league/i18n';
import type { Badge } from '@league/ui';
import type { ComponentProps } from 'react';

import { locale, messages } from '@/config/i18n';

const t = messages.tournaments;
const o = t.options;

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>;

export const TYPE_VARIANT: Readonly<Record<TournamentType, BadgeVariant>> = {
  league: 'league',
  flash: 'flash',
  womens: 'femenil',
  university: 'uni',
  ranked_tier: 'ascenso',
  custom: 'outline',
};

export const STATUS_VARIANT: Readonly<Record<TournamentStatus, BadgeVariant>> = {
  draft: 'outline',
  published: 'secondary',
  registration_open: 'success',
  registration_closed: 'warning',
  seeding: 'warning',
  in_progress: 'default',
  completed: 'secondary',
  canceled: 'danger',
  archived: 'outline',
};

export const ENTRANT_VARIANT: Readonly<Record<EntrantStatus, BadgeVariant>> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  waitlisted: 'secondary',
  withdrawn: 'outline',
  disqualified: 'danger',
};

// ---------------------------------------------------------------------------
// Dates in the event time zone
// ---------------------------------------------------------------------------

export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso));
}

export function formatDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone }).format(new Date(iso));
}

function wallClock(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO instant → `YYYY-MM-DDTHH:mm` as seen in the event time zone (datetime-local inputs). */
export function toZonedInput(iso: string | null, timeZone: string): string {
  if (!iso) return '';
  const w = wallClock(new Date(iso), timeZone);
  return `${String(w.year)}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/** `YYYY-MM-DDTHH:mm` in the event time zone → ISO instant; `null` for an empty input. */
export function fromZonedInput(value: string, timeZone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, min] = match.map(Number) as [number, number, number, number, number, number];
  const target = Date.UTC(y, m - 1, d, h, min);
  // Two passes settle the offset also across a DST change.
  let guess = target;
  for (let i = 0; i < 2; i += 1) {
    const w = wallClock(new Date(guess), timeZone);
    const seen = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
    guess += target - seen;
  }
  return new Date(guess).toISOString();
}

// ---------------------------------------------------------------------------
// Ranks, money and rules
// ---------------------------------------------------------------------------

const DIVISIONS = o.divisions as Readonly<Record<string, string>>;

/** `gold_2` (packages/core formatRank) or a rank object → "Oro II". */
export function rankLabel(rank: string | RankConfig | null | undefined): string {
  if (!rank) return o.ranks.iron;
  if (typeof rank !== 'string') {
    const tier = o.ranks[rank.tier];
    return rank.division ? `${tier} ${DIVISIONS[String(rank.division)] ?? ''}` : tier;
  }
  if (rank === 'unranked') return messages.common.none;
  const [tier, division] = rank.split('_');
  const name = (o.ranks as Readonly<Record<string, string>>)[tier ?? ''] ?? rank;
  return division ? `${name} ${DIVISIONS[division] ?? division}` : name;
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'MXN' }).format(cents / 100);
}

const RANK_DETAILS = new Set(['rank', 'min', 'max', 'peak', 'average']);

/** "Cuenta de Riot sin verificar." with the placeholders of the reason filled. */
export function failureReason(failure: Pick<EligibilityFailure, 'reason' | 'details'>): string {
  const template =
    (messages.eligibility.reasons as Readonly<Record<string, string>>)[failure.reason] ??
    messages.errors.unknown;
  const values: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(failure.details)) {
    if (typeof value === 'string' && RANK_DETAILS.has(key)) values[key] = rankLabel(value);
    else if (key === 'availableAt' && typeof value === 'string')
      values[key] = formatDay(value, 'America/Mexico_City');
    else if (Array.isArray(value)) values[key] = value.join(', ');
    else if (typeof value === 'string' || typeof value === 'number') values[key] = value;
  }
  return format(template, values);
}

/** One line per configured rule, for the public page and the portal. */
export function ruleSummary(rule: EligibilityRuleConfig): string {
  const s = t.ruleSummaries;
  const text = (() => {
    switch (rule.type) {
      case 'riot_account_verified':
      case 'not_sanctioned':
      case 'legal_name_required':
      case 'gender':
      case 'institution':
        return s[rule.type];
      case 'region':
        return format(s.region, {
          regions: rule.params.regions.map((r) => messages.options.gameRegions[r]).join(', '),
        });
      case 'country':
        return format(s.country, { countries: rule.params.countries.join(', ') });
      case 'rank_min':
      case 'rank_max':
        return format(s[rule.type], { rank: rankLabel(rule.params.rank) });
      case 'peak_rank_max':
        return format(s.peak_rank_max, {
          rank: rankLabel(rule.params.rank),
          windowDays: rule.params.windowDays,
        });
      case 'account_level_min':
        return format(s.account_level_min, { level: rule.params.level });
      case 'account_age_min':
        return format(s.account_age_min, { days: rule.params.days });
      case 'ranked_games_min':
        return format(s.ranked_games_min, { games: rule.params.games });
      case 'age_min':
        return format(s.age_min, { years: rule.params.years });
      case 'max_tier_roster':
        return format(s.max_tier_roster, { tier: rule.params.tier });
    }
  })();
  return 'appliesTo' in rule && rule.appliesTo === 'team_average'
    ? format(s.teamAverage, { rule: text })
    : text;
}

/** "Eliminación simple · Bo1 (final Bo3) · Draft estándar". */
export function phaseDetail(
  phase: Pick<PhaseConfig, 'format' | 'seriesFormat' | 'finalSeriesFormat' | 'draftMode'>,
): string {
  const d = t.public.detail;
  return format(d.phaseDetail, {
    format: o.formats[phase.format],
    series: o.seriesFormats[phase.seriesFormat],
    final:
      phase.finalSeriesFormat && phase.finalSeriesFormat !== phase.seriesFormat
        ? format(d.finalSeries, { format: o.seriesFormats[phase.finalSeriesFormat] })
        : '',
    draft: o.draftModes[phase.draftMode],
  });
}
