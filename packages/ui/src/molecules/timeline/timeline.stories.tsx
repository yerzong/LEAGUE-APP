import type { Meta, StoryObj } from '@storybook/react-vite';

import { Timeline } from './timeline.js';

const meta = {
  title: 'Molecules/Timeline',
  component: Timeline,
  args: {
    label: 'Auditoría del torneo',
    items: [
      {
        id: '3',
        title: 'Aprobó una inscripción como excepción',
        meta: 'staff · 26 de octubre, 20:15',
        description: 'Motivo: cuenta verificada por Discord',
      },
      { id: '2', title: 'Abrió inscripciones', meta: 'staff · 25 de octubre, 18:00' },
      { id: '1', title: 'Publicó el torneo', meta: 'staff · 25 de octubre, 17:40' },
    ],
  },
} satisfies Meta<typeof Timeline>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
