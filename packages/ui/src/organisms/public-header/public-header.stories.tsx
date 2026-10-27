import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../atoms/button/button.js';
import { UserMenu } from '../../molecules/user-menu/user-menu.js';
import { PublicHeader } from './public-header.js';

const brand = <span className="font-display text-lg font-bold text-brand caps">Liga</span>;

const meta = {
  title: 'Organisms/PublicHeader',
  component: PublicHeader,
  parameters: { layout: 'fullscreen' },
  args: {
    brand,
    nav: [
      { href: '/', label: 'Inicio' },
      { href: '/torneos', label: 'Torneos' },
      { href: '/equipos', label: 'Equipos' },
      { href: '/jugadores', label: 'Jugadores' },
      { href: '/noticias', label: 'Noticias', soon: true },
      { href: '/en-vivo', label: 'En vivo', soon: true },
    ],
    activeHref: '/equipos',
    labels: {
      navigation: 'Navegación principal',
      openMenu: 'Abrir menú',
      closeMenu: 'Cerrar menú',
      soon: 'Pronto',
    },
    actions: (
      <>
        <Button variant="ghost" size="sm">
          Iniciar sesión
        </Button>
        <Button size="sm" className="hidden sm:inline-flex">
          Registrarte
        </Button>
      </>
    ),
    menuActions: <Button>Registrarte</Button>,
  },
} satisfies Meta<typeof PublicHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Guest: Story = {};
export const SignedIn: Story = {
  args: {
    actions: (
      <UserMenu
        name="Ana López"
        detail="@ana"
        initials="AL"
        groups={[[{ href: '/app', label: 'Mi portal' }]]}
        onSignOut={() => undefined}
        labels={{ trigger: 'Menú de cuenta', signOut: 'Cerrar sesión' }}
      />
    ),
    menuActions: undefined,
  },
};
export const Mobile: Story = { globals: { viewport: { value: 'mobile1' } } };
