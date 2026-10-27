import type { EntrantStatus, TournamentStatus, TournamentType } from '@league/contracts';
import { Badge } from '@league/ui';

import { messages } from '@/config/i18n';

import { ENTRANT_VARIANT, STATUS_VARIANT, TYPE_VARIANT } from '../format';

const o = messages.tournaments.options;

export function TournamentTypeBadge({ type }: { type: TournamentType }) {
  return <Badge variant={TYPE_VARIANT[type]}>{o.types[type]}</Badge>;
}

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{o.statuses[status]}</Badge>;
}

export function EntrantStatusBadge({ status }: { status: EntrantStatus }) {
  return <Badge variant={ENTRANT_VARIANT[status]}>{o.entrantStatuses[status]}</Badge>;
}
