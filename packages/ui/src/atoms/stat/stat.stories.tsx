import type { Meta, StoryObj } from '@storybook/react-vite';

import { Stat, StatGrid } from './stat.js';

const meta = {
  title: 'Atoms/Stat',
  component: Stat,
  args: { label: 'KDA', value: '4.8', hint: '12 games' },
} satisfies Meta<typeof Stat>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <StatGrid>
      <Stat {...args} />
      <Stat label="CS/min" value="8.2" />
      <Stat label="Winrate" value="62 %" hint="8 de 13" />
    </StatGrid>
  ),
};
