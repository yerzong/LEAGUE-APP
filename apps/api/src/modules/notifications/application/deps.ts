import type { Clock } from '../../../shared/clock.js';
import type { CurrentOrganization } from '../../../shared/organization.js';
import type {
  NotificationChannelPort,
  NotificationRepository,
  RecipientDirectory,
  StaffCheck,
} from './ports.js';

/** Everything the notification use cases depend on (one provider in NotificationsModule). */
export interface NotificationsDeps {
  readonly notifications: NotificationRepository;
  readonly directory: RecipientDirectory;
  readonly channels: readonly NotificationChannelPort[];
  readonly staff: StaffCheck;
  readonly organization: CurrentOrganization;
  readonly clock: Clock;
  readonly settings: {
    /** Older events are consumed without notifying (a stale check-in is noise). */
    readonly maxEventAgeHours: number;
    readonly batchSize: number;
  };
}

export const NOTIFICATIONS_DEPS = Symbol('NotificationsDeps');
