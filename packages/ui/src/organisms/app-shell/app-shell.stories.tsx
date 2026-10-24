import type { Meta, StoryObj } from '@storybook/react-vite';
import { LayoutDashboardIcon, SwatchBookIcon, TrophyIcon, UsersIcon } from 'lucide-react';

import { Button } from '../../atoms/button/button.js';
import { PageHeader } from '../page-header/page-header.js';
import { AppShell } from './app-shell.js';

const meta = {
  title: 'Organisms/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen' },
  args: {
    brand: <span className="font-display text-lg font-bold text-brand caps">Liga</span>,
    title: 'Consola de administración',
    nav: [
      { href: '/admin', label: 'Inicio', icon: <LayoutDashboardIcon /> },
      { href: '/admin/torneos', label: 'Torneos', icon: <TrophyIcon /> },
      { href: '/admin/equipos', label: 'Equipos', icon: <UsersIcon /> },
      { href: '/admin/kitchen-sink', label: 'Componentes', icon: <SwatchBookIcon /> },
    ],
    activeHref: '/admin/torneos',
    labels: { navigation: 'Navegación', openMenu: 'Abrir menú', closeMenu: 'Cerrar menú' },
    actions: (
      <Button variant="ghost" size="sm">
        Cerrar sesión
      </Button>
    ),
    children: (
      <PageHeader eyebrow="Temporada 1" title="Torneos" description="Gestiona los torneos." />
    ),
  },
} satisfies Meta<typeof AppShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};
export const Mobile: Story = { globals: { viewport: { value: 'mobile1' } } };
