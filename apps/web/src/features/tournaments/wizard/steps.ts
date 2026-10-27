// Steps of the tournament wizard and the config sections each one edits.
// Shared by the server pages (initial step from `?paso=`) and the wizard.
import type { TournamentSection } from '@league/contracts';

export const WIZARD_STEPS = [
  { id: 'basics', sections: ['basics'] },
  { id: 'participants', sections: ['participants', 'capacity'] },
  { id: 'game', sections: ['game'] },
  { id: 'eligibility', sections: ['eligibility'] },
  { id: 'roster', sections: ['roster'] },
  { id: 'format', sections: ['format'] },
  { id: 'schedule', sections: ['schedule'] },
  { id: 'supervision', sections: ['supervision', 'broadcast'] },
  { id: 'communication', sections: ['communication'] },
  { id: 'prizes', sections: ['prizes'] },
  { id: 'review', sections: [] },
] as const satisfies readonly { id: string; sections: readonly TournamentSection[] }[];

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id'];

export const isWizardStep = (value: string | undefined): value is WizardStepId =>
  WIZARD_STEPS.some((s) => s.id === value);
