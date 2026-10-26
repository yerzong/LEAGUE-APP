'use client';

import { ASSIGNABLE_TEAM_ROLES, type TeamDetail, type TeamMember } from '@league/contracts';
import { format } from '@league/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  type ColumnDef,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@league/ui';
import { UserMinusIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { messages } from '@/config/i18n';
import { roleOptions } from '@/features/forms/options';
import { dataTableLabels } from '@/lib/ui/data-table-labels';
import { formatDate, initials } from '@/lib/ui/dates';

import { changeMember, removeMember } from '../actions';

const t = messages.teams.roster;
const teamRoles = messages.options.teamRoles;
const NO_ROLE = '__none__';

export function RosterTable({ team, viewerId }: { team: TeamDetail; viewerId: string }) {
  const router = useRouter();
  const canManage = team.permissions.includes('team:manage_roster');

  const run = async (
    promise: ReturnType<typeof changeMember> | ReturnType<typeof removeMember>,
    success: string,
  ) => {
    const result = await promise;
    if (result.ok) {
      toast.success(success);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  const columns: ColumnDef<TeamMember>[] = [
    {
      id: 'member',
      header: t.member,
      accessorFn: (m) => m.displayName ?? m.username ?? '',
      cell: ({ row }) => {
        const m = row.original;
        const name = m.displayName ?? m.username ?? '';
        return (
          <div className="flex items-center gap-2">
            <Avatar size="sm">
              {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" />}
              <AvatarFallback>{initials(name)}</AvatarFallback>
            </Avatar>
            {m.username ? (
              <Link href={`/jugadores/${m.username}`}>{name}</Link>
            ) : (
              <span>{name}</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'teamRole',
      header: t.role,
      accessorFn: (m) => teamRoles[m.teamRole],
      cell: ({ row }) => {
        const m = row.original;
        if (!canManage || m.teamRole === 'captain' || m.userId === viewerId) {
          return (
            <Badge variant={m.teamRole === 'captain' ? 'league' : 'blue'}>
              {teamRoles[m.teamRole]}
            </Badge>
          );
        }
        return (
          <Select
            value={m.teamRole}
            onValueChange={(teamRole) =>
              void run(
                changeMember(team.id, m.userId, {
                  teamRole: teamRole as (typeof ASSIGNABLE_TEAM_ROLES)[number],
                }),
                t.updated,
              )
            }
          >
            <SelectTrigger size="sm" aria-label={t.changeRole}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_TEAM_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {teamRoles[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      id: 'gameRole',
      header: t.gameRole,
      accessorFn: (m) => (m.gameRole ? messages.options.playerRoles[m.gameRole] : ''),
      cell: ({ row }) => {
        const m = row.original;
        const editable = canManage || m.userId === viewerId;
        if (!editable) return m.gameRole ? messages.options.playerRoles[m.gameRole] : '—';
        return (
          <Select
            value={m.gameRole ?? NO_ROLE}
            onValueChange={(value) =>
              void run(
                changeMember(team.id, m.userId, {
                  gameRole:
                    value === NO_ROLE ? null : (value as NonNullable<TeamMember['gameRole']>),
                }),
                t.updated,
              )
            }
          >
            <SelectTrigger size="sm" aria-label={t.gameRole}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ROLE}>{messages.common.none}</SelectItem>
              {roleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    { id: 'riotId', header: t.riotId, accessorFn: (m) => m.riotId ?? '—' },
    {
      id: 'joinedAt',
      header: t.joinedAt,
      accessorFn: (m) => m.joinedAt,
      cell: ({ row }) => <span className="tabular">{formatDate(row.original.joinedAt)}</span>,
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: t.actions,
            enableSorting: false,
            cell: ({ row }) => {
              const m = row.original;
              if (m.teamRole === 'captain' || m.userId === viewerId) return null;
              const name = m.displayName ?? m.username ?? '';
              return (
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={t.remove}>
                      <UserMinusIcon />
                    </Button>
                  }
                  title={format(t.removeTitle, { name })}
                  description={t.removeDescription}
                  confirmLabel={t.remove}
                  cancelLabel={messages.common.cancel}
                  destructive
                  onConfirm={() => run(removeMember(team.id, m.userId), t.removed)}
                />
              );
            },
          } satisfies ColumnDef<TeamMember>,
        ]
      : []),
  ];

  return (
    <DataTable
      columns={columns}
      data={team.members}
      labels={dataTableLabels}
      getRowId={(m) => m.userId}
      empty={<EmptyState title={messages.publicPages.team.emptyRoster} />}
      pageSize={20}
    />
  );
}
