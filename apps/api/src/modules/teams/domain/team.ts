import type {
  AssignableTeamRole,
  GameRegion,
  PlayerRole,
  TeamRole,
  TeamStatus,
} from '@league/contracts';

import { toSlug } from '../../../shared/slug.js';

export interface TeamRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly slug: string;
  readonly name: string;
  readonly tag: string;
  readonly region: GameRegion;
  readonly description: string | null;
  readonly logoPath: string | null;
  readonly status: TeamStatus;
  readonly ownerUserId: string;
  readonly createdAt: Date;
}

export interface MemberRecord {
  readonly userId: string;
  readonly teamRole: TeamRole;
  readonly gameRole: PlayerRole | null;
  readonly joinedAt: Date;
}

export interface InvitationRecord {
  readonly id: string;
  readonly teamId: string;
  readonly invitedUserId: string | null;
  readonly inviteCode: string | null;
  readonly teamRole: AssignableTeamRole;
  readonly status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
  readonly expiresAt: Date;
  readonly createdBy: string;
}

export interface JoinRequestRecord {
  readonly id: string;
  readonly teamId: string;
  readonly userId: string;
  readonly message: string | null;
  readonly status: 'pending' | 'approved' | 'declined' | 'withdrawn';
  readonly createdAt: Date;
}

export interface TransferRecord {
  readonly id: string;
  readonly teamId: string;
  readonly fromUserId: string;
  readonly toUserId: string;
  readonly status: 'pending' | 'accepted' | 'declined' | 'canceled';
  readonly createdAt: Date;
}

export interface FreeAgentRecord {
  readonly roles: readonly PlayerRole[];
  readonly message: string | null;
  readonly availability: { version: 1; days: number[]; from: string | null; to: string | null };
  readonly activeUntil: Date;
}

/** Invitations last a week. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** A free agent listing stays visible for 30 days unless renewed. */
export const FREE_AGENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** URL-safe slug from a team name: "Águilas del Norte" → "aguilas-del-norte". */
export const slugify = (name: string): string => toSlug(name, 'equipo');
