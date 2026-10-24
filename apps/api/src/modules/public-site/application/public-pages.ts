// Public team and player pages. Every field passes through the owner's
// privacy setting against the viewer (public, teammate or staff).

import type { GameRegion, PublicPlayer, PublicTeam, SocialLink } from '@league/contracts';

import { notFound } from '../../../shared/application-error.js';
import type { Clock } from '../../../shared/clock.js';
import {
  canSee,
  isAdult,
  type Profile,
  type ResolvedPrivacy,
  type ViewerLevel,
} from '../../identity/domain/profile.js';
import type { MemberRecord, TeamRecord } from '../../teams/domain/team.js';

export interface PublicPagesDeps {
  readonly teams: {
    findBySlug(slug: string): Promise<TeamRecord | null>;
    activeMembers(teamId: string): Promise<MemberRecord[]>;
    activeTeamsOf(userId: string): Promise<{ team: TeamRecord; role: MemberRecord['teamRole'] }[]>;
    logoUrl(path: string | null): string | null;
  };
  readonly profiles: {
    findById(userId: string): Promise<Profile | null>;
    findByUsername(username: string): Promise<Profile | null>;
    privacyOf(userIds: readonly string[]): Promise<Map<string, ResolvedPrivacy>>;
    socialLinksOf(userId: string): Promise<SocialLink[]>;
    avatarUrl(path: string | null): string | null;
  };
  readonly riot: {
    riotIdsOf(userIds: readonly string[]): Promise<Map<string, string>>;
    accountOf(
      userId: string,
    ): Promise<{ gameName: string; tagLine: string; region: GameRegion } | null>;
  };
  readonly clock: Clock;
}

export const PUBLIC_PAGES_DEPS = Symbol('PublicPagesDeps');

async function isStaff(deps: PublicPagesDeps, viewerId: string | null): Promise<boolean> {
  if (viewerId === null) return false;
  return (await deps.profiles.findById(viewerId))?.platformRole === 'super_admin';
}

export class GetPublicTeamUseCase {
  constructor(private readonly deps: PublicPagesDeps) {}

  async execute(slug: string, viewerId: string | null): Promise<PublicTeam> {
    const team = await this.deps.teams.findBySlug(slug);
    if (!team) throw notFound('team_not_found');
    const members = await this.deps.teams.activeMembers(team.id);
    const ids = members.map((m) => m.userId);
    const [profiles, privacy, riotIds, staff] = await Promise.all([
      Promise.all(ids.map((id) => this.deps.profiles.findById(id))),
      this.deps.profiles.privacyOf(ids),
      this.deps.riot.riotIdsOf(ids),
      isStaff(this.deps, viewerId),
    ]);
    const level: ViewerLevel = staff
      ? 'staff'
      : viewerId !== null && ids.includes(viewerId)
        ? 'team'
        : 'public';

    return {
      id: team.id,
      slug: team.slug,
      name: team.name,
      tag: team.tag,
      region: team.region,
      logoUrl: this.deps.teams.logoUrl(team.logoPath),
      description: team.description,
      status: team.status,
      createdAt: team.createdAt.toISOString(),
      members: members.flatMap((member, i) => {
        const profile = profiles[i];
        const settings = privacy.get(member.userId);
        // A player who hides their teams does not appear on the team page.
        if (!profile || !settings || !canSee(settings.teams, level)) return [];
        return [
          {
            username: profile.username,
            displayName: profile.displayName,
            avatarUrl: this.deps.profiles.avatarUrl(profile.avatarPath),
            teamRole: member.teamRole,
            primaryRole: canSee(settings.roles, level)
              ? (member.gameRole ?? profile.primaryRole)
              : null,
            riotId: canSee(settings.riot_account, level)
              ? (riotIds.get(member.userId) ?? null)
              : null,
          },
        ];
      }),
    };
  }
}

export class GetPublicPlayerUseCase {
  constructor(private readonly deps: PublicPagesDeps) {}

  async execute(username: string, viewerId: string | null): Promise<PublicPlayer> {
    const profile = await this.deps.profiles.findByUsername(username);
    if (!profile?.username) throw notFound('player_not_found');

    const [privacy, teams, staff, links, riot] = await Promise.all([
      this.deps.profiles.privacyOf([profile.id]),
      this.deps.teams.activeTeamsOf(profile.id),
      isStaff(this.deps, viewerId),
      this.deps.profiles.socialLinksOf(profile.id),
      this.deps.riot.accountOf(profile.id),
    ]);
    const viewerTeams = viewerId === null ? [] : await this.deps.teams.activeTeamsOf(viewerId);
    const teammates = viewerTeams.some((v) => teams.some((t) => t.team.id === v.team.id));
    const level: ViewerLevel = staff
      ? 'staff'
      : teammates || viewerId === profile.id
        ? 'team'
        : 'public';
    const settings = privacy.get(profile.id);
    const show = (field: keyof ResolvedPrivacy) =>
      settings !== undefined && canSee(settings[field], level);

    return {
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: this.deps.profiles.avatarUrl(profile.avatarPath),
      bio: show('bio') ? profile.bio : null,
      countryCode: show('country') ? profile.countryCode : null,
      gameRegion: show('game_region') ? profile.gameRegion : null,
      primaryRole: show('roles') ? profile.primaryRole : null,
      secondaryRole: show('roles') ? profile.secondaryRole : null,
      isAdult: show('age') ? isAdult(profile.birthDate, this.deps.clock.now()) : null,
      riotAccount:
        show('riot_account') && riot
          ? { gameName: riot.gameName, tagLine: riot.tagLine, region: riot.region }
          : null,
      teams: show('teams')
        ? teams
            .filter(({ team }) => team.status === 'active')
            .map(({ team, role }) => ({
              slug: team.slug,
              name: team.name,
              tag: team.tag,
              teamRole: role,
            }))
        : [],
      socialLinks: links
        .filter((l) => canSee(l.visibility, level))
        .map((l) => ({ platform: l.platform, url: l.url, handle: l.handle })),
    };
  }
}
