import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../atoms/button/button.js';
import { Hero } from './hero.js';

const meta = {
  title: 'Organisms/Hero',
  component: Hero,
  parameters: { layout: 'fullscreen' },
  args: {
    eyebrow: 'Liga amateur · México y LATAM',
    title: 'Compite como profesional',
    description: 'Torneos, equipos y transmisiones en un solo lugar.',
    actions: (
      <>
        <Button size="lg">Explorar torneos</Button>
        <Button size="lg" variant="outline">
          Crear cuenta para competir
        </Button>
      </>
    ),
    media: <div className="aspect-square w-full rounded-full border border-brand-dim" />,
  },
} satisfies Meta<typeof Hero>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Mobile: Story = { globals: { viewport: { value: 'mobile1' } } };
