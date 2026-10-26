'use client';

import { LogOutIcon } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '../../atoms/avatar/avatar.js';
import { defaultRenderLink, type RenderLink } from '../../lib/link.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../dropdown-menu/dropdown-menu.js';

export interface UserMenuItem {
  href: string;
  label: string;
  icon?: ReactNode;
}

export interface UserMenuProps {
  name: string;
  /** Second line under the name (handle or email). */
  detail?: string | undefined;
  avatarUrl?: string | null | undefined;
  /** Shown while there is no picture. */
  initials: string;
  /** Groups separated by a divider (e.g. portal links, then staff links). */
  groups: UserMenuItem[][];
  onSignOut: () => void;
  labels: { trigger: string; signOut: string };
  renderLink?: RenderLink | undefined;
}

/** Avatar button with the account menu. Presentational: the app provides the actions. */
export function UserMenu({
  name,
  detail,
  avatarUrl,
  initials,
  groups,
  onSignOut,
  labels,
  renderLink = defaultRenderLink,
}: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={labels.trigger}
        className="rounded-full focus-ring data-[state=open]:ring-2 data-[state=open]:ring-brand-dim"
      >
        <Avatar>
          {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-text">{name}</span>
          {detail && <span className="truncate text-xs font-normal text-text-muted">{detail}</span>}
        </DropdownMenuLabel>
        {groups.map((group, index) => (
          <Fragment key={group[0]?.href ?? String(index)}>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {group.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  {renderLink({
                    href: item.href,
                    children: (
                      <>
                        {item.icon}
                        {item.label}
                      </>
                    ),
                  })}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </Fragment>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOutIcon />
          {labels.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
