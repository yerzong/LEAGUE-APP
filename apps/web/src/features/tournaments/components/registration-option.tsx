import type { RegistrationOption } from '@league/contracts';
import { format } from '@league/i18n';
import { cn } from '@league/ui';
import { CircleCheckIcon, CircleXIcon } from 'lucide-react';

import { messages } from '@/config/i18n';

import { FailureList } from './failure-list';

const p = messages.tournaments.portal;

/** "Aurora es elegible" or "no es elegible" with every reason, for the explore list. */
export function RegistrationOptionView({ option }: { option: RegistrationOption }) {
  const team = option.teamId !== null;
  const title = option.eligible
    ? team
      ? format(p.eligibleTeam, { team: option.label })
      : p.eligibleYou
    : team
      ? format(p.notEligibleTeam, { team: option.label })
      : p.notEligibleYou;
  return (
    <div className="flex flex-col gap-2">
      <p
        className={cn(
          'flex items-center gap-2 text-sm font-semibold',
          option.eligible ? 'text-success' : 'text-danger',
        )}
      >
        {option.eligible ? (
          <CircleCheckIcon aria-hidden className="size-4" />
        ) : (
          <CircleXIcon aria-hidden className="size-4" />
        )}
        {title}
      </p>
      {option.registration && (
        <p className="text-sm text-text-muted">
          {format(p.registered, {
            status: messages.tournaments.options.entrantStatuses[option.registration.status],
          })}
        </p>
      )}
      <FailureList
        failures={option.failures}
        blockers={option.registration ? [] : option.blockers}
        names={new Map(Object.entries(option.names))}
      />
    </div>
  );
}
