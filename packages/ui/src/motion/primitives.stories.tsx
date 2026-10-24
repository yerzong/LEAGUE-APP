import type { Meta, StoryObj } from '@storybook/react-vite';

import { Card, CardHeader, CardTitle } from '../molecules/card/card.js';
import { FadeIn, SlideUp, Stagger, StaggerItem } from './primitives.js';

const meta = {
  title: 'Motion/Primitives',
  component: FadeIn,
  parameters: {
    docs: {
      description: { component: 'Con prefers-reduced-motion activo se renderizan sin animación.' },
    },
  },
} satisfies Meta<typeof FadeIn>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Fade: Story = { args: { children: <p className="text-lg">Aparece con fade</p> } };
export const Slide: Story = {
  args: { children: null },
  render: () => (
    <SlideUp>
      <p className="text-lg">Sube y aparece</p>
    </SlideUp>
  ),
};
export const StaggeredList: Story = {
  args: { children: null },
  render: () => (
    <Stagger className="flex w-72 flex-col gap-2">
      {['Halcones', 'Jaguares', 'Ajolotes', 'Coyotes'].map((team) => (
        <StaggerItem key={team}>
          <Card className="py-4">
            <CardHeader>
              <CardTitle>{team}</CardTitle>
            </CardHeader>
          </Card>
        </StaggerItem>
      ))}
    </Stagger>
  ),
};
