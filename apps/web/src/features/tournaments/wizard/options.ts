// Select options of the wizard, from the enums of packages/contracts.
import {
  PHASE_FORMATS,
  SERIES_FORMATS,
  TIEBREAK_CRITERIA_KEYS,
  TOURNAMENT_TYPES,
} from '@league/contracts';

import { messages } from '@/config/i18n';

const o = messages.tournaments.options;

const entries = <K extends string>(labels: Readonly<Record<K, string>>) =>
  (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));

export const typeOptions = TOURNAMENT_TYPES.map((value) => ({ value, label: o.types[value] }));
export const tierOptions = (['1', '2', '3'] as const).map((value) => ({
  value,
  label: o.tiers[value],
}));
export const visibilityOptions = entries(o.visibility);
export const entrantKindOptions = entries(o.entrantKinds);
export const teamSourceOptions = entries(o.teamSources);
export const policyOptions = entries(o.participantPolicies);
export const modalityOptions = entries(o.modalities);
/** Season and circuit wait for the seasons module (no way to pick one yet). */
export const exclusivityOptions = (['none', 'tournament'] as const).map((value) => ({
  value,
  label: o.exclusivity[value],
}));
export const supervisionOptions = entries(o.supervision);
export const costreamOptions = entries(o.costream);
export const mapOptions = entries(o.maps);
export const pickTypeOptions = entries(o.pickTypes);
export const spectatorOptions = entries(o.spectators);
export const formatOptions = PHASE_FORMATS.map((value) => ({ value, label: o.formats[value] }));
export const seriesOptions = SERIES_FORMATS.map((value) => ({
  value,
  label: o.seriesFormats[value],
}));
export const draftOptions = entries(o.draftModes);
export const tiebreakOptions = TIEBREAK_CRITERIA_KEYS.map((value) => ({
  value,
  label: o.tiebreakers[value],
}));
export const seedingOptions = entries(o.seeding);
export const awardOptions = entries(o.awardTypes);
export const prizeTypeOptions = entries(o.prizeTypes);
export const distributionOptions = entries(o.distributions);
export const channelOptions = entries(o.channels);
export const topicOptions = entries(o.topics);
export const timezoneOptions = Object.entries(o.timezones).map(([value, label]) => ({
  value,
  label,
}));
export const weekdayOptions = o.weekdays.map((label, i) => ({ value: String(i), label }));
export const teamSizeOptions = (['1', '2', '3', '4', '5'] as const).map((value) => ({
  value,
  label: `${value}v${value}`,
}));
export const rankTierOptions = entries(o.ranks);
export const divisionOptions = (['1', '2', '3', '4'] as const).map((value) => ({
  value,
  label: o.divisions[value],
}));
export const genderOptions = entries(o.genders);
export const regionOptions = entries(messages.options.gameRegions);
