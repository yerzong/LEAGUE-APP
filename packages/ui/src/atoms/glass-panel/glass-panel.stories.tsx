import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '../badge/badge.js';
import { GlassPanel } from './glass-panel.js';

const meta = {
  title: 'Atoms/GlassPanel',
  component: GlassPanel,
  parameters: {
    docs: {
      description: {
        component:
          'Acento premium (MVP, partido en vivo, modal destacado). Nunca en tablas, fondos grandes ni listas largas.',
      },
    },
  },
} satisfies Meta<typeof GlassPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MvpCard: Story = {
  render: () => (
    <div className="relative overflow-hidden rounded-md bg-surface-2 p-10">
      <div className="absolute -top-8 -left-8 size-40 rounded-full bg-accent-flash/40 blur-2xl" />
      <div className="absolute -right-6 -bottom-10 size-40 rounded-full bg-team-blue/40 blur-2xl" />
      <GlassPanel className="relative flex w-72 flex-col gap-2">
        <Badge variant="flash">MVP de la jornada</Badge>
        <p className="font-display text-3xl font-extrabold text-text caps">Faker</p>
        <p className="text-sm text-text-muted tabular">KDA 12 / 1 / 9 · 92% KP</p>
      </GlassPanel>
    </div>
  ),
};
