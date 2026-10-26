import type { Meta, StoryObj } from '@storybook/react-vite';
import { HouseIcon, ShieldIcon, UserIcon } from 'lucide-react';

import { UserMenu } from './user-menu.js';

const meta = {
  title: 'Molecules/UserMenu',
  component: UserMenu,
  args: {
    name: 'Ana López',
    detail: '@ana',
    initials: 'AL',
    groups: [
      [
        { href: '/app', label: 'Mi portal', icon: <HouseIcon /> },
        { href: '/app/perfil', label: 'Mi perfil', icon: <UserIcon /> },
      ],
      [{ href: '/admin', label: 'Consola', icon: <ShieldIcon /> }],
    ],
    onSignOut: () => undefined,
    labels: { trigger: 'Menú de cuenta', signOut: 'Cerrar sesión' },
  },
} satisfies Meta<typeof UserMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
