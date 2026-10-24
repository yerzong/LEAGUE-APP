import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../atoms/button/button.js';
import { PageHeader } from './page-header.js';

const meta = {
  title: 'Organisms/PageHeader',
  component: PageHeader,
  args: {
    eyebrow: 'Circuito Liga',
    title: 'Temporada 1',
    description: 'Fase regular: 8 equipos, round robin a BO1.',
  },
} satisfies Meta<typeof PageHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithActions: Story = {
  args: {
    actions: (
      <>
        <Button variant="secondary">Exportar</Button>
        <Button>Crear torneo</Button>
      </>
    ),
  },
};
export const TitleOnly: Story = { args: { eyebrow: undefined, description: undefined } };
