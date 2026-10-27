import type { Meta, StoryObj } from '@storybook/react-vite';

import { PublicFooter } from './public-footer.js';

const meta = {
  title: 'Organisms/PublicFooter',
  component: PublicFooter,
  parameters: { layout: 'fullscreen' },
  args: {
    brand: <span className="font-display text-lg font-bold text-brand caps">Liga</span>,
    tagline: 'Liga amateur con producción profesional.',
    groups: [
      {
        title: 'Explora',
        links: [
          { label: 'Torneos', href: '/torneos' },
          { label: 'Equipos', href: '/equipos' },
        ],
      },
      {
        title: 'Legal',
        links: [
          { label: 'Reglamento', href: '/legal/reglamento' },
          { label: 'Privacidad', href: '/legal/privacidad' },
        ],
      },
      { title: 'Comunidad', links: [{ label: 'Discord' }, { label: 'Twitch' }] },
    ],
    disclaimer:
      'Liga no está respaldado por Riot Games y no refleja las opiniones o puntos de vista de Riot Games.',
    legalLine: '© 2026 Liga',
    labels: { navigation: 'Pie de página', soon: 'Pronto' },
  },
} satisfies Meta<typeof PublicFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Mobile: Story = { globals: { viewport: { value: 'mobile1' } } };
