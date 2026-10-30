import type { Meta, StoryObj } from '@storybook/react-vite';

import { TrendBars } from './trend-bars.js';

const meta = {
  title: 'Molecules/TrendBars',
  component: TrendBars,
  args: {
    label: 'KDA por semana',
    points: [
      { key: '1', label: '5 oct', value: 2.4, display: '2.4' },
      { key: '2', label: '12 oct', value: 3.1, display: '3.1' },
      { key: '3', label: '19 oct', value: 4.6, display: '4.6' },
      { key: '4', label: '26 oct', value: 3.8, display: '3.8' },
    ],
  },
} satisfies Meta<typeof TrendBars>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
