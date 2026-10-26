import { GAME_REGIONS, PLAYER_ROLES, PRIVACY_VISIBILITIES } from '@league/contracts';

import { messages } from '@/config/i18n';

const { options } = messages;

export const roleOptions = PLAYER_ROLES.map((value) => ({
  value,
  label: options.playerRoles[value],
}));
export const regionOptions = GAME_REGIONS.map((value) => ({
  value,
  label: options.gameRegions[value],
}));
export const visibilityOptions = PRIVACY_VISIBILITIES.map((value) => ({
  value,
  label: options.privacy[value],
}));
