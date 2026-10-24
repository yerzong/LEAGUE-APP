import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from './badge.js';

const meta = {
  title: 'Atoms/Badge',
  component: Badge,
  args: { children: 'En vivo' },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Destructive</Badge>
    </div>
  ),
};
export const CircuitAccents: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="league">Liga</Badge>
      <Badge variant="ascenso">Ascenso</Badge>
      <Badge variant="flash">Relámpago</Badge>
      <Badge variant="femenil">Femenil</Badge>
      <Badge variant="uni">Universitario</Badge>
    </div>
  ),
};
export const States: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="success">Victoria</Badge>
      <Badge variant="warning">Check-in por cerrar</Badge>
      <Badge variant="danger">Descalificado</Badge>
      <Badge variant="blue">Lado azul</Badge>
      <Badge variant="red">Lado rojo</Badge>
    </div>
  ),
};
