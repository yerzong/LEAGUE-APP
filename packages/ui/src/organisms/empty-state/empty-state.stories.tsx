import type { Meta, StoryObj } from '@storybook/react-vite';
import { TrophyIcon } from 'lucide-react';

import { Button } from '../../atoms/button/button.js';
import { EmptyState } from './empty-state.js';

const meta = {
  title: 'Organisms/EmptyState',
  component: EmptyState,
  args: {
    icon: <TrophyIcon />,
    title: 'Aún no hay torneos',
    description: 'Crea el primero para abrir inscripciones.',
    action: <Button>Crear torneo</Button>,
  },
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Minimal: Story = {
  args: { icon: undefined, action: undefined, description: undefined },
};
export const Showcase: Story = {
  args: {
    variant: 'showcase',
    title: 'Aún no hay partidos programados',
    description: 'El calendario aparecerá aquí en cuanto arranque la temporada.',
    action: <Button variant="outline">Explorar equipos</Button>,
  },
};
