import type { Meta, StoryObj } from '@storybook/react-vite';

import { Breadcrumbs } from './breadcrumbs.js';

const meta = {
  title: 'Molecules/Breadcrumbs',
  component: Breadcrumbs,
  args: {
    label: 'Ruta de navegación',
    items: [
      { label: 'Inicio', href: '/' },
      { label: 'Equipos', href: '/equipos' },
      { label: 'Aurora Esports' },
    ],
  },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
