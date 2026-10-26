'use client';

import {
  ASSIGNABLE_TEAM_ROLES,
  type AssignableTeamRole,
  type TeamDetail,
  type UserSearchResult,
} from '@league/contracts';
import { format } from '@league/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  toast,
} from '@league/ui';
import { CopyIcon, LinkIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { messages } from '@/config/i18n';
import { publicEnv } from '@/config/public-env';
import { SelectField } from '@/features/forms/select-field';
import { formatDate, initials } from '@/lib/ui/dates';

import { inviteToTeam, revokeInvitation, searchUsers } from '../actions';

const t = messages.teams.invite;
const roleOptions = ASSIGNABLE_TEAM_ROLES.map((value) => ({
  value,
  label: messages.options.teamRoles[value],
}));

const inviteUrl = (code: string) =>
  new URL(`/app/invitaciones/${code}`, publicEnv.NEXT_PUBLIC_SITE_URL).toString();

async function copy(text: string) {
  await navigator.clipboard.writeText(text);
  toast.success(messages.common.copied);
}

export function InvitePanel({ team }: { team: TeamDetail }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [role, setRole] = useState<AssignableTeamRole>('player');
  const [pending, setPending] = useState(false);
  const memberIds = new Set(team.members.map((m) => m.userId));

  const searching = query.trim().length >= 2;
  const shown = searching ? results : [];

  useEffect(() => {
    if (query.trim().length < 2) return;
    // Small debounce: one search per pause in typing.
    const timer = setTimeout(() => {
      void searchUsers(query).then((result) => {
        setResults(result.ok ? result.data : []);
      });
    }, 250);
    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  const invite = async (request: Parameters<typeof inviteToTeam>[1], success: string) => {
    setPending(true);
    const result = await inviteToTeam(team.id, request);
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return null;
    }
    toast.success(success);
    router.refresh();
    return result.data;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label={t.searchLabel}
            placeholder={t.searchPlaceholder}
            value={query}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          <SelectField
            label={t.roleLabel}
            value={role}
            onChange={(v) => {
              setRole(v ?? 'player');
            }}
            options={roleOptions}
            placeholder={t.roleLabel}
          />
        </div>
        {searching && (
          <ul className="flex flex-col gap-2" aria-label={t.searchLabel}>
            {shown.length === 0 && <li className="text-sm text-text-muted">{t.searchEmpty}</li>}
            {shown.map((user) => (
              <li key={user.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Avatar size="sm">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                    <AvatarFallback>{initials(user.displayName ?? user.username)}</AvatarFallback>
                  </Avatar>
                  <span>{user.displayName ?? user.username}</span>
                  <span className="text-xs text-text-muted">@{user.username}</span>
                </span>
                <Button
                  size="sm"
                  disabled={pending || memberIds.has(user.id)}
                  onClick={() =>
                    void invite({ kind: 'user', userId: user.id, teamRole: role }, t.sent)
                  }
                >
                  {t.send}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="caps text-sm">{t.linkTitle}</h3>
          <p className="text-sm text-text-muted">{t.linkDescription}</p>
          <div>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                void invite({ kind: 'link', teamRole: role }, t.sent).then((invitation) => {
                  if (invitation?.inviteCode) void copy(inviteUrl(invitation.inviteCode));
                })
              }
            >
              <LinkIcon />
              {t.createLink}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="caps text-sm">{t.pending}</h3>
          {team.invitations.length === 0 && (
            <p className="text-sm text-text-muted">{t.pendingEmpty}</p>
          )}
          <ul className="flex flex-col gap-2">
            {team.invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  {invitation.invitedUser ? (
                    <span>
                      {invitation.invitedUser.displayName ?? invitation.invitedUser.username}
                    </span>
                  ) : (
                    <Badge variant="blue">{t.byLink}</Badge>
                  )}
                  <Badge variant="blue">{messages.options.teamRoles[invitation.teamRole]}</Badge>
                  <span className="text-xs text-text-muted">
                    {format(t.expires, { date: formatDate(invitation.expiresAt) })}
                  </span>
                </span>
                <span className="flex gap-2">
                  {invitation.inviteCode && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void copy(inviteUrl(invitation.inviteCode ?? ''))}
                    >
                      <CopyIcon />
                      {messages.common.copy}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void revokeInvitation(team.id, invitation.id).then((result) => {
                        if (result.ok) {
                          toast.success(t.revoked);
                          router.refresh();
                        } else {
                          toast.error(result.message);
                        }
                      })
                    }
                  >
                    {t.revoke}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
