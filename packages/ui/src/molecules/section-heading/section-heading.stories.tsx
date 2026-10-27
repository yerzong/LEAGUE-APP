import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../atoms/button/button.js';
import { SectionHeading } from './section-heading.js';

const meta = {
  title: 'Molecules/SectionHeading',
  component: SectionHeading,
  args: {
    eyebrow: 'Comunidad',
    title: 'Equipos destacados',
    description: 'Los equipos que ya se preparan para la temporada.',
    action: (
      <Button variant="ghost" size="sm">
        Ver todos
      </Button>
    ),
  },
} satisfies Meta<typeof SectionHeading>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const TitleOnly: Story = { args: { eyebrow: undefined, description: undefined } };
